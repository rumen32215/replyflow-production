import {
  JOB_SUMMARY_FIELD_KEY,
  WORK_PERFORMED_FIELD_KEY,
  NEXT_STEPS_FIELD_KEY,
  isObservationFieldKey,
  type JobDocFieldRow,
  type Provenance,
} from "./fields";
import { ANALYSIS_ERROR_MARKER, type PhotoConfidence, type PhotoPhase } from "./photo-schema";

/**
 * ReplyFlow 2.0, Phase 2C — the single source of truth for what a Job
 * Report actually contains once it leaves the owner's own review
 * screen:
 *
 *   Job Record data → selectReportContent() → customer-safe report
 *   content → preview / approval / PDF
 *
 * Nothing downstream decides what's customer-visible independently —
 * the customer preview, the final PDF, and the approval summary the
 * owner reviews before approving are all meant to render this exact
 * same structure (the whole point of an approval step is the owner
 * reviewing what the customer will actually see, not a separate
 * internal view of it). A pure, synchronous, deterministic function —
 * no database, no I/O, no signed-URL generation (that's the caller's
 * job, keyed off each photo's storagePath) — same house discipline
 * lib/job-docs/draft-lock.ts and lib/job-docs/approval.ts's pure half
 * already use, so this is unit-testable without a database.
 *
 * Field eligibility (see lib/job-docs/fields.ts's Provenance type and
 * generate-draft.ts's own header comment for where these values come
 * from): only 'user_fact' (the owner's own words) and 'ai_structured'
 * (AI content the model itself was confident the notes actually
 * supported) are genuinely report-ready. 'ai_suggestion' is
 * deliberately excluded — it's the model's own admission that a field
 * is "more inference than the notes directly support," i.e. an
 * unresolved suggestion, not yet fit for a customer document.
 * 'missing' is excluded because there's nothing there — which already
 * covers content report-validation.ts's BANNED_PATTERNS backstop
 * blanked before it ever reached the database (a scrubbed field is
 * written with provenance 'missing' and field_value null — see
 * app/api/job-docs/[id]/draft/route.ts's fieldRow()). This function
 * deliberately does NOT re-run BANNED_PATTERNS: that enforcement
 * already happened once, at write time; duplicating it here would be
 * a second, divergent copy of the same rule rather than a reuse of it.
 *
 * raw_notes and divergence_note are never read by this function at
 * all — they're structurally absent from the result, not filtered
 * out. raw_notes is the owner's own source input, never itself report
 * output. divergence_note is purpose-built as an owner-facing
 * reconciliation note ("the photos and the notes appear to describe
 * something different... surfaced for the owner to resolve") — never
 * customer-facing, regardless of provenance, even once the owner has
 * reviewed or edited it.
 *
 * Photo eligibility: included_in_report (0028_job_docs_approval.sql)
 * is the sole inclusion signal, defaulting true. A photo still
 * analysing or whose analysis errored is still included if
 * included_in_report is true — the tradesperson's photo is real
 * documentation on its own; AI captioning enriches it, it isn't a
 * precondition for it. unknown_note's error-marker translation reuses
 * the exact logic already in app/api/job-docs/[id]/photos/route.ts's
 * GET handler, rather than a second copy of it. Ownership/job scoping
 * (RLS + .eq("job_doc_id", ...)) is the caller's responsibility, the
 * same way it already is for job_doc_fields — this function only ever
 * sees arrays already scoped to one job record.
 *
 * Photo ordering: phase bucket first (before -> during -> after ->
 * other, the natural job narrative), then sort_order ascending within
 * a phase (the existing chronological/upload-order convention every
 * route already sorts by — created_at and id are final deterministic
 * tiebreakers only). This only ever reads sort_order; nothing here
 * writes it or offers manual reordering.
 */

export interface ReportContentField {
  text: string;
  provenance: Provenance;
}

export interface ReportContentPhoto {
  id: string;
  storagePath: string;
  caption: string | null;
  phase: PhotoPhase;
  visibleSummary: string;
  possibleSummary: string;
  unknownNote: string;
  confidence: PhotoConfidence;
  /** True once this photo has reached a terminal analysis state
   * (success or error) — see analyzed_at on job_doc_photos. False
   * never blocks inclusion; it's information for how a renderer might
   * present the photo, not a filter. */
  analyzed: boolean;
}

export interface JobReportContent {
  jobDocId: string;
  /** Production hardening (2026-08-14) — the real, live Work Card
   * completion status. Never stored on job_docs itself; the caller
   * fetches it fresh via job_docs.work_card_id and passes it in here,
   * same "no I/O in this function" discipline as everything else below.
   * false whenever there's no linked Work Card at all — absence of
   * confirmation is never treated as confirmation. */
  isJobCompleted: boolean;
  /** The customer's own original issue, straight from work_cards.issue
   * — not a new stored or AI-generated field. Null only when there's
   * no linked Work Card to read it from. */
  issueReported: string | null;
  jobSummary: ReportContentField | null;
  /** Deliberately not gated by CUSTOMER_READY_PROVENANCE the way the
   * other fields are — see selectReportContent's own note: this field
   * is null outright whenever the job isn't completed, regardless of
   * what (if anything) is stored, so a caller can never accidentally
   * render stale "work performed" text against a job that has since
   * reverted to in-progress. */
  workPerformed: ReportContentField | null;
  /** Production hardening (2026-08-14) — "Outcome / Next Steps." */
  nextSteps: ReportContentField | null;
  observations: ReportContentField[];
  photos: ReportContentPhoto[];
}

