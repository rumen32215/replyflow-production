import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JOB_SUMMARY_FIELD_KEY,
  WORK_PERFORMED_FIELD_KEY,
  NEXT_STEPS_FIELD_KEY,
  RAW_NOTES_FIELD_KEY,
  DIVERGENCE_NOTE_FIELD_KEY,
  observationFieldKey,
  type JobDocFieldRow,
} from "./fields";
import { ANALYSIS_ERROR_MARKER } from "./photo-schema";
import { selectReportContent, type ReportContentPhotoRow } from "./report-content";

// Production hardening (2026-08-14) — every existing test below is about
// selection/ordering/eligibility logic that predates and is independent
// of the isJobCompleted/issueReported gate, so they default to a
// completed job (isJobCompleted: true) unless a test overrides it —
// that keeps them testing exactly what they always tested. The gate
// itself gets its own dedicated tests further down.
function selectContent(
  input: Omit<Parameters<typeof selectReportContent>[0], "isJobCompleted" | "issueReported"> &
    Partial<Pick<Parameters<typeof selectReportContent>[0], "isJobCompleted" | "issueReported">>
) {
  return selectReportContent({ isJobCompleted: true, issueReported: null, ...input });
}

function field(overrides: Partial<JobDocFieldRow> = {}): JobDocFieldRow {
  return {
    id: "field-id",
    job_doc_id: "job-1",
    section_label: "job_summary",
    sort_order: 0,
    field_key: JOB_SUMMARY_FIELD_KEY,
    field_value: "Repaired a leaking radiator valve.",
    provenance: "ai_structured",
    confidence: "high",
    updated_by: "ai",
    ...overrides,
  };
}

function photo(overrides: Partial<ReportContentPhotoRow> = {}): ReportContentPhotoRow {
  return {
    id: "photo-id",
    storage_path: "business-1/job-1/photo-id.jpg",
    caption: "Before repair",
    phase: "before",
    sort_order: 0,
    visible_summary: "A radiator valve with visible corrosion.",
    possible_summary: "May indicate a slow leak over time.",
    unknown_note: "",
    analysis_confidence: "medium",
    analyzed_at: "2026-08-01T09:00:00.000Z",
    created_at: "2026-08-01T08:00:00.000Z",
    included_in_report: true,
    ...overrides,
  };
}

test("user-authored report content is included with provenance 'user_fact'", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [field({ provenance: "user_fact", updated_by: "engineer" })],
    photos: [],
  });
  assert.equal(result.jobSummary?.text, "Repaired a leaking radiator valve.");
  assert.equal(result.jobSummary?.provenance, "user_fact");
});

test("valid, confident AI-drafted content is included with provenance 'ai_structured'", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [field({ field_key: WORK_PERFORMED_FIELD_KEY, provenance: "ai_structured" })],
    photos: [],
  });
  assert.equal(result.workPerformed?.text, "Repaired a leaking radiator valve.");
  assert.equal(result.workPerformed?.provenance, "ai_structured");
});

test("an unresolved AI suggestion (low confidence) is excluded", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [field({ provenance: "ai_suggestion", field_value: "Possibly replaced a part.", confidence: "low" })],
    photos: [],
  });
  assert.equal(result.jobSummary, null);
});

test("an unresolved observation is excluded while a resolved sibling observation survives", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [
      field({
        field_key: observationFieldKey(0),
        sort_order: 0,
        provenance: "ai_suggestion",
        field_value: "Might be an old installation.",
      }),
      field({
        field_key: observationFieldKey(1),
        sort_order: 1,
        provenance: "ai_structured",
        field_value: "No further leaks were found after the repair.",
      }),
    ],
    photos: [],
  });
  assert.deepEqual(
    result.observations.map((o) => o.text),
    ["No further leaks were found after the repair."]
  );
});

