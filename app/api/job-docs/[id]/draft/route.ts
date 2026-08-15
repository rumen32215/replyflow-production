import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { generateJobReportDraft, type DraftField } from "@/lib/job-docs/generate-draft";
import {
  RAW_NOTES_FIELD_KEY,
  JOB_SUMMARY_FIELD_KEY,
  WORK_PERFORMED_FIELD_KEY,
  NEXT_STEPS_FIELD_KEY,
  DIVERGENCE_NOTE_FIELD_KEY,
  OBSERVATION_FIELD_PREFIX,
  observationFieldKey,
  isObservationFieldKey,
  SECTION,
  type Provenance,
} from "@/lib/job-docs/fields";
import { ANALYSIS_ERROR_MARKER } from "@/lib/job-docs/photo-schema";
import { draftLockStaleThreshold } from "@/lib/job-docs/draft-lock";
import { validateJobReportDraft } from "@/lib/job-docs/report-validation";
import { APPROVAL_INVALIDATION_UPDATE } from "@/lib/job-docs/approval";
import { fetchJobPhotos } from "@/lib/job-docs/job-evidence";

export const runtime = "nodejs";

/**
 * Acquires the per-job-record draft-generation lock with a single
 * atomic conditional UPDATE (Phase 2A hardening, BUG-14) — of two
 * concurrent requests, exactly one UPDATE can affect the row, the
 * other affects zero rows and gets rejected, with no read-then-write
 * window for both to slip through. The staleness half of the WHERE
 * clause (see lib/job-docs/draft-lock.ts) lets the lock self-expire if
 * a request ever dies before reaching the route's own release step.
 */
async function acquireDraftLock(service: ReturnType<typeof createServiceClient>, jobDocId: string): Promise<boolean> {
  const now = new Date();
  const { data, error } = await service
    .from("job_docs")
    .update({ draft_generating_at: now.toISOString() })
    .eq("id", jobDocId)
    .or(`draft_generating_at.is.null,draft_generating_at.lt.${draftLockStaleThreshold(now)}`)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[job-docs] draft lock acquisition failed:", error);
    return false;
  }
  return Boolean(data);
}

/** Always called from a finally block so the lock never stays held
 * past the request that acquired it, success or failure alike. */
