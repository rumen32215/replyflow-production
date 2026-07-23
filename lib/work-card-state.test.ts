import { test } from "node:test";
import assert from "node:assert/strict";
import { describeWorkCardState, isActiveWorkCardStatus } from "./work-card-state";

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
