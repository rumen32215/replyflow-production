import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReportSnapshot } from "./report-snapshot";

/**
 * Plumber Reset Phase 3 step 6 — "approved reports behave correctly."
 * A malformed or missing snapshot must always degrade to null (render
 * live instead), never crash the report page.
 */

const VALID_SNAPSHOT = {
  header: { businessName: "Acme Plumbing", businessPhone: null, logoUrl: null, trade: "plumbing" },
  jobDetails: { title: "Leak repair", customerName: "Sarah", jobAddress: "1 High St", jobDate: "2026-08-10T09:00:00.000Z" },
  content: {
    jobDocId: "doc-1",
    isJobCompleted: true,
    issueReported: "Leaking tap",
    jobSummary: { text: "Diagnosed a leak.", provenance: "user_fact" },
    workPerformed: { text: "Replaced the washer.", provenance: "ai_structured" },
    nextSteps: null,
    observations: [],
    photos: [],
  },
};

test("a genuinely well-formed snapshot round-trips exactly", () => {
  const parsed = parseReportSnapshot(VALID_SNAPSHOT);
  assert.deepEqual(parsed, VALID_SNAPSHOT);
});

test("null/undefined snapshot is null, not an error", () => {
  assert.equal(parseReportSnapshot(null), null);
  assert.equal(parseReportSnapshot(undefined), null);
});

test("a non-object snapshot is null", () => {
  assert.equal(parseReportSnapshot("approved"), null);
  assert.equal(parseReportSnapshot(42), null);
});

test("missing header/jobDetails/content is null", () => {
  assert.equal(parseReportSnapshot({ jobDetails: {}, content: { photos: [], observations: [] } }), null);
  assert.equal(parseReportSnapshot({ header: {}, content: { photos: [], observations: [] } }), null);
  assert.equal(parseReportSnapshot({ header: {}, jobDetails: {} }), null);
});

test("content missing its photos/observations arrays is null — a genuinely malformed shape must never render as if it were real", () => {
  assert.equal(parseReportSnapshot({ header: {}, jobDetails: {}, content: {} }), null);
  assert.equal(parseReportSnapshot({ header: {}, jobDetails: {}, content: { photos: [] } }), null);
});
