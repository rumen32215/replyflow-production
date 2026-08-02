import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOwnerTrust, groupDecisionCategory, type OwnerTrustCategoryInput } from "./trust";

function category(overrides: Partial<OwnerTrustCategoryInput> = {}): OwnerTrustCategoryInput {
  return {
    category: "general",
    label: "General questions",
    unchangedCount: 0,
    editedCount: 0,
    rejectedCount: 0,
    ...overrides,
  };
}

test("zero resolved drafts reports honestly, no stage", () => {
  const [result] = computeOwnerTrust([category()]);
  assert.equal(result!.stage, null);
  assert.equal(result!.sampleSize, 0);
  assert.match(result!.reason, /no resolved replies/i);
});

test("below the minimum sample size reports honestly, no stage", () => {
  const [result] = computeOwnerTrust([category({ unchangedCount: 2, editedCount: 1 })]);
  assert.equal(result!.stage, null);
  assert.equal(result!.sampleSize, 3);
  assert.match(result!.reason, /not enough/i);
});

test("a low unchanged rate at real sample size lands on Help", () => {
  const [result] = computeOwnerTrust([category({ unchangedCount: 1, editedCount: 4, rejectedCount: 0 })]);
  assert.equal(result!.stage, "help");
});

test("a near-perfect unchanged rate lands on Operate quietly", () => {
  const [result] = computeOwnerTrust([category({ unchangedCount: 19, editedCount: 1, rejectedCount: 0 })]);
  assert.equal(result!.stage, "operate_quietly");
});

test("a solid but imperfect rate lands on Handle routine work, not the top stage", () => {
  const [result] = computeOwnerTrust([category({ unchangedCount: 17, editedCount: 3, rejectedCount: 0 })]);
  assert.equal(result!.stage, "handle_routine_work");
});

test("a middling rate lands on Prepare", () => {
  const [result] = computeOwnerTrust([category({ unchangedCount: 7, editedCount: 3, rejectedCount: 0 })]);
  assert.equal(result!.stage, "prepare");
});

test("rejections count against the unchanged rate exactly like edits", () => {
  const [result] = computeOwnerTrust([category({ unchangedCount: 1, editedCount: 0, rejectedCount: 4 })]);
  assert.equal(result!.stage, "help");
});

test("the reason names real counts, never a percentage", () => {
  const [result] = computeOwnerTrust([category({ unchangedCount: 8, editedCount: 2, rejectedCount: 0 })]);
  assert.ok(!result!.reason.includes("%"));
  assert.match(result!.reason, /8 of your last 10/);
});

test("groupDecisionCategory maps every real decision-categories.ts value to one of the five owner-facing groups", () => {
  assert.equal(groupDecisionCategory("booking"), "booking");
  assert.equal(groupDecisionCategory("change_booking"), "booking");
  assert.equal(groupDecisionCategory("cancellation"), "booking");
  assert.equal(groupDecisionCategory("returning_problem"), "booking");
  assert.equal(groupDecisionCategory("payment"), "quotes");
  assert.equal(groupDecisionCategory("pricing"), "quotes");
  assert.equal(groupDecisionCategory("complaint"), "complaints");
  assert.equal(groupDecisionCategory("emergency"), "emergencies");
  assert.equal(groupDecisionCategory("general"), "general");
});

test("groupDecisionCategory falls back to general for any unrecognised value, never throws", () => {
  assert.equal(groupDecisionCategory("something_new"), "general");
});

test("multiple categories are computed independently", () => {
  const results = computeOwnerTrust([
    category({ category: "general", unchangedCount: 19, editedCount: 1 }),
    category({ category: "pricing", unchangedCount: 0, editedCount: 0, rejectedCount: 0 }),
  ]);
  assert.equal(results.length, 2);
  assert.equal(results[0]!.stage, "operate_quietly");
  assert.equal(results[1]!.stage, null);
});
