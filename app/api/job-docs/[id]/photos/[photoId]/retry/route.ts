import { NextResponse, type NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { downloadJobDocPhoto } from "@/lib/job-docs/photo-storage";
import { analyzeAndStoreJobDocPhoto } from "@/lib/job-docs/analysis";

export const runtime = "nodejs";

type ServiceClient = ReturnType<typeof createServiceClient>;

async function getOwnedPhoto(service: ServiceClient, jobDocId: string, photoId: string, userId: string) {
  const { data: photo } = await service
    .from("job_doc_photos")
    .select("id, job_doc_id, business_id, storage_path")
    .eq("id", photoId)
    .eq("job_doc_id", jobDocId)
    .maybeSingle();
  if (!photo) return null;
  const { data: business } = await service.from("businesses").select("id, owner_id").eq("id", photo.business_id).maybeSingle();
  if (!business || business.owner_id !== userId) return null;
  return { photo, business };
}

/**
 * Re-runs analysis on an existing photo (Phase 2A fix — "Analysis
 * couldn't be completed" needed a way back). Reuses
 * analyzeAndStoreJobDocPhoto() rather than a second analysis
 * implementation — the exact same layer 1/2/3 safety boundary applies
 * to a retry as to the original attempt.
 *
 * Resets analyzed_at to null *before* kicking off analysis, so the
 * existing bounded-polling hook (hooks/use-job-doc-photos.ts) — which
 * already polls whenever any photo has analyzedAt === null — picks up
 * "Analysing…" automatically. No new client polling logic needed.
 *
 * The original uploaded image is never touched: this only re-downloads
 * it from the existing storage path and updates the existing row.
 * Same auth -> ownership -> service-role-write shape as every other
 * job_doc_photos write; no grant or RLS change.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string; photoId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();
  const owned = await getOwnedPhoto(service, params.id, params.photoId, user.id);
  if (!owned) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let bytes: Uint8Array;
  let mimeType: string;
  try {
    const downloaded = await downloadJobDocPhoto(service, owned.photo.storage_path);
    bytes = downloaded.bytes;
    mimeType = downloaded.mimeType;
  } catch (err) {
    console.error("[job-docs] photo retry download failed:", err);
    await recordErrorEvent({
      severity: "error",
      source: "job-docs.photo_retry_download_failed",
      businessId: owned.business.id,
      message: "Could not re-download a job record photo to retry its analysis.",
      error: err,
      context: { photoId: params.photoId },
    });
    return NextResponse.json({ error: "Couldn't retry that photo — please try again." }, { status: 500 });
  }

  const { error: resetError } = await service.from("job_doc_photos").update({ analyzed_at: null }).eq("id", params.photoId);
  if (resetError) {
    console.error("[job-docs] photo retry reset failed:", resetError);
    await recordErrorEvent({
      severity: "error",
      source: "job-docs.photo_retry_reset_failed",
      businessId: owned.business.id,
      message: "Could not reset a job record photo to pending before retrying analysis.",
      error: resetError,
      context: { photoId: params.photoId },
    });
    return NextResponse.json({ error: "Couldn't retry that photo — please try again." }, { status: 500 });
  }

  const base64Image = Buffer.from(bytes).toString("base64");
  waitUntil(
    analyzeAndStoreJobDocPhoto(service, {
      businessId: owned.business.id,
      jobDocId: params.id,
      photoId: params.photoId,
      base64Image,
      mimeType,
    })
  );

  return NextResponse.json({ ok: true });
}
