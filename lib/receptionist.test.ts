import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPreviewConversation, type PreviewKnowledge, type PreviewScenario } from "./receptionist";

const EMERGENCY_SCENARIO: PreviewScenario = {
  id: "boiler-leak",
  label: "Boiler leaking",
  customerMessage: "Hi, my boiler's leaking water from underneath — can someone come out?",
  kind: "emergency",
};

function baseKnowledge(overrides: Partial<PreviewKnowledge> = {}): PreviewKnowledge {
  return {
    businessName: "Test Plumbing",
    tone: "friendly",
    behaviours: new Set<string>(),
    rules: new Set<string>(),
    escalation: new Set<string>(),
    offersEmergency: null,
    chargesCalloutFee: null,
    calloutFeeAmount: null,
    ...overrides,
  };
}

function replyText(k: PreviewKnowledge, scenario: PreviewScenario = EMERGENCY_SCENARIO): string {
  const reply = buildPreviewConversation(k, scenario).turns[2];
  assert.ok(reply);
  return reply.text;
}

/* -------- Product Guarantee 1: never invent a business fact -------- */

test("unconfirmed emergency call-outs (null) never claims the service is offered", () => {
  const reply = replyText(baseKnowledge({ offersEmergency: null }));
  assert.ok(!/we do offer emergency call-outs/i.test(reply));
});

test("explicitly declined emergency call-outs (false) never claims the service is offered", () => {
  const reply = replyText(baseKnowledge({ offersEmergency: false }));
  assert.ok(!/we do offer emergency call-outs/i.test(reply));
});

test("explicitly confirmed emergency call-outs (true) does state the fact", () => {
  const reply = replyText(baseKnowledge({ offersEmergency: true }));
  assert.ok(/we do offer emergency call-outs/i.test(reply));
});

test("the 'mention emergency' behaviour cannot override an unconfirmed fact on a standard enquiry", () => {
  const standard: PreviewScenario = {
    id: "no-hot-water",
    label: "No hot water",
    customerMessage: "We've had no hot water since this morning, can you help?",
    kind: "standard",
  };
  const reply = replyText(
    baseKnowledge({ offersEmergency: null, behaviours: new Set(["mention-emergency"]) }),
    standard
  );
  assert.ok(!/we do offer emergency call-outs/i.test(reply));
});

test("the 'mention emergency' behaviour states the fact once explicitly confirmed true", () => {
  const standard: PreviewScenario = {
    id: "no-hot-water",
    label: "No hot water",
    customerMessage: "We've had no hot water since this morning, can you help?",
    kind: "standard",
  };
  const reply = replyText(
    baseKnowledge({ offersEmergency: true, behaviours: new Set(["mention-emergency"]) }),
    standard
  );
  assert.ok(/we do offer emergency call-outs/i.test(reply));
});
