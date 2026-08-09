import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RAW_NOTES_FIELD_KEY,
  JOB_SUMMARY_FIELD_KEY,
  WORK_PERFORMED_FIELD_KEY,
  DIVERGENCE_NOTE_FIELD_KEY,
  observationFieldKey,
  isObservationFieldKey,
  isReportContentFieldKey,
} from "./fields";

test("job_summary is report content", () => {
  assert.equal(isReportContentFieldKey(JOB_SUMMARY_FIELD_KEY), true);
});

test("work_performed is report content", () => {
  assert.equal(isReportContentFieldKey(WORK_PERFORMED_FIELD_KEY), true);
});

test("divergence_note is report content", () => {
  assert.equal(isReportContentFieldKey(DIVERGENCE_NOTE_FIELD_KEY), true);
});

test("every observation_N key is report content", () => {
  assert.equal(isReportContentFieldKey(observationFieldKey(0)), true);
  assert.equal(isReportContentFieldKey(observationFieldKey(7)), true);
});

test("raw_notes — the source input, never itself shown as report output — is not report content", () => {
  assert.equal(isReportContentFieldKey(RAW_NOTES_FIELD_KEY), false);
});

test("an unrecognised field key is not report content (safe default)", () => {
  assert.equal(isReportContentFieldKey("something_unrelated"), false);
});

test("isObservationFieldKey and isReportContentFieldKey agree on observation keys", () => {
  const key = observationFieldKey(3);
  assert.equal(isObservationFieldKey(key), true);
  assert.equal(isReportContentFieldKey(key), true);
});

test("(b) a raw_notes-only edit is never classified as report content — approval must be retained", () => {
  // Mirrors the exact decision app/api/job-docs/[id]/fields/route.ts
  // makes: it only calls invalidateReportApproval() when at least one
  // edited key passes this check.
  const editedKeys = [RAW_NOTES_FIELD_KEY];
  const wouldInvalidate = editedKeys.some((key) => isReportContentFieldKey(key));
  assert.equal(wouldInvalidate, false);
});

test("(b) a mixed edit (raw_notes + a real report field) does count as report content", () => {
  const editedKeys = [RAW_NOTES_FIELD_KEY, JOB_SUMMARY_FIELD_KEY];
  const wouldInvalidate = editedKeys.some((key) => isReportContentFieldKey(key));
  assert.equal(wouldInvalidate, true);
});