test("raw_notes is never surfaced, no matter its provenance", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [field({ field_key: RAW_NOTES_FIELD_KEY, provenance: "user_fact", field_value: "Customer called about a leak." })],
    photos: [],
  });
  assert.equal(result.jobSummary, null);
  assert.equal(result.workPerformed, null);
  assert.equal(result.observations.length, 0);
});

test("divergence_note is never surfaced even as owner-authored (user_fact), even non-empty", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [
      field({ field_key: DIVERGENCE_NOTE_FIELD_KEY, provenance: "user_fact", field_value: "The notes and photos disagree about the part." }),
    ],
    photos: [],
  });
  assert.equal(result.jobSummary, null);
  assert.equal(result.workPerformed, null);
  assert.equal(result.observations.length, 0);
});

test("excluded photos (included_in_report = false) never appear", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [],
    photos: [photo({ id: "excluded-photo", included_in_report: false })],
  });
  assert.equal(result.photos.length, 0);
});

test("included photos (included_in_report = true) appear with their analysis text", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [],
    photos: [photo({ id: "included-photo", included_in_report: true })],
  });
  assert.equal(result.photos.length, 1);
  assert.equal(result.photos[0]?.id, "included-photo");
  assert.equal(result.photos[0]?.visibleSummary, "A radiator valve with visible corrosion.");
  assert.equal(result.photos[0]?.analyzed, true);
});

test("a still-analysing photo (analyzed_at null) is still included if included_in_report is true", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [],
    photos: [photo({ analyzed_at: null, visible_summary: "", possible_summary: "", unknown_note: "" })],
  });
  assert.equal(result.photos.length, 1);
  assert.equal(result.photos[0]?.analyzed, false);
});

test("an analysis-errored photo is included with its unknown_note translated to empty, not the internal marker", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [],
    photos: [photo({ unknown_note: ANALYSIS_ERROR_MARKER })],
  });
  assert.equal(result.photos.length, 1);
  assert.equal(result.photos[0]?.unknownNote, "");
});

test("ordering: photos are grouped by phase (before -> during -> after -> other) regardless of input order", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [],
    photos: [
      photo({ id: "p-other", phase: "other", sort_order: 0 }),
      photo({ id: "p-after", phase: "after", sort_order: 0 }),
      photo({ id: "p-before", phase: "before", sort_order: 0 }),
      photo({ id: "p-during", phase: "during", sort_order: 0 }),
    ],
  });
  assert.deepEqual(
    result.photos.map((p) => p.id),
    ["p-before", "p-during", "p-after", "p-other"]
  );
});

test("ordering: within the same phase, sort_order (chronological/upload order) decides", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [],
    photos: [
      photo({ id: "p-third", phase: "before", sort_order: 2 }),
      photo({ id: "p-first", phase: "before", sort_order: 0 }),
      photo({ id: "p-second", phase: "before", sort_order: 1 }),
    ],
  });
  assert.deepEqual(
    result.photos.map((p) => p.id),
    ["p-first", "p-second", "p-third"]
  );
});

test("ordering: a tied phase and sort_order falls back to created_at", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [],
    photos: [
      photo({ id: "p-later", phase: "before", sort_order: 0, created_at: "2026-08-01T10:00:00.000Z" }),
      photo({ id: "p-earlier", phase: "before", sort_order: 0, created_at: "2026-08-01T08:00:00.000Z" }),
    ],
  });
  assert.deepEqual(
    result.photos.map((p) => p.id),
    ["p-earlier", "p-later"]
  );
});

test("observations preserve sort_order regardless of input array order", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [
      field({ field_key: observationFieldKey(2), sort_order: 2, provenance: "user_fact", field_value: "Third observation." }),
      field({ field_key: observationFieldKey(0), sort_order: 0, provenance: "user_fact", field_value: "First observation." }),
      field({ field_key: observationFieldKey(1), sort_order: 1, provenance: "user_fact", field_value: "Second observation." }),
    ],
    photos: [],
  });
  assert.deepEqual(
    result.observations.map((o) => o.text),
    ["First observation.", "Second observation.", "Third observation."]
  );
});

