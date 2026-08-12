import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

/**
 * Regression coverage for a real live-test finding: gpt-4o-mini
 * sometimes emits the literal string "null" for escalation_reason
 * (occasionally with whitespace or different casing) instead of using
 * the JSON schema's actual null option (build.ts already declares it
 * type: ["string", "null"]). Left unnormalized, that string is truthy,
 * so evaluate.ts's `generation.escalationReason ?? reasons[0]` fallback
 * picked it over a real deterministic backstop reason (deposit,
 * reschedule, payment) — the owner saw the literal word "null" in the
 * escalation banner instead of an explanation.
 */

// "server-only" throws unconditionally when required outside Next's own
// build pipeline (by design, as a guard) — harmless to no-op here.
mock.module("server-only", { namedExports: {} });

let toGenerationResult: (typeof import("./generate"))["toGenerationResult"];
before(async () => {
  ({ toGenerationResult } = await import("./generate"));
});

function rawGeneration(overrides: Record<string, unknown> = {}) {
  return {
    draft_reply: "Sure, happy to help with that.",
    confidence: "high",
    requires_escalation: true,
    escalation_reason: "null",
    facts_used: [],
    no_reply_needed: false,
    asks_question: null,
    resolves_commitments: [],
    ...overrides,
  };
}

test("1. escalation_reason: \"null\" normalizes to real null", () => {
  const result = toGenerationResult(rawGeneration({ escalation_reason: "null" }));
  assert.equal(result.escalationReason, null);
});

test("1b. whitespace/case variants of the literal null string also normalize to null", () => {
  for (const variant of [" NULL ", "Null", "\tnull\n", "NULL"]) {
    const result = toGenerationResult(rawGeneration({ escalation_reason: variant }));
    assert.equal(result.escalationReason, null, `expected ${JSON.stringify(variant)} to normalize to null`);
  }
});

test("2. empty/whitespace escalation_reason normalizes to null", () => {
  for (const variant of ["", "   ", "\n\t"]) {
    const result = toGenerationResult(rawGeneration({ escalation_reason: variant }));
    assert.equal(result.escalationReason, null, `expected ${JSON.stringify(variant)} to normalize to null`);
  }
});

test("a real, non-empty escalation reason is preserved exactly as given", () => {
  const reason = "This customer is asking about a refund — needs a human.";
  const result = toGenerationResult(rawGeneration({ escalation_reason: reason }));
  assert.equal(result.escalationReason, reason);
});

test("an actual JSON null escalation_reason stays null", () => {
  const result = toGenerationResult(rawGeneration({ escalation_reason: null }));
  assert.equal(result.escalationReason, null);
});

test("a missing escalation_reason field stays null", () => {
  const raw = rawGeneration();
  delete (raw as Record<string, unknown>).escalation_reason;
  const result = toGenerationResult(raw);
  assert.equal(result.escalationReason, null);
});
