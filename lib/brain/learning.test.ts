import { test } from "node:test";
import assert from "node:assert/strict";
import { isLearningCandidate } from "./learning";

test("identical text is never a candidate", () => {
  assert.equal(isLearningCandidate("We don't offer emergency callouts.", "We don't offer emergency callouts."), false);
});

test("a punctuation-only change is never a candidate", () => {
  assert.equal(isLearningCandidate("Sure, I can help with that", "Sure, I can help with that."), false);
});

test("a single-word tone tweak in an otherwise long, unchanged reply is never a candidate", () => {
  assert.equal(
    isLearningCandidate(
      "Thanks for getting in touch about your boiler issue, we can definitely help you out with that",
      "Thanks for getting in touch about your boiler issue, we can certainly help you out with that"
    ),
    false
  );
});

test("a short exchange never reaches the threshold check, regardless of change fraction", () => {
  assert.equal(isLearningCandidate("ok", "okay!"), false);
});

test("a substantial rewrite that changes the actual claim is a candidate", () => {
  assert.equal(
    isLearningCandidate(
      "We don't offer emergency callouts, sorry about that.",
      "We do offer emergency callouts, but there's a £50 fee after 6pm."
    ),
    true
  );
});

test("empty original or edited text is never a candidate", () => {
  assert.equal(isLearningCandidate("", "We do offer emergency callouts."), false);
  assert.equal(isLearningCandidate("We don't offer emergency callouts.", ""), false);
});

test("reordering the same words is not counted as a substantial change", () => {
  assert.equal(
    isLearningCandidate("We can visit Tuesday or Wednesday this week", "We can visit Wednesday or Tuesday this week"),
    false
  );
});
