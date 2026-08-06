import { test } from "node:test";
import assert from "node:assert/strict";
import { collectFacts } from "./facts";
import { EMPTY_CONVERSATION_STATE } from "../understanding/state";
import type { ReplyContext, BusinessProfileContext } from "../context/types";
import type { UnderstandingResult } from "../understanding/types";

/**
 * Coaching Implementation Plan, C5: these replace lib/receptionist.test.ts,
 * which only ever tested the now-retired simulator (buildPreviewConversation).
 * Product Guarantee 1 — never invent a business fact — is real, safety-
 * relevant behaviour, so its test coverage moves here, onto the actual
 * mechanism the one real reasoning engine uses (collectFacts), rather
 * than disappearing along with the fake one.
 */

const BASE_PROFILE: BusinessProfileContext = {
  businessName: "Test Plumbing",
  trade: "plumbing",
  description: null,
  services: [],
  serviceAreas: [],
  openingTime: "08:00",
  closingTime: "17:30",
  offersEmergencyCallouts: null,
  chargesCalloutFee: null,
  calloutFeeAmount: null,
  receptionistName: null,
  knowledge: {
    personality: [],
    jobsDeclined: [],
    guarantees: [],
    paymentMethods: [],
    certifications: [],
    parkingAccess: "",
    emergencyNotes: "",
    memories: [],
  },
};

function contextWith(overrides: Partial<BusinessProfileContext>): ReplyContext {
  return {
    businessProfile: { ...BASE_PROFILE, ...overrides },
    receptionist: null,
    diary: null,
    customerMemory: null,
    conversationHistory: null,
    customerJobs: null,
    currentBooking: null,
    newMessage: { body: "test", customerName: null, customerPhone: "" },
  };
}

const UNDERSTANDING: UnderstandingResult = {
  primaryIntent: "EMERGENCY",
  secondaryIntents: [],
  confidence: "high",
  patternEntities: { phoneNumbers: [], postcodes: [], emails: [], explicitDates: [] },
  meaningEntities: { urgency: "urgent", impliedJobType: null, sentiment: "neutral" },
  safetyTag: null,
  conversationState: EMPTY_CONVERSATION_STATE,
};

function emergencyFactText(context: ReplyContext): string {
  const fact = collectFacts(context, UNDERSTANDING).find((f) => f.id === "profile.emergency_callouts");
  assert.ok(fact, "expected a profile.emergency_callouts fact");
  return fact.text;
}

function calloutFeeFactText(context: ReplyContext): string {
  const fact = collectFacts(context, UNDERSTANDING).find((f) => f.id === "profile.callout_fee");
  assert.ok(fact, "expected a profile.callout_fee fact");
  return fact.text;
}

test("unconfirmed emergency call-outs (null) is an honest gap, never a claim either way", () => {
  const text = emergencyFactText(contextWith({ offersEmergencyCallouts: null }));
  assert.ok(!/^offers emergency call-outs\.?$/i.test(text));
  assert.ok(/never tell the customer yes or no/i.test(text));
});

test("explicitly declined emergency call-outs (false) states the real fact, not a gap", () => {
  const text = emergencyFactText(contextWith({ offersEmergencyCallouts: false }));
  assert.equal(text, "Does not offer emergency call-outs.");
});

test("explicitly confirmed emergency call-outs (true) states the real fact", () => {
  const text = emergencyFactText(contextWith({ offersEmergencyCallouts: true }));
  assert.equal(text, "Offers emergency call-outs.");
});

test("unconfirmed call-out fee (null) is an honest gap, never a claim either way", () => {
  const text = calloutFeeFactText(contextWith({ chargesCalloutFee: null }));
  assert.ok(/never tell the customer yes or no/i.test(text));
});

test("a real call-out fee amount is stated once genuinely taught", () => {
  const text = calloutFeeFactText(contextWith({ chargesCalloutFee: true, calloutFeeAmount: "£60" }));
  assert.ok(text.includes("£60"));
});
