import { test } from "node:test";
import assert from "node:assert/strict";
import { describeWorkCardState, isActiveWorkCardStatus, computeJobReadiness, simplifiedWorkCardStatus } from "./work-card-state";
import { EMPTY_CONVERSATION_STATE } from "./reply-engine/understanding/state";
import type { Commitment } from "./reply-engine/understanding/state";

function base(overrides: Partial<Parameters<typeof describeWorkCardState>[0]> = {}) {
  return {
    status: "booked",
    addressConfirmed: true,
    conversationGroup: null,
    isEmergency: false,
    ...overrides,
  };
}

test("draft always needs approval, regardless of anything else", () => {
  const state = describeWorkCardState(base({ status: "draft" }));
  assert.equal(state.label, "Needs approval");
  assert.equal(state.needsAction, true);
});

test("booked with a confirmed address is just Booked", () => {
  const state = describeWorkCardState(base({ status: "booked", addressConfirmed: true }));
  assert.equal(state.label, "Booked");
  assert.equal(state.needsAction, false);
});

test("booked without a confirmed address is a soft warning, not a blocker", () => {
  const state = describeWorkCardState(base({ status: "booked", addressConfirmed: false }));
  assert.equal(state.label, "Waiting for address");
  assert.equal(state.tone, "warning");
  assert.equal(state.needsAction, true);
});

test("emergency overrides every other overlay", () => {
  const state = describeWorkCardState(base({ status: "booked", addressConfirmed: false, isEmergency: true }));
  assert.equal(state.label, "Emergency");
});

test("emergency never applies to a completed or cancelled card", () => {
  const completed = describeWorkCardState(base({ status: "completed", isEmergency: true }));
  assert.equal(completed.label, "Completed");
  const cancelled = describeWorkCardState(base({ status: "cancelled", isEmergency: true }));
  assert.equal(cancelled.label, "Cancelled");
});

test("the linked conversation moving back to waiting shows as Customer replied", () => {
  const state = describeWorkCardState(base({ status: "in_progress", conversationGroup: "waiting" }));
  assert.equal(state.label, "Customer replied");
});

test("Customer replied never applies to a draft — that's still Needs approval", () => {
  const state = describeWorkCardState(base({ status: "draft", conversationGroup: "waiting" }));
  assert.equal(state.label, "Needs approval");
});

test("isActiveWorkCardStatus: terminal statuses are not active", () => {
  assert.equal(isActiveWorkCardStatus("completed"), false);
  assert.equal(isActiveWorkCardStatus("cancelled"), false);
  assert.equal(isActiveWorkCardStatus("booked"), true);
  assert.equal(isActiveWorkCardStatus("draft"), true);
});

/* --------------------------- Job-Ready (ReplyFlow V2) --------------------------- */

function outstandingPhotoCommitment(): Commitment {
  return { text: "Asked for a photo of the boiler", kind: "receptionist_question", status: "outstanding" };
}

function readinessBase(overrides: Partial<Parameters<typeof computeJobReadiness>[0]> = {}) {
  return {
    issue: "Boiler leaking",
    address: "SW1A 1AA",
    conversationState: EMPTY_CONVERSATION_STATE,
    hasAnalysedPhoto: false,
    ...overrides,
  };
}

// Scenario G — sufficient information exists, the job SHOULD become ready.
test("ready when issue and postcode are known and nothing is outstanding", () => {
  const result = computeJobReadiness(readinessBase());
  assert.equal(result.ready, true);
});

// Scenario F — insufficient information, the job must NOT become ready.
test("not ready when the issue is still missing", () => {
  const result = computeJobReadiness(readinessBase({ issue: null }));
  assert.equal(result.ready, false);
  assert.equal(result.checklist.find((i) => i.key === "issue")?.status, "outstanding");
});

// Scenario E — postcode missing.
test("not ready when the postcode is still missing", () => {
  const result = computeJobReadiness(readinessBase({ address: null }));
  assert.equal(result.ready, false);
  assert.equal(result.checklist.find((i) => i.key === "postcode")?.status, "outstanding");
});

// Scenario D — postcode already provided.
test("postcode already provided shows as done, not outstanding", () => {
  const result = computeJobReadiness(readinessBase({ address: "EC1A 1BB" }));
  assert.equal(result.checklist.find((i) => i.key === "postcode")?.status, "done");
});

