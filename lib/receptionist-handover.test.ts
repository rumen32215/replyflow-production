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

test("readiness: ready once services and areas are both taught", () => {
  const recap = buildHandoverRecap(baseInput({ services: ["Boiler repair"], serviceAreas: ["Manchester"] }));
  assert.equal(recap.readiness, "ready");
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
