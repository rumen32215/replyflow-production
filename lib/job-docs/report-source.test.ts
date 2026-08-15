import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReportSource, type ReportSourceWorkCard } from "./report-source";
import { JOB_SUMMARY_FIELD_KEY, WORK_PERFORMED_FIELD_KEY } from "./fields";
import type { JobDocFieldRow } from "./fields";

/**
 * Plumber Reset Phase 3 step 6 — "the Job is the single source of
 * truth." Every one of these proves buildReportSource resolves
 * customer/address/date/completion from the live Work Card it's given
 * — never from a job_docs column, because it's never even offered one.
 */

const BUSINESS = { businessName: "Acme Plumbing", phone: "07700 900123", logoUrl: null, trade: "plumbing" };

function workCard(overrides: Partial<ReportSourceWorkCard> = {}): ReportSourceWorkCard {
  return {
    customerName: "Sarah Jones",
    address: "1 High Street",
    issue: "Leaking bathroom P-trap",
    status: "in_progress",
    scheduledFor: "2026-08-10T09:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function summaryField(text: string): JobDocFieldRow {
  return {
    id: "f1",
    job_doc_id: "doc-1",
    section_label: "job_summary",
    sort_order: 0,
    field_key: JOB_SUMMARY_FIELD_KEY,
    field_value: text,
    provenance: "user_fact",
    confidence: "high",
    updated_by: "engineer",
  };
}

test("customer name and address come from the live Work Card, never a stored job_docs value", () => {
  const source = buildReportSource({
    jobDocId: "doc-1",
    jobDocTitle: "Sarah Jones — 1 High Street",
    business: BUSINESS,
    workCard: workCard({ customerName: "Sarah Jones", address: "1 High Street" }),
    fields: [],
    photos: [],
  });
  assert.equal(source.jobDetails.customerName, "Sarah Jones");
  assert.equal(source.jobDetails.jobAddress, "1 High Street");
});

test("a job in progress is never reported as completed", () => {
  const source = buildReportSource({
    jobDocId: "doc-1",
    jobDocTitle: "Job",
    business: BUSINESS,
    workCard: workCard({ status: "in_progress" }),
    fields: [summaryField("Diagnosed a leaking P-trap.")],
    photos: [],
  });
  assert.equal(source.content.isJobCompleted, false);
  assert.equal(source.content.workPerformed, null, "work_performed must never render while the Job is still in progress");
});

test("a job the Work Card says is completed unlocks work-performed content", () => {
  const source = buildReportSource({
    jobDocId: "doc-1",
    jobDocTitle: "Job",
    business: BUSINESS,
    workCard: workCard({ status: "completed", completedAt: "2026-08-11T15:00:00.000Z" }),
    fields: [
      summaryField("Diagnosed a leaking P-trap."),
      {
        id: "f2",
        job_doc_id: "doc-1",
        section_label: "work_performed",
        sort_order: 0,
        field_key: WORK_PERFORMED_FIELD_KEY,
        field_value: "Replaced the P-trap and tested for leaks.",
        provenance: "ai_structured",
        confidence: "high",
        updated_by: "ai",
      },
    ],
    photos: [],
  });
  assert.equal(source.content.isJobCompleted, true);
  assert.equal(source.content.workPerformed?.text, "Replaced the P-trap and tested for leaks.");
});

test("jobDate prefers completedAt over scheduledFor once the job is actually done", () => {
  const source = buildReportSource({
    jobDocId: "doc-1",
    jobDocTitle: "Job",
    business: BUSINESS,
    workCard: workCard({ scheduledFor: "2026-08-10T09:00:00.000Z", completedAt: "2026-08-11T15:00:00.000Z" }),
    fields: [],
    photos: [],
  });
  assert.equal(source.jobDetails.jobDate, "2026-08-11T15:00:00.000Z");
});

test("jobDate falls back to scheduledFor while the job hasn't been completed yet", () => {
  const source = buildReportSource({
    jobDocId: "doc-1",
    jobDocTitle: "Job",
    business: BUSINESS,
    workCard: workCard({ scheduledFor: "2026-08-10T09:00:00.000Z", completedAt: null }),
    fields: [],
    photos: [],
  });
  assert.equal(source.jobDetails.jobDate, "2026-08-10T09:00:00.000Z");
});

test("issueReported is the Work Card's real issue, not a generated summary", () => {
  const source = buildReportSource({
    jobDocId: "doc-1",
    jobDocTitle: "Job",
    business: BUSINESS,
    workCard: workCard({ issue: "Leaking bathroom P-trap" }),
    fields: [],
    photos: [],
  });
  assert.equal(source.content.issueReported, "Leaking bathroom P-trap");
});

test("legacy data remains readable: no linked Work Card at all degrades to honest nulls, never a crash", () => {
  const source = buildReportSource({
    jobDocId: "doc-1",
    jobDocTitle: "Standalone report",
    business: BUSINESS,
    workCard: null,
    fields: [summaryField("A manually-created report with no linked job.")],
    photos: [],
  });
  assert.equal(source.jobDetails.customerName, null);
  assert.equal(source.jobDetails.jobAddress, null);
  assert.equal(source.jobDetails.jobDate, null);
  assert.equal(source.content.isJobCompleted, false);
  assert.equal(source.content.issueReported, null);
  assert.equal(source.content.jobSummary?.text, "A manually-created report with no linked job.");
});

test("the business header is carried through unchanged", () => {
  const source = buildReportSource({
    jobDocId: "doc-1",
    jobDocTitle: "Job",
    business: BUSINESS,
    workCard: workCard(),
    fields: [],
    photos: [],
  });
  assert.deepEqual(source.header, { businessName: "Acme Plumbing", businessPhone: "07700 900123", logoUrl: null, trade: "plumbing" });
});

test("the title comes from job_docs (a label, not a fact that can drift the same way)", () => {
  const source = buildReportSource({
    jobDocId: "doc-1",
    jobDocTitle: "Custom report title",
    business: BUSINESS,
    workCard: workCard(),
    fields: [],
    photos: [],
  });
  assert.equal(source.jobDetails.title, "Custom report title");
});
