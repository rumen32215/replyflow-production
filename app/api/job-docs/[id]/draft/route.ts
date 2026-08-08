import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { generateJobReportDraft, type DraftField } from "@/lib/job-docs/generate-draft";
import {
  RAW_NOTES_FIELD_KEY,
  JOB_SUMMARY_FIELD_KEY,
  WORK_PERFORMED_FIELD_KEY,
  DIVERGENCE_NOTE_FIELD_KEY,
  OBSERVATION_FIELD_PREFIX,
  observationFieldKey,
  SECTION,
  type Provenance,
} from "@/lib/job-docs/fields";
import { ANALYSIS_ERROR_MARKER } from "@/lib/job-docs/photo-schema";

export const runtime = "nodejs";

/**
 * Runs AI drafting for one Job Record and writes the result into
 * job_doc_fields (ReplyFlow 2.0, Phase 2). job_doc_fields is
 * SELECT-only for `authenticated` (0025_job_docs.sql, revised) —
 * every write here goes through the service role, only after
 * confirming the signed-in user actually owns this job_doc's business,
 * same ownership-check shape app/api/reply-drafts/[id]/route.ts
 * already uses for the same reason (that table can't be trusted to a
 * direct client write either).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();

  const { data: jobDoc } = await service
    .from("job_docs")
    .select("id, business_id, customer_name, job_address")
    .eq("id", params.id)
    .maybeSingle();
  if (!jobDoc) return NextResponse.json({ error: "Job record not found" }, { status: 404 });

  const { data: business } = await service.from("businesses").select("id, owner_id").eq("id", jobDoc.business_id).maybeSingle();
  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: notesField } = await service
    .from("job_doc_fields")
    .select("field_value")
    .eq("job_doc_id", jobDoc.id)
    .eq("field_key", RAW_NOTES_FIELD_KEY)
    .maybeSingle();
  const rawNotes = notesField?.field_value?.trim() ?? "";
  if (!rawNotes) {
    return NextResponse.json({ error: "This job record has no notes to draft from yet." }, { status: 400 });
  }

  // Photo context (ReplyFlow 2.0, Phase 2A) — a snapshot at the moment
  // Generate Draft actually runs. The client is responsible for
  // waiting on still-analysing photos beforehand (up to the same
  // 60-second bounded-polling budget — see
  // hooks/use-job-doc-photos.ts's waitForJobDocPhotosSettled), so this
  // route itself never sleeps; it just reports which photos, if any,
  // were still pending and therefore excluded.
  const { data: photoRows } = await service
    .from("job_doc_photos")
    .select("id, caption, visible_summary, possible_summary, unknown_note, analyzed_at")
    .eq("job_doc_id", jobDoc.id)
    .order("sort_order", { ascending: true });

  const allPhotos = photoRows ?? [];
  const erroredPhotos = allPhotos.filter((p) => p.analyzed_at && p.unknown_note === ANALYSIS_ERROR_MARKER);
  const settledPhotos = allPhotos.filter((p) => p.analyzed_at && p.unknown_note !== ANALYSIS_ERROR_MARKER);
  const pendingExcluded = allPhotos
    .filter((p) => !p.analyzed_at)
    .map((p) => ({ id: p.id, caption: p.caption ?? null, reason: "pending" as const }));
  const erroredExcluded = erroredPhotos.map((p) => ({ id: p.id, caption: p.caption ?? null, reason: "error" as const }));
  const excludedPhotos = [...pendingExcluded, ...erroredExcluded];

  const draft = await generateJobReportDraft({
    businessId: business.id,
    customerName: jobDoc.customer_name ?? "",
    jobAddress: jobDoc.job_address,
    rawNotes,
    photos: settledPhotos
      .filter((p) => p.visible_summary || p.possible_summary || p.unknown_note)
      .map((p) => ({
        visibleSummary: p.visible_summary ?? "",
        possibleSummary: p.possible_summary ?? "",
        unknownNote: p.unknown_note ?? "",
      })),
  });

  if (!draft) {
    return NextResponse.json({ error: "Couldn't generate a draft right now — please try again." }, { status: 502 });
  }

  try {
    const fieldRow = (
      sectionLabel: string,
      sortOrder: number,
      fieldKey: string,
      field: DraftField
    ) => {
      const text = field.text.trim();
      const provenance: Provenance = !text ? "missing" : field.confidence === "low" ? "ai_suggestion" : "ai_structured";
      return {
        job_doc_id: jobDoc.id,
        business_id: business.id,
        section_label: sectionLabel,
        sort_order: sortOrder,
        field_key: fieldKey,
        field_value: text || null,
        provenance,
        confidence: text ? field.confidence : "none",
        updated_by: "ai" as const,
      };
    };

    const rows = [
      fieldRow(SECTION.summary, 0, JOB_SUMMARY_FIELD_KEY, draft.jobSummary),
      fieldRow(SECTION.workPerformed, 0, WORK_PERFORMED_FIELD_KEY, draft.workPerformed),
      ...draft.observations.map((o, i) => fieldRow(SECTION.observations, i, observationFieldKey(i), o)),
      // Never auto-resolved (spec) — confidence "low" forces this
      // through fieldRow's own ai_suggestion branch whenever it's
      // present, so it always reads as something to check, never as
      // an asserted fact.
      fieldRow(SECTION.divergence, 0, DIVERGENCE_NOTE_FIELD_KEY, { text: draft.divergenceNote, confidence: "low" }),
    ];

    // Regenerating can produce fewer observations than last time — clear
    // the old set first so a stale observation_3 from a previous draft
    // can never survive a regeneration that only produced two this time.
    const { error: deleteError } = await service
      .from("job_doc_fields")
      .delete()
      .eq("job_doc_id", jobDoc.id)
      .like("field_key", `${OBSERVATION_FIELD_PREFIX}%`);
    if (deleteError) throw deleteError;

    const { error: upsertError } = await service
      .from("job_doc_fields")
      .upsert(rows, { onConflict: "job_doc_id,field_key" });
    if (upsertError) throw upsertError;

    const { error: statusError } = await service.from("job_docs").update({ status: "review" }).eq("id", jobDoc.id);
    if (statusError) throw statusError;

    return NextResponse.json({ ok: true, excludedPhotos });
  } catch (err) {
    console.error("[job-docs] draft write failed:", err);
    await recordErrorEvent({
      severity: "error",
      source: "job-docs.draft_write_failed",
      businessId: business.id,
      message: "A job report draft was generated but could not be saved.",
      error: err,
      context: { jobDocId: jobDoc.id },
    });
    return NextResponse.json({ error: "The draft was generated but couldn't be saved — please try again." }, { status: 500 });
  }
}