test("empty/missing content: no fields and no photos produces a fully empty, still-valid structure", () => {
  const result = selectContent({ jobDocId: "job-1", fields: [], photos: [] });
  assert.deepEqual(result, {
    jobDocId: "job-1",
    isJobCompleted: true,
    issueReported: null,
    jobSummary: null,
    workPerformed: null,
    nextSteps: null,
    observations: [],
    photos: [],
    charges: null,
  });
});

test("a field with provenance 'missing' and null field_value is excluded", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [field({ provenance: "missing", field_value: null, confidence: "none" })],
    photos: [],
  });
  assert.equal(result.jobSummary, null);
});

test("safety-rejected content: a field the report validator blanked (provenance 'missing', field_value null) is excluded, siblings survive", () => {
  // Exactly the DB state report-validation.ts's scrub() produces for a
  // field that tripped BANNED_PATTERNS — see fieldRow() in
  // app/api/job-docs/[id]/draft/route.ts. The selector deliberately
  // never re-runs BANNED_PATTERNS itself; this proves it correctly
  // honours the state that enforcement already left behind.
  const result = selectContent({
    jobDocId: "job-1",
    fields: [
      field({ field_key: JOB_SUMMARY_FIELD_KEY, provenance: "missing", field_value: null, confidence: "none" }),
      field({ field_key: WORK_PERFORMED_FIELD_KEY, provenance: "ai_structured", field_value: "Replaced the valve." }),
    ],
    photos: [],
  });
  assert.equal(result.jobSummary, null);
  assert.equal(result.workPerformed?.text, "Replaced the valve.");
});

test("mixed user/AI provenance: each field keeps its own real provenance, independently of the others", () => {
  const result = selectContent({
    jobDocId: "job-1",
    fields: [
      field({ field_key: JOB_SUMMARY_FIELD_KEY, provenance: "user_fact", field_value: "Owner-written summary." }),
      field({ field_key: WORK_PERFORMED_FIELD_KEY, provenance: "ai_structured", field_value: "AI-drafted work performed." }),
      field({
        field_key: observationFieldKey(0),
        sort_order: 0,
        provenance: "ai_suggestion",
        field_value: "An unresolved AI guess.",
      }),
    ],
    photos: [],
  });
  assert.equal(result.jobSummary?.provenance, "user_fact");
  assert.equal(result.workPerformed?.provenance, "ai_structured");
  assert.equal(result.observations.length, 0);
});

test("the returned structure is deterministic across repeated calls with the same input", () => {
  const input = {
    jobDocId: "job-1",
    fields: [
      field({ field_key: JOB_SUMMARY_FIELD_KEY, provenance: "user_fact" as const }),
      field({ field_key: observationFieldKey(0), sort_order: 0, provenance: "ai_structured" as const, field_value: "An observation." }),
    ],
    photos: [photo(), photo({ id: "photo-2", phase: "after", sort_order: 1 })],
  };
  assert.deepEqual(selectContent(input), selectContent(input));
});

/* -------- Production hardening (2026-08-14) — isJobCompleted / issueReported / nextSteps -------- */

test("workPerformed is included when the job is genuinely completed, regardless of provenance", () => {
  const result = selectReportContent({
    jobDocId: "job-1",
    fields: [field({ field_key: WORK_PERFORMED_FIELD_KEY, provenance: "ai_structured", field_value: "Replaced the valve." })],
    photos: [],
    isJobCompleted: true,
    issueReported: null,
  });
  assert.equal(result.workPerformed?.text, "Replaced the valve.");
});

test("workPerformed is null when the job is not completed, even if a real, well-provenanced value is stored", () => {
  // The exact live bug this closes: a stored, otherwise-eligible
  // work_performed value must never surface while the real Work Card
  // status says the job isn't done — this is the render-time backstop
  // behind the draft-generation route's own deterministic gate.
  const result = selectReportContent({
    jobDocId: "job-1",
    fields: [
      field({ field_key: WORK_PERFORMED_FIELD_KEY, provenance: "user_fact", field_value: "Replaced the valve and tested it." }),
    ],
    photos: [],
    isJobCompleted: false,
    issueReported: null,
  });
  assert.equal(result.workPerformed, null);
});

