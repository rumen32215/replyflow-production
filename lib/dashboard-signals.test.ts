import { test } from "node:test";
import assert from "node:assert/strict";
import { sequentialSetupSteps } from "./dashboard-signals";

/* -------- Release polish: Setup Journey checklist step order -------- */

test("all steps genuinely done in order all display as done", () => {
  const result = sequentialSetupSteps([{ done: true }, { done: true }, { done: true }]);
  assert.deepEqual(result.map((s) => s.displayDone), [true, true, true]);
});

test("a later step done out of order does not display as done until earlier ones are", () => {
  // Business and Receptionist not yet taught, but WhatsApp already
  // connected — the exact reproduced Polish Pass finding.
  const result = sequentialSetupSteps([{ done: false }, { done: false }, { done: true }]);
  assert.deepEqual(result.map((s) => s.displayDone), [false, false, false]);
});

test("a real, honest partial prefix displays correctly", () => {
  const result = sequentialSetupSteps([{ done: true }, { done: true }, { done: false }, { done: true }]);
  assert.deepEqual(result.map((s) => s.displayDone), [true, true, false, false]);
});

test("a gap in the middle blocks every step after it, even genuinely done ones", () => {
  const result = sequentialSetupSteps([{ done: true }, { done: false }, { done: true }, { done: true }]);
  assert.deepEqual(result.map((s) => s.displayDone), [true, false, false, false]);
});

test("never mutates the real done flag, only adds displayDone", () => {
  const input = [{ done: false }, { done: true }];
  const result = sequentialSetupSteps(input);
  const second = result[1];
  assert.ok(second);
  assert.equal(second.done, true);
  assert.equal(second.displayDone, false);
});
