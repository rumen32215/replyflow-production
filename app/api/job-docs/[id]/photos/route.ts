import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { storeJobDocPhoto, JOB_DOC_MEDIA_BUCKET } from "@/lib/job-docs/photo-storage";
import { analyzeAndStoreJobDocPhoto } from "@/lib/job-docs/analysis";
import { ANALYSIS_ERROR_MARKER } from "@/lib/job-docs/photo-schema";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS_PER_JOB_DOC = 20;

type ServiceClient = ReturnType<typeof createServiceClient>;

async function getOwnedJobDoc(service: ServiceClient, jobDocId: string, userId: string) {
  const { data: jobDoc } = await service.from("job_docs").select("id, business_id").eq("id", jobDocId).maybeSingle();
  if (!jobDoc) return null;
  const { data: business } = await service.from("businesses").select("id, owner_id").eq("id", jobDoc.business_id).maybeSingle();
  if (!business || business.owner_id !== userId) return null;
  return { jobDoc, business };
}

/**
 * Uploads exactly one photo per request (ReplyFlow 2.0, Phase 2A) —
 * deliberately not a batch endpoint, since the spec requires each
 * photo to fail and retry independently; the client's own uploader
 * (components/dashboard/job-records/photo-uploader.tsx) runs up to 3
 * of these concurrently. Auth -> ownership check -> service-role write
 * is the same shape draft/route.ts and fields/route.ts already use —
 * job_doc_photos has no client write grant at all.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();
  const owned = await getOwnedJobDoc(service, params.id, user.id);
  if (!owned) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const { jobDoc, business } = owned;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type — only JPEG, PNG, or WebP photos are allowed." }, { status: 400 });
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "That photo is larger than the 10MB limit." }, { status: 400 });
  }

  const { count } = await service
    .from("job_doc_photos")
    .select("id", { count: "exact", head: true })
    .eq("job_doc_id", jobDoc.id);
  if ((count ?? 0) >= MAX_PHOTOS_PER_JOB_DOC) {
    return NextResponse.json({ error: "This job record already has the maximum of 20 photos." }, { status: 400 });
  }

  const photoId = randomUUID();
  const bytes = new Uint8Array(await file.arrayBuffer());

  let storagePath: string;
  try {
    storagePath = await storeJobDocPhoto(service, { businessId: business.id, jobDocId: jobDoc.id, photoId, bytes, mimeType: file.type });
  } catch (err) {
    console.error("[job-docs] photo upload failed:", err);
    await recordErrorEvent({
      severity: "error",
      source: "job-docs.photo_upload_failed",
      businessId: business.id,
      message: "Uploading a job record photo failed.",
      error: err,
      context: { jobDocId: jobDoc.id },
    });
    return NextResponse.json({ error: "Couldn't upload that photo — please try again." }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await service
    .from("job_doc_photos")
    .insert({
      id: photoId,
      job_doc_id: jobDoc.id,
      business_id: business.id,
      storage_path: storagePath,
      phase: "other",
      sort_order: count ?? 0,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("[job-docs] photo row insert failed:", insertError);
    await recordErrorEvent({
      severity: "error",
      source: "job-docs.photo_insert_failed",
      businessId: business.id,
      message: "Storing a job record photo's row failed after upload.",
      error: insertError,
      context: { jobDocId: jobDoc.id },
    });
    return NextResponse.json({ error: "Couldn't save that photo — please try again." }, { status: 500 });
  }

  // "AI analyses quietly" (spec) — deferred via waitUntil so the
  // upload response returns immediately, same pattern the WhatsApp
  // webhook already uses for its own reply-generation call.
  const base64Image = Buffer.from(bytes).toString("base64");
  waitUntil(analyzeAndStoreJobDocPhoto(service, { businessId: business.id, photoId, base64Image, mimeType: file.type }));

  return NextResponse.json({ id: photoId });
}

/**
 * The bounded-polling endpoint (no Supabase Realtime, per the
 * approved spec). RLS alone already scopes job_doc_photos to the
 * signed-in owner's business for the read — the service role is only
 * needed afterward, to generate signed URLs for the private bucket.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: photoRows } = await supabase
    .from("job_doc_photos")
    .select("id, storage_path, caption, phase, sort_order, visible_summary, possible_summary, unknown_note, analysis_confidence, analyzed_at")
    .eq("job_doc_id", params.id)
    .order("sort_order", { ascending: true });

  const rows = photoRows ?? [];
  const service = createServiceClient();
  const signedResults = await Promise.all(
    rows.map((r) => service.storage.from(JOB_DOC_MEDIA_BUCKET).createSignedUrl(r.storage_path, 3600))
  );

  const photos = rows.map((r, i) => {
    const analysisErrored = r.unknown_note === ANALYSIS_ERROR_MARKER;
    return {
      id: r.id,
      url: signedResults[i]?.data?.signedUrl ?? null,
      caption: r.caption,
      phase: r.phase,
      sortOrder: r.sort_order,
      visibleSummary: r.visible_summary ?? "",
      possibleSummary: r.possible_summary ?? "",
      unknownNote: analysisErrored ? "" : r.unknown_note ?? "",
      analysisErrored,
      confidence: r.analysis_confidence,
      analyzedAt: r.analyzed_at,
    };
  });

  return NextResponse.json({ photos });
}
