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

export const SECTION = {
  intake: "intake",
  summary: "job_summary",
  workPerformed: "work_performed",
  observations: "observations",
  divergence: "divergence",
} as const;

export function observationFieldKey(index: number): string {
  return `${OBSERVATION_FIELD_PREFIX}${index}`;
}

export function isObservationFieldKey(fieldKey: string): boolean {
  return fieldKey.startsWith(OBSERVATION_FIELD_PREFIX);
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
