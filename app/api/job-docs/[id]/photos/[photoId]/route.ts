import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { deleteJobDocPhoto } from "@/lib/job-docs/photo-storage";
import { invalidateReportApproval } from "@/lib/job-docs/approval";

export const runtime = "nodejs";

const VALID_PHASES = new Set(["before", "during", "after", "other"]);

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
 * Ownership context for a Job's photos generally — used by DELETE
 * below, which (unlike PATCH's phase/caption edit) has to handle a
 * photo from either evidence source, not just job_doc_photos. Mirrors
 * the exact business_id -> owner_id check every other route in this
 * file already does; episodeId is resolved the same way
 * lib/job-docs/job-evidence.ts's own callers already do, since a
 * conversation_photos row is only ever reachable through the Job's own
 * linked episode.
 */
async function getOwnedJobDocContext(service: ServiceClient, jobDocId: string, userId: string) {
  const { data: jobDoc } = await service.from("job_docs").select("id, business_id, work_card_id").eq("id", jobDocId).maybeSingle();
  if (!jobDoc) return null;
  const { data: business } = await service.from("businesses").select("id, owner_id").eq("id", jobDoc.business_id).maybeSingle();
  if (!business || business.owner_id !== userId) return null;
  const { data: workCard } = jobDoc.work_card_id
    ? await service.from("work_cards").select("episode_id").eq("id", jobDoc.work_card_id).maybeSingle()
    : { data: null };
  return { jobDoc, business, episodeId: workCard?.episode_id ?? null };
}

/**
 * Phase-chip correction and manual caption edits (ReplyFlow 2.0, Phase
 * 2A) — "the AI suggestion is never authoritative." Same
 * auth -> ownership -> service-role-write shape as every other
 * job_doc_photos write; the table still has no client insert/update
 * grant at all.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string; photoId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();
  const owned = await getOwnedPhoto(service, params.id, params.photoId, user.id);
  if (!owned) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: { phase?: string; caption?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  if (body.phase !== undefined) {
    if (!VALID_PHASES.has(body.phase)) return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
    updates.phase = body.phase;
  }
  if (body.caption !== undefined) {
    const caption = body.caption.trim().slice(0, 200);
    updates.caption = caption || null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await service.from("job_doc_photos").update(updates).eq("id", params.photoId);
  if (error) {
    console.error("[job-docs] photo update failed:", error);
    await recordErrorEvent({
      severity: "error",
      source: "job-docs.photo_update_failed",
      businessId: owned.business.id,
      message: "Updating a job record photo failed.",
      error,
      context: { photoId: params.photoId },
    });
    return NextResponse.json({ error: "Couldn't save that change — please try again." }, { status: 500 });
  }

  // Approval integrity (Stage 3): both caption and phase are shown as
  // part of the photo's place in the report. Non-fatal — the edit
  // itself already saved.
  try {
    await invalidateReportApproval(service, params.id);
  } catch (err) {
    console.error("[job-docs] approval invalidation failed after photo edit:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "job-docs.approval_invalidation_failed",
      businessId: owned.business.id,
      message: "A job record photo was edited but clearing an existing report approval failed.",
      error: err,
      context: { jobDocId: params.id, photoId: params.photoId },
    });
  }

  return NextResponse.json({ ok: true });
}

/**
 * "Remove" means two different things depending on where a photo
 * actually came from (production test, 2026-08-15 — see 0037's own
 * comment for the full story):
 *
 * - job_doc_photos (a manual upload): a real delete. There is no
 *   underlying WhatsApp message to preserve, and this is the behaviour
 *   that already worked correctly.
 * - conversation_photos (a WhatsApp photo): never deleted. The message
 *   the customer actually sent must remain real conversation history.
 *   "Remove" here means excluding it from the report
 *   (included_in_report = false, 0037) — the owner-facing photo list
 *   (GET above) already filters on that flag, so the effect looks
 *   identical to the owner: the photo disappears from this list either
 *   way, one action, no new UI state.
 *
 * The client sends the exact same DELETE either way — it doesn't need
 * to know a photo's source; the server decides by checking which table
 * actually holds the row.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string; photoId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();

  // A pending (not-yet-analysed) photo has no row in either table yet —
  // synthesized purely for display (lib/job-docs/job-evidence.ts's
  // fromPendingMessage) — so there is nothing to exclude or delete.
  if (params.photoId.startsWith("pending-")) {
    return NextResponse.json({ error: "This photo is still being analysed — try again in a moment." }, { status: 400 });
  }

  const ctx = await getOwnedJobDocContext(service, params.id, user.id);
  if (!ctx) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { data: jobDocPhoto } = await service
    .from("job_doc_photos")
    .select("id, storage_path")
    .eq("id", params.photoId)
    .eq("job_doc_id", params.id)
    .maybeSingle();

  if (jobDocPhoto) {
    try {
      await deleteJobDocPhoto(service, jobDocPhoto.storage_path);
    } catch (err) {
      // Non-fatal — still remove the row so the UI isn't stuck with a
      // reference to it. A leftover storage object with no row pointing
      // to it is a cheap, safe failure mode; the reverse (a row pointing
      // at nothing) is the one worth avoiding.
      console.error("[job-docs] photo storage delete failed (row will still be removed):", err);
    }

    const { error } = await service.from("job_doc_photos").delete().eq("id", params.photoId);
    if (error) {
      console.error("[job-docs] photo row delete failed:", error);
      await recordErrorEvent({
        severity: "error",
        source: "job-docs.photo_delete_failed",
        businessId: ctx.business.id,
        message: "Deleting a job record photo failed.",
        error,
        context: { photoId: params.photoId },
      });
      return NextResponse.json({ error: "Couldn't remove that photo — please try again." }, { status: 500 });
    }
  } else {
    // Not a manual upload — must be a WhatsApp-sourced photo, scoped to
    // this Job's own episode exactly the way fetchJobPhotos already
    // scopes conversation_photos reads, so a photo from a different job
    // (even the same customer's) can never be touched here.
    if (!ctx.episodeId) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    const { data: conversationPhoto } = await service
      .from("conversation_photos")
      .select("id")
      .eq("id", params.photoId)
      .eq("episode_id", ctx.episodeId)
      .maybeSingle();
    if (!conversationPhoto) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    const { error } = await service
      .from("conversation_photos")
      .update({ included_in_report: false })
      .eq("id", conversationPhoto.id);
    if (error) {
      console.error("[job-docs] conversation photo exclude failed:", error);
      await recordErrorEvent({
        severity: "error",
        source: "job-docs.photo_exclude_failed",
        businessId: ctx.business.id,
        message: "Excluding a WhatsApp photo from the report failed.",
        error,
        context: { photoId: params.photoId },
      });
      return NextResponse.json({ error: "Couldn't remove that photo — please try again." }, { status: 500 });
    }
  }

  // Approval integrity (Stage 3): a removed photo — deleted or excluded
  // — changes documentation that may have been part of what was
  // approved. Non-fatal — the removal itself already succeeded.
  try {
    await invalidateReportApproval(service, params.id);
  } catch (err) {
    console.error("[job-docs] approval invalidation failed after photo removal:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "job-docs.approval_invalidation_failed",
      businessId: ctx.business.id,
      message: "A job record photo was removed but clearing an existing report approval failed.",
      error: err,
      context: { jobDocId: params.id, photoId: params.photoId },
    });
  }

  return NextResponse.json({ ok: true });
}
