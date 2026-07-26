import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHandoverRecap, THE_PROMISE, type HandoverInput } from "./receptionist-handover";
import { defaultAvailability } from "./availability";

const EMPTY_KNOWLEDGE = {
  personality: [],
  jobsDeclined: [],
  guarantees: [],
  paymentMethods: [],
  certifications: [],
  parkingAccess: "",
  emergencyNotes: "",
};

function baseInput(overrides: Partial<HandoverInput> = {}): HandoverInput {
  return {
    businessName: "Test Plumbing",
    trade: "plumber",
    receptionistName: "Office",
    services: [],
    serviceAreas: [],
    openingTime: "08:00",
    closingTime: "17:30",
    availability: defaultAvailability("08:00", "17:30"),
    offersEmergencyCallouts: false,
    chargesCalloutFee: false,
    calloutFeeAmount: null,
    systemPrompt: "",
    businessRules: "",
    escalationRules: "",
    faqCount: 0,
    knowledge: EMPTY_KNOWLEDGE,
    ...overrides,
  };
}

test("readiness: empty with nothing taught at all", () => {
  const recap = buildHandoverRecap(baseInput());
  assert.equal(recap.readiness, "empty");
});

test("readiness: partial when business knowledge is taught but the receptionist hasn't been — this is exactly the gap that used to let an owner reach Test Conversations before it could actually reply", () => {
  const recap = buildHandoverRecap(baseInput({ services: ["Boiler repair"], serviceAreas: ["Manchester"] }));
  assert.equal(recap.readiness, "partial");
});

test("readiness: ready only once business knowledge AND all three receptionist topics are taught — matching the Reply Engine's own Readiness Gate exactly", () => {
  const recap = buildHandoverRecap(
    baseInput({
      services: ["Boiler repair"],
      serviceAreas: ["Manchester"],
      systemPrompt: "Always confirm the customer's address.",
      businessRules: "Never agree to same-day emergency call-outs after 6pm.",
      escalationRules: "Come get me if someone mentions an insurance claim.",
    })
  );
  assert.equal(recap.readiness, "ready");
});

test("honest gap for what I should always do, when behaviours have never been taught", () => {
  const recap = buildHandoverRecap(baseInput());
  assert.ok(recap.gaps.some((g) => g.includes("what I should always do")));
});

test("behaviours taught surface as understood, quoted verbatim", () => {
  const recap = buildHandoverRecap(baseInput({ systemPrompt: "Always ask for the postcode first." }));
  assert.ok(recap.understood.some((l) => l.includes("Always ask for the postcode first.")));
});

test("never invents a call-out fee amount that wasn't stored", () => {
  const recap = buildHandoverRecap(baseInput({ chargesCalloutFee: true, calloutFeeAmount: null }));
  assert.ok(recap.understood.some((l) => l === "You charge a call-out fee."));
  assert.ok(!recap.understood.some((l) => /£|amount/i.test(l)));
  assert.ok(recap.gaps.some((g) => g.includes("don't have the amount")));
});

test("states a real call-out fee amount when one exists", () => {
  const recap = buildHandoverRecap(baseInput({ chargesCalloutFee: true, calloutFeeAmount: "£45" }));
  assert.ok(recap.understood.some((l) => l.includes("£45")));
});

test("untouched default hours: weekday line plus an honest weekend gap", () => {
  const recap = buildHandoverRecap(baseInput());
  assert.ok(recap.understood.some((l) => l === "You're open 08:00–17:30, Monday to Friday."));
  assert.ok(recap.gaps.some((g) => g === "I don't yet know your weekend availability."));
});

test("real weekend hours: no weekend gap, real hours shown instead", () => {
  const availability = defaultAvailability("08:00", "17:30");
  availability.hours.sat = { closed: false, open: "09:00", close: "13:00" };
  const recap = buildHandoverRecap(baseInput({ availability }));
  assert.ok(!recap.gaps.some((g) => g.includes("weekend")));
  assert.ok(recap.understood.some((l) => l.includes("Saturday")));
});

test("surfaces personality, certifications, and emergency notes when taught", () => {
  const recap = buildHandoverRecap(
    baseInput({
      knowledge: {
        ...EMPTY_KNOWLEDGE,
        personality: ["Family business", "Fully insured"],
        certifications: ["Gas Safe registered"],
        emergencyNotes: "Only for burst pipes or no heating.",
      },
    })
  );
  assert.ok(recap.understood.some((l) => l.includes("Family business")));
  assert.ok(recap.understood.some((l) => l.includes("Gas Safe registered")));
  assert.ok(recap.understood.some((l) => l.includes("burst pipes")));
});

test("honest gaps for house rules and escalation rules when never taught", () => {
  const recap = buildHandoverRecap(baseInput());
  assert.ok(recap.gaps.some((g) => g.includes("house rules")));
  assert.ok(recap.gaps.some((g) => g.includes("bring you in")));
});

test("the Promise is fixed, three lines, never derived from business data", () => {
  assert.equal(THE_PROMISE.length, 3);
  assert.ok(THE_PROMISE.every((line) => typeof line === "string" && line.length > 0));
});

/* -------- Product Guarantee 1: never invent a business fact -------- */

test("unconfirmed emergency call-outs (null) is an honest gap, never a claim either way", () => {
  const recap = buildHandoverRecap(baseInput({ offersEmergencyCallouts: null }));
  assert.ok(!recap.understood.some((l) => /emergency call-out/i.test(l)));
  assert.ok(recap.gaps.some((g) => /emergency call-out/i.test(g)));
});

test("unconfirmed call-out fee (null) is an honest gap, never a claim either way", () => {
  const recap = buildHandoverRecap(baseInput({ chargesCalloutFee: null }));
  assert.ok(!recap.understood.some((l) => /call-out fee/i.test(l)));
  assert.ok(recap.gaps.some((g) => /call-out fee/i.test(g)));
});

test("explicitly confirmed false is stated as a real fact, not a gap", () => {
  const recap = buildHandoverRecap(baseInput({ offersEmergencyCallouts: false, chargesCalloutFee: false }));
  assert.ok(recap.understood.some((l) => l === "You don't take on emergency call-outs."));
  assert.ok(recap.understood.some((l) => l === "You don't charge a call-out fee."));
});

test("explicitly confirmed true is stated as a real fact", () => {
  const recap = buildHandoverRecap(baseInput({ offersEmergencyCallouts: true }));
  assert.ok(recap.understood.some((l) => l === "You take on emergency call-outs."));
});
