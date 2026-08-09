import type { DraftField, JobReportDraft } from "./generate-draft";
import { BANNED_PATTERNS } from "./banned-patterns";

/**
 * ReplyFlow 2.0, Job Report V2 — layer 3 of the job-report-text safety
 * boundary, the same pattern lib/job-docs/photo-validation.ts already
 * uses for photo analysis: a deterministic, non-AI backstop behind the
 * system prompt in generate-draft.ts, never trusting prompt wording
 * alone. Any field containing a banned pattern is blanked entirely —
 * not trimmed or edited — same "say nothing" over "surgically remove
 * the risky part" reasoning as the photo validator.
 *
 * Called exactly once, in app/api/job-docs/[id]/draft/route.ts,
 * immediately after generateJobReportDraft() returns and before any
 * write to job_doc_fields — this validates freshly AI-generated
 * output only. It must never be called against owner-edited
 * (user_fact) content: once a tradesperson has typed or edited a
 * field themselves, they are its author and reviewer of record, and
 * this codebase's existing principle is to never rewrite or strip a
 * business owner's own words. PATCH /api/job-docs/[id]/fields
 * (the save-edits route) does not call this.
 */

export interface ValidatedJobReportDraft {
  jobSummary: DraftField;
  workPerformed: DraftField;
  observations: DraftField[];
  divergenceNote: string;
  /** True if any field was blanked for containing disallowed content
   * — the caller logs this as a warning error_events entry for
   * observability; never shown to the owner. */
  flagged: boolean;
}

function scrub(text: string): { text: string; flagged: boolean } {
  if (!text) return { text: "", flagged: false };
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) return { text: "", flagged: true };
  }
  return { text, flagged: false };
}

function scrubField(field: DraftField): { field: DraftField; flagged: boolean } {
  const scrubbed = scrub(field.text);
  return { field: { text: scrubbed.text, confidence: field.confidence }, flagged: scrubbed.flagged };
}

export function validateJobReportDraft(draft: JobReportDraft): ValidatedJobReportDraft {
  const jobSummary = scrubField(draft.jobSummary);
  const workPerformed = scrubField(draft.workPerformed);
  const observations = draft.observations.map(scrubField);
  const divergenceNote = scrub(draft.divergenceNote);

  return {
    jobSummary: jobSummary.field,
    workPerformed: workPerformed.field,
    observations: observations.map((o) => o.field),
    divergenceNote: divergenceNote.text,
    flagged: jobSummary.flagged || workPerformed.flagged || observations.some((o) => o.flagged) || divergenceNote.flagged,
  };
}
