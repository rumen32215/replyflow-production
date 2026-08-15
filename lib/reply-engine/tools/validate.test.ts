import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateGetCustomerContext,
  validateCreateOrUpdateJob,
  validateCheckAvailability,
  validateCreateBooking,
  validateUpdateBooking,
  validateEscalateToOwner,
} from "./validate";

/**
 * Pure argument validation — no I/O, no mocking needed. Every case
 * here is exactly the "malformed or ambiguous tool request must fail
 * safely rather than guessing" requirement, exercised directly.
 */

test("validateGetCustomerContext: always valid, takes no arguments", () => {
  const result = validateGetCustomerContext(undefined);
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------
// create_or_update_job

test("validateCreateOrUpdateJob: a real issue alone is valid", () => {
  const result = validateCreateOrUpdateJob({ issue: "Leaking kitchen tap", address: null, notes: null });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.args.issue, "Leaking kitchen tap");
});

test("validateCreateOrUpdateJob: all fields null/absent is rejected — nothing to do", () => {
  assert.equal(validateCreateOrUpdateJob({ issue: null, address: null, notes: null }).ok, false);
});

test("validateCreateOrUpdateJob: a non-string issue is rejected", () => {
  const result = validateCreateOrUpdateJob({ issue: 12345, address: null, notes: null });
  assert.equal(result.ok, false);
});

test("validateCreateOrUpdateJob: an absurdly long field is rejected, not silently truncated", () => {
  const result = validateCreateOrUpdateJob({ issue: "x".repeat(500), address: null, notes: null });
  assert.equal(result.ok, false);
});

test("validateCreateOrUpdateJob: non-object arguments are rejected", () => {
  assert.equal(validateCreateOrUpdateJob("not an object").ok, false);
  assert.equal(validateCreateOrUpdateJob(null).ok, false);
  assert.equal(validateCreateOrUpdateJob([1, 2, 3]).ok, false);
});

test("validateCreateOrUpdateJob: whitespace-only text is treated as not provided", () => {
  const result = validateCreateOrUpdateJob({ issue: "   ", address: "Real address", notes: null });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.args.issue, null);
});

// ---------------------------------------------------------------------
// check_availability

test("validateCheckAvailability: both fields absent defaults to nulls", () => {
  const result = validateCheckAvailability({});
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.args, { durationMinutes: null, preferredDate: null });
});

test("validateCheckAvailability: a duration inside the sane range is accepted", () => {
  const result = validateCheckAvailability({ durationMinutes: 90, preferredDate: null });
  assert.equal(result.ok, true);
});

test("validateCheckAvailability: a duration outside the sane range is rejected", () => {
  assert.equal(validateCheckAvailability({ durationMinutes: 5, preferredDate: null }).ok, false);
  assert.equal(validateCheckAvailability({ durationMinutes: 10000, preferredDate: null }).ok, false);
});

test("validateCheckAvailability: a non-numeric duration is rejected", () => {
  assert.equal(validateCheckAvailability({ durationMinutes: "soon", preferredDate: null }).ok, false);
});

test("validateCheckAvailability: an unparseable preferredDate is rejected", () => {
  assert.equal(validateCheckAvailability({ durationMinutes: null, preferredDate: "not a date" }).ok, false);
});

// ---------------------------------------------------------------------
// create_booking

test("validateCreateBooking: a valid future window is accepted", () => {
  const now = new Date("2026-08-15T09:00:00Z");
  const result = validateCreateBooking({ start: "2026-08-16T09:00:00Z", end: "2026-08-16T10:00:00Z" }, now);
  assert.equal(result.ok, true);
});

test("validateCreateBooking: end at or before start is rejected", () => {
  const now = new Date("2026-08-15T09:00:00Z");
  assert.equal(validateCreateBooking({ start: "2026-08-16T10:00:00Z", end: "2026-08-16T09:00:00Z" }, now).ok, false);
  assert.equal(validateCreateBooking({ start: "2026-08-16T09:00:00Z", end: "2026-08-16T09:00:00Z" }, now).ok, false);
});

test("validateCreateBooking: a time genuinely in the past is rejected", () => {
  const now = new Date("2026-08-15T09:00:00Z");
  assert.equal(validateCreateBooking({ start: "2026-08-10T09:00:00Z", end: "2026-08-10T10:00:00Z" }, now).ok, false);
});

test("validateCreateBooking: unparseable timestamps are rejected", () => {
  assert.equal(validateCreateBooking({ start: "tomorrow morning", end: "tomorrow afternoon" }).ok, false);
});

test("validateCreateBooking: missing fields are rejected", () => {
  assert.equal(validateCreateBooking({}).ok, false);
  assert.equal(validateCreateBooking(null).ok, false);
});

// ---------------------------------------------------------------------
// update_booking

test("validateUpdateBooking: confirm needs no start/end", () => {
  const result = validateUpdateBooking({ action: "confirm", start: null, end: null });
  assert.equal(result.ok, true);
});

test("validateUpdateBooking: cancel needs no start/end", () => {
  const result = validateUpdateBooking({ action: "cancel", start: null, end: null });
  assert.equal(result.ok, true);
});

test("validateUpdateBooking: reschedule requires a valid, real window", () => {
  const now = new Date("2026-08-15T09:00:00Z");
  const result = validateUpdateBooking({ action: "reschedule", start: "2026-08-16T09:00:00Z", end: "2026-08-16T10:00:00Z" }, now);
  assert.equal(result.ok, true);
});

test("validateUpdateBooking: reschedule with missing start/end is rejected", () => {
  assert.equal(validateUpdateBooking({ action: "reschedule", start: null, end: null }).ok, false);
});

test("validateUpdateBooking: an unrecognised action is rejected", () => {
  assert.equal(validateUpdateBooking({ action: "delete", start: null, end: null }).ok, false);
});

// ---------------------------------------------------------------------
// escalate_to_owner

test("validateEscalateToOwner: a real reason is accepted", () => {
  const result = validateEscalateToOwner({ reason: "Customer describes water coming through the ceiling." });
  assert.equal(result.ok, true);
});

test("validateEscalateToOwner: an empty or missing reason is rejected", () => {
  assert.equal(validateEscalateToOwner({ reason: "" }).ok, false);
  assert.equal(validateEscalateToOwner({ reason: "   " }).ok, false);
  assert.equal(validateEscalateToOwner({}).ok, false);
});

test("validateEscalateToOwner: a non-string reason is rejected", () => {
  assert.equal(validateEscalateToOwner({ reason: 42 }).ok, false);
});