// Scenario B — simple issue where a photo is unnecessary: ready with no photo at all.
test("ready with no photo at all when none was ever asked for", () => {
  const result = computeJobReadiness(readinessBase({ hasAnalysedPhoto: false }));
  assert.equal(result.ready, true);
  assert.equal(result.checklist.find((i) => i.key === "photo")?.status, "not_needed");
});

// Scenario A / C — a photo was asked for and the customer hasn't sent one yet:
// the job must not become ready prematurely.
test("not ready while a requested photo is still outstanding", () => {
  const state = { ...EMPTY_CONVERSATION_STATE, commitments: [outstandingPhotoCommitment()] };
  const result = computeJobReadiness(readinessBase({ conversationState: state }));
  assert.equal(result.ready, false);
  assert.equal(result.checklist.find((i) => i.key === "photo")?.status, "outstanding");
});

test("ready once the requested photo has actually been analysed", () => {
  const state = { ...EMPTY_CONVERSATION_STATE, commitments: [outstandingPhotoCommitment()] };
  const result = computeJobReadiness(readinessBase({ conversationState: state, hasAnalysedPhoto: true }));
  assert.equal(result.ready, true);
  assert.equal(result.checklist.find((i) => i.key === "photo")?.status, "done");
});

test("a resolved photo commitment no longer blocks readiness", () => {
  const state = {
    ...EMPTY_CONVERSATION_STATE,
    commitments: [{ text: "Asked for a photo of the boiler", kind: "receptionist_question" as const, status: "resolved" as const }],
  };
  const result = computeJobReadiness(readinessBase({ conversationState: state }));
  assert.equal(result.ready, true);
});

test("urgency is always informational, never blocks readiness either way", () => {
  const urgent = computeJobReadiness(readinessBase({ conversationState: { ...EMPTY_CONVERSATION_STATE, urgency: "urgent" } }));
  assert.equal(urgent.ready, true);
  assert.equal(urgent.checklist.find((i) => i.key === "urgency")?.label, "Urgent");

  const none = computeJobReadiness(readinessBase({ conversationState: { ...EMPTY_CONVERSATION_STATE, urgency: "none" } }));
  assert.equal(none.ready, true);
  assert.equal(none.checklist.find((i) => i.key === "urgency")?.label, "Not urgent");
});

test("a null conversationState (owner-created card, no linked conversation) never blocks on urgency or photos", () => {
  const result = computeJobReadiness(readinessBase({ conversationState: null }));
  assert.equal(result.ready, true);
  assert.equal(result.checklist.find((i) => i.key === "photo")?.status, "not_needed");
});

test("the AI never gets to claim readiness — an empty issue/address never reports done", () => {
  const result = computeJobReadiness(readinessBase({ issue: "   ", address: "" }));
  assert.equal(result.ready, false);
});

/* ------------------------- simplifiedWorkCardStatus (ReplyFlow V2) ------------------------- */

test("simplifiedWorkCardStatus: completed and cancelled both collapse to done", () => {
  const readiness = computeJobReadiness(readinessBase());
  assert.equal(simplifiedWorkCardStatus("completed", readiness), "done");
  assert.equal(simplifiedWorkCardStatus("cancelled", readiness), "done");
});

test("simplifiedWorkCardStatus: booked and in_progress both collapse to booked", () => {
  const readiness = computeJobReadiness(readinessBase());
  assert.equal(simplifiedWorkCardStatus("booked", readiness), "booked");
  assert.equal(simplifiedWorkCardStatus("in_progress", readiness), "booked");
});

test("simplifiedWorkCardStatus: a draft card with everything gathered is ready_to_quote", () => {
  const readiness = computeJobReadiness(readinessBase());
  assert.equal(readiness.ready, true);
  assert.equal(simplifiedWorkCardStatus("draft", readiness), "ready_to_quote");
});

test("simplifiedWorkCardStatus: a draft card with an issue but missing postcode is gathering_info", () => {
  const readiness = computeJobReadiness(readinessBase({ address: null }));
  assert.equal(simplifiedWorkCardStatus("draft", readiness), "gathering_info");
});

test("simplifiedWorkCardStatus: a draft card with no issue at all is new", () => {
  const readiness = computeJobReadiness(readinessBase({ issue: null, address: null }));
  assert.equal(simplifiedWorkCardStatus("draft", readiness), "new");
});

test("simplifiedWorkCardStatus: booked status wins over readiness — a booked card is never shown as still gathering", () => {
  const readiness = computeJobReadiness(readinessBase({ issue: null, address: null }));
  assert.equal(simplifiedWorkCardStatus("booked", readiness), "booked");
});