test("isJobCompleted is passed through verbatim on the returned structure", () => {
  const completed = selectReportContent({ jobDocId: "job-1", fields: [], photos: [], isJobCompleted: true, issueReported: null });
  const inProgress = selectReportContent({ jobDocId: "job-1", fields: [], photos: [], isJobCompleted: false, issueReported: null });
  assert.equal(completed.isJobCompleted, true);
  assert.equal(inProgress.isJobCompleted, false);
});

test("issueReported is passed through verbatim, not derived from any field", () => {
  const result = selectReportContent({
    jobDocId: "job-1",
    fields: [],
    photos: [],
    isJobCompleted: false,
    issueReported: "Leaking toilet, kitchen tap dripping.",
  });
  assert.equal(result.issueReported, "Leaking toilet, kitchen tap dripping.");
});

test("issueReported is null when there's no linked Work Card to read it from", () => {
  const result = selectReportContent({ jobDocId: "job-1", fields: [], photos: [], isJobCompleted: false, issueReported: null });
  assert.equal(result.issueReported, null);
});

test("nextSteps follows the exact same provenance-eligibility rule as the other text fields", () => {
  const ready = selectContent({
    jobDocId: "job-1",
    fields: [field({ field_key: NEXT_STEPS_FIELD_KEY, provenance: "ai_structured", field_value: "Follow-up visit booked for Thursday." })],
    photos: [],
  });
  assert.equal(ready.nextSteps?.text, "Follow-up visit booked for Thursday.");

  const unresolved = selectContent({
    jobDocId: "job-1",
    fields: [field({ field_key: NEXT_STEPS_FIELD_KEY, provenance: "ai_suggestion", field_value: "Possibly needs a follow-up.", confidence: "low" })],
    photos: [],
  });
  assert.equal(unresolved.nextSteps, null);
});

test("nextSteps is independent of the isJobCompleted gate — a completed job can still have a next step (e.g. a warranty note)", () => {
  const result = selectReportContent({
    jobDocId: "job-1",
    fields: [field({ field_key: NEXT_STEPS_FIELD_KEY, provenance: "ai_structured", field_value: "12-month workmanship guarantee applies." })],
    photos: [],
    isJobCompleted: true,
    issueReported: null,
  });
  assert.equal(result.nextSteps?.text, "12-month workmanship guarantee applies.");
});

/* -------- charges (0038) — always owner-entered, never AI -------- */

test("charges is null when neither labour nor materials was entered — no fabricated £0.00", () => {
  const result = selectContent({ jobDocId: "job-1", fields: [], photos: [], charges: { labour: null, materials: null } });
  assert.equal(result.charges, null);
});

test("charges is null when the input is omitted entirely (a caller that doesn't care about pricing)", () => {
  const result = selectContent({ jobDocId: "job-1", fields: [], photos: [] });
  assert.equal(result.charges, null);
});

test("charges computes the total as labour + materials", () => {
  const result = selectContent({ jobDocId: "job-1", fields: [], photos: [], charges: { labour: 80, materials: 25.5 } });
  assert.deepEqual(result.charges, { labour: 80, materials: 25.5, total: 105.5 });
});

test("charges with only labour entered still produces a real total, materials stays null (not zero)", () => {
  const result = selectContent({ jobDocId: "job-1", fields: [], photos: [], charges: { labour: 60, materials: null } });
  assert.deepEqual(result.charges, { labour: 60, materials: null, total: 60 });
});

test("charges with only materials entered still produces a real total, labour stays null (not zero)", () => {
  const result = selectContent({ jobDocId: "job-1", fields: [], photos: [], charges: { labour: null, materials: 15 } });
  assert.deepEqual(result.charges, { labour: null, materials: 15, total: 15 });
});
