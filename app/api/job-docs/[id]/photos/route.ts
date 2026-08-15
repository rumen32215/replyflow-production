import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { storeJobDocPhoto, JOB_DOC_MEDIA_BUCKET } from "@/lib/job-docs/photo-storage";
import { CUSTOMER_MEDIA_BUCKET } from "@/lib/reply-engine/media-storage";
import { compressJobDocPhoto } from "@/lib/job-docs/photo-compression";
import { analyzeAndStoreJobDocPhoto } from "@/lib/job-docs/analysis";
import { ANALYSIS_ERROR_MARKER } from "@/lib/job-docs/photo-schema";
import { invalidateReportApproval } from "@/lib/job-docs/approval";
import { fetchJobPhotos } from "@/lib/job-docs/job-evidence";

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
 * (components/dashboard/reports/photo-uploader.tsx) runs up to 3
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
  const originalBytes = new Uint8Array(await file.arrayBuffer());

  // BUG-10 hardening: compress before storing — the same result then
  // flows into storage, the AI analysis call built later in this same
  // request, and (via retry, which just re-reads storage) any future
  // re-analysis too. The user's photo takes priority over optimisation:
  // a compression failure never rejects the upload or loses the photo,
  // it just falls back to storing what was actually validated above.
  let bytes: Uint8Array = originalBytes;
  try {
    const compressed = await compressJobDocPhoto(originalBytes, file.type);
    bytes = compressed.bytes;
  } catch (err) {
    console.error("[job-docs] photo compression failed, storing original:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "job-docs.photo_compression_failed",
      businessId: business.id,
      message: "Compressing a job record photo failed — the original, validated photo was stored uncompressed instead.",
      error: err,
      context: { jobDocId: jobDoc.id },
    });
  }

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

  // Approval integrity (Stage 3): a newly added photo is new report
  // content the moment its row exists, before analysis even runs — see
  // lib/job-docs/approval.ts. Non-fatal, same discipline as the
  // compression fallback above: the photo itself already uploaded and
  // saved successfully, so a failure here is logged, never surfaced as
  // an upload failure.
  try {
    await invalidateReportApproval(service, jobDoc.id);
  } catch (err) {
    console.error("[job-docs] approval invalidation failed after photo upload:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "job-docs.approval_invalidation_failed",
      businessId: business.id,
      message: "A new photo was uploaded but clearing an existing report approval failed.",
      error: err,
      context: { jobDocId: jobDoc.id },
    });
  }

  // "AI analyses quietly" (spec) — deferred via waitUntil so the
  // upload response returns immediately, same pattern the WhatsApp
  // webhook already uses for its own reply-generation call.
  const base64Image = Buffer.from(bytes).toString("base64");
  waitUntil(
    analyzeAndStoreJobDocPhoto(service, { businessId: business.id, jobDocId: jobDoc.id, photoId, base64Image, mimeType: file.type })
  );

  return NextResponse.json({ id: photoId });
}

/**
 * The bounded-polling endpoint (no Supabase Realtime, per the
 * approved spec). Plumber Reset Phase 3 step 7 — now the Job's full,
 * unified evidence (lib/job-docs/job-evidence.ts), not job_doc_photos
 * alone: a WhatsApp photo that arrives after this report already
 * exists must show up here too, not just on the next full reload. RLS
 * already scopes the initial job_docs/work_cards lookup to the
 * signed-in owner's business; the service role is only needed
 * afterward, for the evidence read itself and signed URLs into
 * whichever private bucket each photo's own source actually lives in.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: jobDoc } = await supabase.from("job_docs").select("id, work_card_id").eq("id", params.id).maybeSingle();
  if (!jobDoc) return NextResponse.json({ error: "Job record not found" }, { status: 404 });

  const { data: workCard } = jobDoc.work_card_id
    ? await supabase.from("work_cards").select("episode_id").eq("id", jobDoc.work_card_id).maybeSingle()
    : { data: null };

  const service = createServiceClient();
  const rows = await fetchJobPhotos(service, { jobDocId: jobDoc.id, episodeId: workCard?.episode_id ?? null });
  const signedResults = await Promise.all(
    rows.map((r) => {
      const bucket = r.source === "job_doc" ? JOB_DOC_MEDIA_BUCKET : CUSTOMER_MEDIA_BUCKET;
      return r.storage_path ? service.storage.from(bucket).createSignedUrl(r.storage_path, 3600) : Promise.resolve({ data: null });
    })
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