/** The exact job_doc_photos columns this function needs — deliberately
 * not the client-facing JobDocPhoto shape in hooks/use-job-doc-photos.ts
 * (that one carries a signed url and no included_in_report), and not a
 * generated Database type (this codebase has none — see 0028's own
 * Stage 2 investigation). */
export interface ReportContentPhotoRow {
  id: string;
  storage_path: string;
  caption: string | null;
  phase: PhotoPhase;
  sort_order: number;
  visible_summary: string;
  possible_summary: string;
  unknown_note: string;
  analysis_confidence: PhotoConfidence;
  analyzed_at: string | null;
  created_at: string;
  included_in_report: boolean;
}

const CUSTOMER_READY_PROVENANCE: ReadonlySet<Provenance> = new Set(["user_fact", "ai_structured"]);

function isCustomerReady(field: JobDocFieldRow): boolean {
  return CUSTOMER_READY_PROVENANCE.has(field.provenance) && Boolean(field.field_value?.trim());
}

function toReportField(field: JobDocFieldRow): ReportContentField {
  // Non-null asserted by isCustomerReady's own trim-truthiness check
  // immediately above at every call site — never called otherwise.
  return { text: field.field_value!.trim(), provenance: field.provenance };
}

function selectTextField(fields: JobDocFieldRow[], fieldKey: string): ReportContentField | null {
  const field = fields.find((f) => f.field_key === fieldKey);
  if (!field || !isCustomerReady(field)) return null;
  return toReportField(field);
}

function selectObservations(fields: JobDocFieldRow[]): ReportContentField[] {
  return fields
    .filter((f) => isObservationFieldKey(f.field_key))
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter(isCustomerReady)
    .map(toReportField);
}

const PHASE_ORDER: Record<PhotoPhase, number> = { before: 0, during: 1, after: 2, other: 3 };

function comparePhotos(a: ReportContentPhotoRow, b: ReportContentPhotoRow): number {
  const phaseDiff = PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase];
  if (phaseDiff !== 0) return phaseDiff;
  const sortDiff = a.sort_order - b.sort_order;
  if (sortDiff !== 0) return sortDiff;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function toReportPhoto(row: ReportContentPhotoRow): ReportContentPhoto {
  const analysisErrored = row.unknown_note === ANALYSIS_ERROR_MARKER;
  return {
    id: row.id,
    storagePath: row.storage_path,
    caption: row.caption,
    phase: row.phase,
    visibleSummary: row.visible_summary ?? "",
    possibleSummary: row.possible_summary ?? "",
    unknownNote: analysisErrored ? "" : row.unknown_note ?? "",
    confidence: row.analysis_confidence,
    analyzed: Boolean(row.analyzed_at),
  };
}

function selectPhotos(photos: ReportContentPhotoRow[]): ReportContentPhoto[] {
  return photos
    .filter((p) => p.included_in_report)
    .slice()
    .sort(comparePhotos)
    .map(toReportPhoto);
}

/**
 * The single source of truth. Takes exactly two already job-scoped
 * arrays (mirroring how every existing route already fetches them —
 * .eq("job_doc_id", jobDocId)) and returns the deterministic,
 * customer-safe content every future consumer renders from.
 */
export function selectReportContent(input: {
  jobDocId: string;
  fields: JobDocFieldRow[];
  photos: ReportContentPhotoRow[];
  /** Production hardening (2026-08-14) — live-fetched by the caller via
   * job_docs.work_card_id, never a stored copy. See JobReportContent's
   * own field comments for why this gates workPerformed specifically. */
  isJobCompleted: boolean;
  issueReported: string | null;
}): JobReportContent {
  // Defence in depth (production hardening, 2026-08-14): the draft-
  // generation route already refuses to write real work_performed
  // content while the job isn't completed, but this is the render-time
  // backstop behind that — even if some other write path ever left
  // content in this field, it is structurally impossible for it to
  // reach the report while the live Work Card status says the job
  // isn't done. AI cannot invent completion state; this function
  // enforces that a second, independent way.
  const workPerformed = input.isJobCompleted ? selectTextField(input.fields, WORK_PERFORMED_FIELD_KEY) : null;

  return {
    jobDocId: input.jobDocId,
    isJobCompleted: input.isJobCompleted,
    issueReported: input.issueReported,
    jobSummary: selectTextField(input.fields, JOB_SUMMARY_FIELD_KEY),
    workPerformed,
    nextSteps: selectTextField(input.fields, NEXT_STEPS_FIELD_KEY),
    observations: selectObservations(input.fields),
    photos: selectPhotos(input.photos),
  };
}
