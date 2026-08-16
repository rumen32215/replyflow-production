import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import type { ReportContentPhotoRow } from "./report-content";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Plumber Reset — Phase 3 step 6 (Job/Report transition). One coherent
 * photo/evidence read for a Job, replacing the old one-time "copy a
 * WhatsApp photo into job_doc_photos" step (app/api/work-cards/[id]/
 * job-doc/route.ts, now removed) that caused the exact bug the live
 * test found: a photo could exist in two places, drift, or simply
 * never get copied if the plumber sent it after the report already
 * existed.
 *
 * Three real sources, unioned, never merged into a new table (that's
 * explicitly deferred to Phase 3 step 10 — legacy cleanup):
 *
 * 1. job_doc_photos — photos the plumber manually uploaded inside the
 *    Job Record UI. Still a genuinely separate, legitimate source
 *    (photos a WhatsApp conversation never carried at all).
 * 2. conversation_photos — photos the customer sent over WhatsApp,
 *    already analysed, scoped to this Job's own episode_id (never a
 *    customer-wide query — a different job for the same returning
 *    customer must never leak its photos in here).
 * 3. Image messages with no matching conversation_photos row yet —
 *    the photo was received but analysis hasn't finished (or failed).
 *    Represented honestly as an unanalysed evidence item (mirrors
 *    job_doc_photos' own analyzed_at: null convention) rather than
 *    being invisible until a page refresh happens to catch it after
 *    analysis completes.
 *
 * Historical note: work_card_id_history — job_docs rows created before
 * this change may still carry job_doc_photos rows that were copied
 * from conversation_photos at creation time. Those legacy rows have no
 * way to be distinguished from a genuinely manual upload (job_doc_photos
 * never recorded where a photo came from), so for a small number of
 * pre-existing jobs this union may show a photo twice — once as the
 * old copy, once as the live original. This is a one-time, bounded
 * artifact of jobs created before this deploy, not an ongoing bug:
 * no new duplication can occur going forward, and it's flagged
 * explicitly in the Phase 3 step 6 checkpoint for a deliberate call on
 * whether it's worth a follow-up cleanup migration.
 */

interface ConversationPhotoRow {
  id: string;
  message_id: string;
  storage_path: string;
  visible_summary: string;
  possible_summary: string;
  unknown_note: string;
  analysis_confidence: "low" | "medium" | "high";
  created_at: string;
  included_in_report: boolean;
}

interface PendingImageMessageRow {
  id: string;
  storage_path: string | null;
  created_at: string;
}

/**
 * Which of the two private storage buckets a photo's storage_path
 * actually lives in — the report pipeline (P3.8) never needed this
 * (it resolves URLs from whichever bucket the photo's own route
 * already used), but the Job workspace UI (P3.9) reads both sources
 * side by side and has to know which bucket to sign against. Additive
 * to ReportContentPhotoRow, not a breaking change — every existing
 * P3.8 caller (draft route, approve route, report page) ignores it.
 */
export type JobEvidenceSource = "job_doc" | "conversation" | "pending";

export interface JobEvidencePhoto extends ReportContentPhotoRow {
  source: JobEvidenceSource;
}

function fromJobDocPhoto(row: ReportContentPhotoRow): JobEvidencePhoto {
  return { ...row, source: "job_doc" };
}

function fromConversationPhoto(row: ConversationPhotoRow): JobEvidencePhoto {
  return {
    id: row.id,
    storage_path: row.storage_path,
    caption: null,
    // A WhatsApp photo is, by construction, always received before any
    // job/work exists — a logically guaranteed timeline fact (phase is
    // a job-timeline concept, not a content/subject tag), not a guess
    // about what it depicts. Still fully owner-editable via the
    // existing tap-to-cycle chip; this only changes the starting point.
    phase: "before",
    sort_order: 0,
    visible_summary: row.visible_summary,
    possible_summary: row.possible_summary,
    unknown_note: row.unknown_note,
    analysis_confidence: row.analysis_confidence,
    // A conversation_photos row is only ever inserted once analysis
    // has already succeeded (lib/reply-engine/media-intake.ts) — its
    // mere existence means analyzed, no separate flag needed.
    analyzed_at: row.created_at,
    created_at: row.created_at,
    // 0037 — the owner's own inclusion decision, same column/meaning as
    // job_doc_photos.included_in_report; defaults true until explicitly
    // excluded (see the photo-removal route). The `?? true` mirrors the
    // column's own DB-level default for any caller that hasn't selected
    // it explicitly, rather than turning an absent value into a silent
    // exclusion.
    included_in_report: row.included_in_report ?? true,
    source: "conversation",
  };
}

function fromPendingMessage(row: PendingImageMessageRow): JobEvidencePhoto {
  return {
    id: `pending-${row.id}`,
    storage_path: row.storage_path ?? "",
    caption: null,
    // Same reasoning as fromConversationPhoto above — still awaiting
    // analysis, but already known to have arrived before any job work.
    phase: "before",
    sort_order: 0,
    visible_summary: "",
    possible_summary: "",
    unknown_note: "",
    analysis_confidence: "low",
    analyzed_at: null,
    created_at: row.created_at,
    included_in_report: true,
    source: "pending",
  };
}

/**
 * The one place a Job's full photo evidence is read from. Both
 * parameters are optional because either half of the union can be
 * absent (a Job with no linked job_docs row yet has no job_doc_photos
 * to read; a Job whose conversation predates episodes, or that was
 * created manually with no conversation at all, has no episode_id) —
 * an absent id simply contributes nothing, never an error.
 */
export async function fetchJobPhotos(
  supabase: ServiceClient,
  input: { jobDocId: string | null; episodeId: string | null }
): Promise<JobEvidencePhoto[]> {
  const [jobDocPhotos, conversationPhotos, allImageMessages] = await Promise.all([
    input.jobDocId
      ? supabase
          .from("job_doc_photos")
          .select(
            "id, storage_path, caption, phase, sort_order, visible_summary, possible_summary, unknown_note, analysis_confidence, analyzed_at, created_at, included_in_report"
          )
          .eq("job_doc_id", input.jobDocId)
      : Promise.resolve({ data: [] as ReportContentPhotoRow[] }),
    input.episodeId
      ? supabase
          .from("conversation_photos")
          .select(
            "id, message_id, storage_path, visible_summary, possible_summary, unknown_note, analysis_confidence, created_at, included_in_report"
          )
          .eq("episode_id", input.episodeId)
      : Promise.resolve({ data: [] as ConversationPhotoRow[] }),
    input.episodeId
      ? supabase.from("messages").select("id, storage_path, created_at").eq("episode_id", input.episodeId).eq("message_type", "image")
      : Promise.resolve({ data: [] as PendingImageMessageRow[] }),
  ]);

  const analyzedMessageIds = new Set((conversationPhotos.data ?? []).map((p) => p.message_id));
  const pending = (allImageMessages.data ?? []).filter(
    (m): m is PendingImageMessageRow & { storage_path: string } => Boolean(m.storage_path) && !analyzedMessageIds.has(m.id)
  );

  return [
    ...((jobDocPhotos.data ?? []) as ReportContentPhotoRow[]).map(fromJobDocPhoto),
    ...(conversationPhotos.data ?? []).map(fromConversationPhoto),
    ...pending.map(fromPendingMessage),
  ];
}
