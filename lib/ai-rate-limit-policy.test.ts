import { test } from "node:test";
import assert from "node:assert/strict";
import { isOverLimit, MAX_EVENTS_PER_WINDOW } from "./ai-rate-limit-policy";

test("under the threshold is not limited", () => {
  assert.equal(isOverLimit(MAX_EVENTS_PER_WINDOW - 1), false);
});

test("exactly at the threshold is limited", () => {
  assert.equal(isOverLimit(MAX_EVENTS_PER_WINDOW), true);
});

test("well over the threshold is limited", () => {
  assert.equal(isOverLimit(MAX_EVENTS_PER_WINDOW * 10), true);
});

test("zero recent events is never limited", () => {
  assert.equal(isOverLimit(0), false);
});

test("the threshold comfortably tolerates several full teaching-page bursts (8 events each)", () => {
  // Real telemetry: one debounced edit on the Receptionist teaching
  // page fires 8 real completion calls (1 main + 3 tone examples, each
  // classify+generate). The limit must not trip on a handful of these
  // within its window, or normal teaching would break.
  const TEACHING_BURST_SIZE = 8;
  const fiveBursts = TEACHING_BURST_SIZE * 5;
  assert.equal(isOverLimit(fiveBursts), false);
});
