import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCostUsd } from "./pricing";

test("estimates cost for a known model from its per-token pricing", () => {
  // gpt-4o-mini: $0.15/1M input, $0.60/1M output.
  const cost = estimateCostUsd("gpt-4o-mini", 1_000_000, 1_000_000);
  assert.ok(cost !== null);
  assert.ok(Math.abs(cost! - 0.75) < 1e-9);
});

test("scales linearly with token count", () => {
  const cost = estimateCostUsd("gpt-4o-mini", 500, 200);
  assert.ok(cost !== null);
  assert.ok(Math.abs(cost! - (500 * (0.15 / 1_000_000) + 200 * (0.6 / 1_000_000))) < 1e-12);
});

test("zero tokens costs zero, not null", () => {
  assert.equal(estimateCostUsd("gpt-4o-mini", 0, 0), 0);
});

test("an unrecognised model returns null rather than a guessed cost", () => {
  assert.equal(estimateCostUsd("some-future-model", 1000, 1000), null);
});