async function releaseDraftLock(service: ReturnType<typeof createServiceClient>, jobDocId: string): Promise<void> {
  const { error } = await service.from("job_docs").update({ draft_generating_at: null }).eq("id", jobDocId);
  if (error) console.error("[job-docs] draft lock release failed:", error);
}

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

  const { data: jobDoc } = await service.from("job_docs").select("id, business_id, work_card_id").eq("id", params.id).maybeSingle();
  if (!jobDoc) return NextResponse.json({ error: "Job record not found" }, { status: 404 });

  const { data: business } = await service.from("businesses").select("id, owner_id").eq("id", jobDoc.business_id).maybeSingle();
  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // The Job is the single source of truth (Plumber Reset Phase 3 step
  // 6) — customer name, address, and completion status are all read
  // live from the Work Card here, never from job_docs' own (now
  // unused) customer_name/job_address columns, which is exactly what
  // used to drift out of sync with what the Work Card actually said.
  // No linked Work Card at all (a manually-created Job Record) degrades
  // to honest nulls/false — absence of confirmation is never treated
  // as confirmation.
  const { data: workCard } = jobDoc.work_card_id
    ? await service.from("work_cards").select("customer_name, address, status, episode_id").eq("id", jobDoc.work_card_id).maybeSingle()
    : { data: null };
  const isJobCompleted = workCard?.status === "completed";

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

  // BUG-14 hardening: only one Generate/Regenerate Draft may run at a
  // time per job record — a second tab, a rapid double-request, or a
  // client retry all hit this same atomic check and get rejected
  // cleanly rather than racing the first request's writes.
  if (!(await acquireDraftLock(service, jobDoc.id))) {
    return NextResponse.json(
      { error: "A draft is already being generated for this job record — please wait for it to finish." },
      { status: 409 }
    );
  }

  try {
    // Photo context (ReplyFlow 2.0, Phase 2A, widened by Phase 3 step 6)
    // — a snapshot at the moment Generate Draft actually runs, now
    // drawn from the Job's full merged evidence (manually-uploaded
    // job_doc_photos AND the customer's own WhatsApp photos, never just
    // the subset that happened to get copied at some earlier point) —
    // see lib/job-docs/job-evidence.ts. The client is responsible for
    // waiting on still-analysing photos beforehand (up to the same
    // 60-second bounded-polling budget — see
    // hooks/use-job-doc-photos.ts's waitForJobDocPhotosSettled), so this
    // route itself never sleeps; it just reports which photos, if any,
    // were still pending and therefore excluded.
    const photoRows = await fetchJobPhotos(service, { jobDocId: jobDoc.id, episodeId: workCard?.episode_id ?? null });

    const allPhotos = [...photoRows].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
    const erroredPhotos = allPhotos.filter((p) => p.analyzed_at && p.unknown_note === ANALYSIS_ERROR_MARKER);
    const settledPhotos = allPhotos.filter((p) => p.analyzed_at && p.unknown_note !== ANALYSIS_ERROR_MARKER);
    const pendingExcluded = allPhotos
      .filter((p) => !p.analyzed_at)
      .map((p) => ({ id: p.id, caption: p.caption ?? null, reason: "pending" as const }));
    const erroredExcluded = erroredPhotos.map((p) => ({ id: p.id, caption: p.caption ?? null, reason: "error" as const }));
    const excludedPhotos = [...pendingExcluded, ...erroredExcluded];

    const draft = await generateJobReportDraft({
      businessId: business.id,
      customerName: workCard?.customer_name ?? "",
      jobAddress: workCard?.address ?? null,
      rawNotes,
      isJobCompleted,
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

    // Layer 3 of the job-report-text safety boundary (same pattern as
    // the photo analysis validator) — a deterministic backstop behind
    // generate-draft.ts's own system prompt, run once here on the
    // freshly-generated AI output, never against an owner's own edits.
    const validated = validateJobReportDraft(draft);

    // Layer 4 — the deterministic status backstop (production hardening,
    // 2026-08-14). buildSystemPrompt() in generate-draft.ts already asks
    // the model to leave work_performed empty when the job isn't
    // completed, but this codebase never trusts a prompt alone for a
    // safety-relevant fact (same reasoning as the photo/message safety
    // layers) — so whatever the model actually wrote is discarded here,
    // unconditionally, whenever the real Work Card status says the job
    // isn't done. The AI cannot invent completion state past this point,
    // full stop.
    if (!isJobCompleted) {
      validated.workPerformed = { text: "", confidence: "low" };
    }

    if (validated.flagged) {
      await recordErrorEvent({
        severity: "warning",
        source: "job-docs.report_draft_flagged",
        businessId: business.id,
        message: "A job report draft contained disallowed content and was redacted before storage.",
        context: { jobDocId: jobDoc.id },
      });
    }

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

    // Provenance-safe regeneration (production hardening, 2026-08-14) —
    // "AI should regenerate the draft/report presentation, not rewrite
    // the underlying truth": once the tradesperson has edited a field
    // (PATCH /api/job-docs/[id]/fields sets provenance: "user_fact"),
    // Generate/Regenerate Draft must never silently overwrite it. Read
    // the current provenance for every field this route could touch,
    // before writing anything.
    const { data: existingRows } = await service
      .from("job_doc_fields")
      .select("field_key, provenance")
      .eq("job_doc_id", jobDoc.id);
    const existing = existingRows ?? [];
    const protectedKeys = new Set(existing.filter((f) => f.provenance === "user_fact").map((f) => f.field_key));

    const rows = [
      !protectedKeys.has(JOB_SUMMARY_FIELD_KEY) ? fieldRow(SECTION.summary, 0, JOB_SUMMARY_FIELD_KEY, validated.jobSummary) : null,
      !protectedKeys.has(WORK_PERFORMED_FIELD_KEY)
        ? fieldRow(SECTION.workPerformed, 0, WORK_PERFORMED_FIELD_KEY, validated.workPerformed)
        : null,
      !protectedKeys.has(NEXT_STEPS_FIELD_KEY) ? fieldRow(SECTION.nextSteps, 1, NEXT_STEPS_FIELD_KEY, validated.nextSteps) : null,
      // Never auto-resolved (spec) — confidence "low" forces this
      // through fieldRow's own ai_suggestion branch whenever it's
      // present, so it always reads as something to check, never as
      // an asserted fact.
      !protectedKeys.has(DIVERGENCE_NOTE_FIELD_KEY)
        ? fieldRow(SECTION.divergence, 0, DIVERGENCE_NOTE_FIELD_KEY, { text: validated.divergenceNote, confidence: "low" })
        : null,
    ].filter((r): r is NonNullable<typeof r> => r !== null);

    // Observations: a protected (user_fact) observation keeps its exact
    // field_key, value, and provenance untouched — it is neither deleted
    // nor overwritten. Fresh AI observations are only ever written into
    // the indices a protected observation isn't already using, so an
    // upsert can never collide with (and silently overwrite) one.
    const protectedObsIndices = new Set(
      existing
        .filter((f) => isObservationFieldKey(f.field_key) && f.provenance === "user_fact")
        .map((f) => Number(f.field_key.slice(OBSERVATION_FIELD_PREFIX.length)))
    );
    let nextObsIndex = 0;
    function allocateObsIndex(): number {
      while (protectedObsIndices.has(nextObsIndex)) nextObsIndex++;
      return nextObsIndex++;
    }
    const observationRows = validated.observations.map((o, i) => fieldRow(SECTION.observations, i, observationFieldKey(allocateObsIndex()), o));
    rows.push(...observationRows);

    // Regenerating can produce fewer observations than last time — clear
    // the old (non-protected) set first so a stale observation_3 from a
    // previous draft can never survive a regeneration that only produced
    // two this time. Protected observations are excluded from this
    // delete entirely — they're never removed, only ever left as-is.
    const deletableObsKeys = existing
      .filter((f) => isObservationFieldKey(f.field_key) && f.provenance !== "user_fact")
      .map((f) => f.field_key);
    if (deletableObsKeys.length > 0) {
      const { error: deleteError } = await service
        .from("job_doc_fields")
        .delete()
        .eq("job_doc_id", jobDoc.id)
        .in("field_key", deletableObsKeys);
      if (deleteError) throw deleteError;
    }

    if (rows.length > 0) {
      const { error: upsertError } = await service
        .from("job_doc_fields")
        .upsert(rows, { onConflict: "job_doc_id,field_key" });
      if (upsertError) throw upsertError;
    }

    // Approval integrity (Stage 3): a fresh draft rewrites the report's
    // actual content, so any existing approval is voided in the same
    // write. Only when something was actually written, though — if
    // every touched field was already protected (user_fact), this
    // regeneration changed nothing, and an approval must never be
    // invalidated for a no-op (production hardening, 2026-08-14).
    // Reuses the exact shape lib/job-docs/approval.ts's
    // invalidateReportApproval() applies elsewhere, so "cleared
    // together" is one definition, not two independently-maintained
    // ones.
    if (rows.length > 0) {
      const { error: statusError } = await service.from("job_docs").update(APPROVAL_INVALIDATION_UPDATE).eq("id", jobDoc.id);
      if (statusError) throw statusError;
    }

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
  } finally {
    // BUG-14 hardening: release regardless of how the try block exited
    // (success, the 502 "no draft" early return, or the write-failure
    // catch above) — the lock must never outlive the request that
    // acquired it.
    await releaseDraftLock(service, jobDoc.id);
  }
}
