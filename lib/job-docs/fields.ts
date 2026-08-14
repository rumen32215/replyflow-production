/**
 * ReplyFlow 2.0, Phase 2 — the field_key/section_label vocabulary
 * job_doc_fields rows actually use. One shared source so the create
 * route, the draft route, the fields route, and the review UI can
 * never drift into using slightly different keys for the same thing.
 */

export const RAW_NOTES_FIELD_KEY = "raw_notes";
export const JOB_SUMMARY_FIELD_KEY = "job_summary";
export const WORK_PERFORMED_FIELD_KEY = "work_performed";
export const OBSERVATION_FIELD_PREFIX = "observation_";
/** ReplyFlow 2.0, Phase 2A — set only when Generate Draft finds the
 * photos and the notes appear to describe different things. Never
 * silently reconciled; surfaced for the owner to resolve (see
 * lib/job-docs/generate-draft.ts). */
export const DIVERGENCE_NOTE_FIELD_KEY = "divergence_note";
/** Production hardening (2026-08-14) — "Outcome / Next Steps": what the
 * customer needs to know is still outstanding or coming next. Added to
 * the existing provenance-tracked job_doc_fields vocabulary, not a new
 * table — this system was already built to grow by field_key. */
export const NEXT_STEPS_FIELD_KEY = "next_steps";

export const SECTION = {
  intake: "intake",
  summary: "job_summary",
  workPerformed: "work_performed",
  observations: "observations",
  divergence: "divergence",
  nextSteps: "next_steps",
} as const;

export function observationFieldKey(index: number): string {
  return `${OBSERVATION_FIELD_PREFIX}${index}`;
}

export function isObservationFieldKey(fieldKey: string): boolean {
  return fieldKey.startsWith(OBSERVATION_FIELD_PREFIX);
}

/**
 * ReplyFlow 2.0, Phase 2B (approval integrity) — the field_keys whose
 * value is actually part of the rendered Job Report, as distinct from
 * RAW_NOTES_FIELD_KEY (the tradesperson's own source input, never
 * itself shown as report output — only a regenerated draft turns it
 * into report content, and that path already forces its own
 * invalidation). Used to decide whether an edit via PATCH
 * /api/job-docs/[id]/fields must invalidate an existing approval — see
 * lib/job-docs/approval.ts.
 */
export function isReportContentFieldKey(fieldKey: string): boolean {
  return (
    fieldKey === JOB_SUMMARY_FIELD_KEY ||
    fieldKey === WORK_PERFORMED_FIELD_KEY ||
    fieldKey === DIVERGENCE_NOTE_FIELD_KEY ||
    fieldKey === NEXT_STEPS_FIELD_KEY ||
    isObservationFieldKey(fieldKey)
  );
}

export type Provenance = "user_fact" | "ai_structured" | "ai_suggestion" | "missing";
export type FieldConfidence = "none" | "low" | "medium" | "high";
export type UpdatedBy = "ai" | "engineer";

export interface JobDocFieldRow {
  id: string;
  job_doc_id: string;
  section_label: string;
  sort_order: number;
  field_key: string;
  field_value: string | null;
  provenance: Provenance;
  confidence: FieldConfidence;
  updated_by: UpdatedBy;
}
