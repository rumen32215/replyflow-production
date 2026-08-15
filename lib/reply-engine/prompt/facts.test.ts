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
    photoAnalysis: null,
    toolResults: [],
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
  episodeContinuity: "same_job",
  bookingAcceptance: "none",
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

test("datetime.now is always present, first, and states the real Europe/London time (ReplyFlow V4)", () => {
  const facts = collectFacts(contextWith({}), UNDERSTANDING);
  assert.equal(facts[0]?.id, "datetime.now");
  assert.match(facts[0]?.text ?? "", /Europe\/London/);
});

test("photo analysis produces no facts when the message wasn't a photo (Phase B)", () => {
  const context = contextWith({});
  const facts = collectFacts(context, UNDERSTANDING);
  assert.ok(!facts.some((f) => f.id.startsWith("photo.")));
});

test("a photo's visible/possible/unknown analysis each become their own citable fact (Phase B)", () => {
  const context: ReplyContext = {
    ...contextWith({}),
    photoAnalysis: { visible: "Water pooling under the sink", possible: "May be a loose pipe connection", unknown: "The exact cause without an in-person look" },
  };
  const facts = collectFacts(context, UNDERSTANDING);
  const visible = facts.find((f) => f.id === "photo.visible");
  const possible = facts.find((f) => f.id === "photo.possible");
  const unknown = facts.find((f) => f.id === "photo.unknown");
  assert.ok(visible?.text.includes("Water pooling under the sink"));
  assert.ok(possible?.text.includes("May be a loose pipe connection"));
  assert.ok(possible?.text.toLowerCase().includes("not certain"), "possible fact must be explicitly hedged");
  assert.ok(unknown?.text.includes("The exact cause without an in-person look"));
});

// ---------------------------------------------------------------------
// Tool-result facts (Plumber Reset Phase 3 step 4)

function contextWithTools(toolResults: ReplyContext["toolResults"]): ReplyContext {
  return { ...contextWith({}), toolResults };
}

test("no tool results produce no tool.* facts", () => {
  const facts = collectFacts(contextWithTools([]), UNDERSTANDING);
  assert.ok(!facts.some((f) => f.id.startsWith("tool.")));
});

test("a proposed booking is never phrased as confirmed", () => {
  const context = contextWithTools([
    { name: "create_booking", result: { ok: true, data: { start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T10:00:00.000Z", status: "proposed" } } },
  ]);
  const fact = collectFacts(context, UNDERSTANDING).find((f) => f.id === "tool.create_booking.0")!;
  assert.ok(/not yet confirmed/i.test(fact.text));
  assert.ok(!/you may tell the customer they're booked/i.test(fact.text));
});

test("a confirmed booking may genuinely be told to the customer as booked", () => {
  const context = contextWithTools([
    { name: "update_booking", result: { ok: true, data: { start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T10:00:00.000Z", status: "confirmed" } } },
  ]);
  const fact = collectFacts(context, UNDERSTANDING).find((f) => f.id === "tool.update_booking.0")!;
  assert.ok(/you may tell the customer they're booked/i.test(fact.text));
});

test("a booking conflict explicitly forbids claiming success and offers only real alternatives", () => {
  const context = contextWithTools([
    { name: "create_booking", result: { ok: false, reason: "conflict", alternatives: [{ start: "2026-09-02T13:00:00.000Z", end: "2026-09-02T14:00:00.000Z" }] } },
  ]);
  const fact = collectFacts(context, UNDERSTANDING).find((f) => f.id === "tool.create_booking.0")!;
  assert.ok(/do not tell the customer it's booked or moved/i.test(fact.text));
  assert.ok(fact.text.includes("2026") || /alternative times/i.test(fact.text));
});

test("a tool execution failure explicitly forbids telling the customer it succeeded", () => {
  const context = contextWithTools([{ name: "create_booking", result: { ok: false, reason: "execution_failed" } }]);
  const fact = collectFacts(context, UNDERSTANDING).find((f) => f.id === "tool.create_booking.0")!;
  assert.ok(/do not tell the customer it succeeded/i.test(fact.text));
});

test("no real availability found never invents a time", () => {
  const context = contextWithTools([{ name: "check_availability", result: { ok: true, data: { slots: [] } } }]);
  const fact = collectFacts(context, UNDERSTANDING).find((f) => f.id === "tool.check_availability.0")!;
  assert.ok(/do not invent a time/i.test(fact.text));
});

test("real availability slots are listed exactly, with an instruction to offer only those", () => {
  const context = contextWithTools([
    { name: "check_availability", result: { ok: true, data: { slots: [{ start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T10:00:00.000Z" }] } } },
  ]);
  const fact = collectFacts(context, UNDERSTANDING).find((f) => f.id === "tool.check_availability.0")!;
  assert.ok(/and only these/i.test(fact.text));
});

test("no prior customer history is honestly reported, never a fabricated memory", () => {
  const context = contextWithTools([{ name: "get_customer_context", result: { ok: true, data: { customer: null, recentJobs: [] } } }]);
  const fact = collectFacts(context, UNDERSTANDING).find((f) => f.id === "tool.get_customer_context.0")!;
  assert.ok(/treat them as new/i.test(fact.text));
  assert.ok(/do not claim to remember/i.test(fact.text));
});

test("a genuine cancellation may be told to the customer as cancelled", () => {
  const context = contextWithTools([
    { name: "update_booking", result: { ok: true, data: { start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T10:00:00.000Z", status: "cancelled" } } },
  ]);
  const fact = collectFacts(context, UNDERSTANDING).find((f) => f.id === "tool.update_booking.0")!;
  assert.ok(/genuinely just been cancelled/i.test(fact.text));
});

test("an escalation tool result instructs the model not to attempt to resolve it itself", () => {
  const context = contextWithTools([{ name: "escalate_to_owner", result: { ok: true, data: { reason: "Ambiguous request" } } }]);
  const fact = collectFacts(context, UNDERSTANDING).find((f) => f.id === "tool.escalate_to_owner.0")!;
  assert.ok(/do not attempt to resolve it yourself/i.test(fact.text));
});

test("the build.ts system block only mentions tool-result facts when at least one is present", async () => {
  const { buildPrompt } = await import("./build");
  const withoutTools = buildPrompt(contextWithTools([]), UNDERSTANDING);
  const systemWithout = withoutTools.messages[0]!.content as string;
  assert.ok(!systemWithout.includes("Tool-result facts"));

  const withTools = buildPrompt(
    contextWithTools([{ name: "escalate_to_owner", result: { ok: true, data: { reason: "test" } } }]),
    UNDERSTANDING
  );
  const systemWith = withTools.messages[0]!.content as string;
  assert.ok(systemWith.includes("Tool-result facts"));
});
