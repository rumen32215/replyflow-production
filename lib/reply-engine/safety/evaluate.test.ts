import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateSafety } from "./evaluate";
import { EMPTY_CONVERSATION_STATE } from "../understanding/state";
import type { UnderstandingResult, Intent } from "../understanding/types";
import type { GenerationResult } from "../prompt/types";
import type { Fact } from "../prompt/facts";

function baseUnderstanding(overrides: Partial<UnderstandingResult> = {}): UnderstandingResult {
  return {
    primaryIntent: "BUSINESS_INFORMATION",
    secondaryIntents: [],
    confidence: "high",
    patternEntities: { phoneNumbers: [], postcodes: [], emails: [], explicitDates: [] },
    meaningEntities: { urgency: "none", impliedJobType: null, sentiment: "neutral" },
    safetyTag: null,
    conversationState: EMPTY_CONVERSATION_STATE,
    ...overrides,
  };
}

function baseGeneration(overrides: Partial<GenerationResult> = {}): GenerationResult {
  return {
    draftReply: "Thanks for your message!",
    confidence: "high",
    requiresEscalation: false,
    escalationReason: null,
    factsUsed: [],
    noReplyNeeded: false,
    asksQuestion: null,
    resolvesCommitments: [],
    ...overrides,
  };
}

const PAYMENT_FACT: Fact = { id: "profile.payment.0", text: "Accepts payment by: Cash." };

/* -------- Product Guarantee 2: always use known facts -------- */

test("a payment question ignoring a taught payment fact fails grounding and escalates", () => {
  const result = evaluateSafety({
    understanding: baseUnderstanding({ primaryIntent: "PAYMENT_QUERY" as Intent }),
    generation: baseGeneration({ draftReply: "Let me check and get back to you.", factsUsed: [] }),
    facts: [PAYMENT_FACT],
  });
  assert.equal(result.groundingFailed, true);
  assert.equal(result.requiresEscalation, true);
  assert.ok(result.reasons.some((r) => /payment methods/i.test(r)));
});

test("a payment question that correctly cites the taught fact passes", () => {
  const result = evaluateSafety({
    understanding: baseUnderstanding({ primaryIntent: "PAYMENT_QUERY" as Intent }),
    generation: baseGeneration({ draftReply: "Yes, we take cash!", factsUsed: ["profile.payment.0"] }),
    facts: [PAYMENT_FACT],
  });
  assert.equal(result.groundingFailed, false);
  assert.equal(result.requiresEscalation, false);
});

test("a payment question with no taught payment methods at all is not penalised", () => {
  const result = evaluateSafety({
    understanding: baseUnderstanding({ primaryIntent: "PAYMENT_QUERY" as Intent }),
    generation: baseGeneration({ draftReply: "I'll need to check with the owner on that.", factsUsed: [] }),
    facts: [],
  });
  assert.equal(result.groundingFailed, false);
});

test("a secondary PAYMENT_QUERY intent is caught, not just the primary one", () => {
  const result = evaluateSafety({
    understanding: baseUnderstanding({ primaryIntent: "BOOKING_REQUEST", secondaryIntents: ["PAYMENT_QUERY"] }),
    generation: baseGeneration({ draftReply: "Sure, I can book that in for you.", factsUsed: [] }),
    facts: [PAYMENT_FACT],
  });
  assert.equal(result.groundingFailed, true);
});

test("a non-payment question is unaffected by taught payment facts", () => {
  const result = evaluateSafety({
    understanding: baseUnderstanding({ primaryIntent: "BUSINESS_INFORMATION" }),
    generation: baseGeneration({ draftReply: "We're open 8 to 5:30, Monday to Friday.", factsUsed: [] }),
    facts: [PAYMENT_FACT],
  });
  assert.equal(result.groundingFailed, false);
  assert.equal(result.requiresEscalation, false);
});
