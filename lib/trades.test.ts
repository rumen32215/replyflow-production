import { test } from "node:test";
import assert from "node:assert/strict";
import { intakeGuidanceForTrade } from "./trades";

test("plumbing has real intake guidance (Phase B, plumber-first)", () => {
  const guidance = intakeGuidanceForTrade("plumbing");
  assert.ok(guidance);
  assert.ok(guidance.toLowerCase().includes("flooding"));
});

test("a trade with no guidance yet returns null, never invented content", () => {
  assert.equal(intakeGuidanceForTrade("electrical"), null);
  assert.equal(intakeGuidanceForTrade("roofing"), null);
});

test("unrecognised/missing trade falls back to general, which also has no guidance", () => {
  assert.equal(intakeGuidanceForTrade("something made up"), null);
  assert.equal(intakeGuidanceForTrade(null), null);
  assert.equal(intakeGuidanceForTrade(undefined), null);
});
