import { test } from "node:test";
import assert from "node:assert/strict";
import { describeSubscriptionGate, mapStripeSubscriptionStatus } from "./billing";

test("active is never blocked and never has a message", () => {
  const gate = describeSubscriptionGate({ status: "active", trialEndsAt: null, now: new Date() });
  assert.equal(gate.blocked, false);
  assert.equal(gate.message, null);
  assert.equal(gate.daysLeftInTrial, null);
});

test("past_due warns but never blocks — a lapsed payment communicates plainly before restricting anything", () => {
  const gate = describeSubscriptionGate({ status: "past_due", trialEndsAt: null, now: new Date() });
  assert.equal(gate.blocked, false);
  assert.ok(gate.message?.includes("update your card"));
});

test("canceled blocks with a resubscribe message", () => {
  const gate = describeSubscriptionGate({ status: "canceled", trialEndsAt: null, now: new Date() });
  assert.equal(gate.blocked, true);
  assert.ok(gate.message?.includes("Resubscribe"));
});

test("trialing with plenty of time left is not blocked and has no message", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const trialEndsAt = new Date("2026-01-08T00:00:00Z").toISOString();
  const gate = describeSubscriptionGate({ status: "trialing", trialEndsAt, now });
  assert.equal(gate.blocked, false);
  assert.equal(gate.message, null);
  assert.equal(gate.daysLeftInTrial, 7);
});

test("trialing within the warning window shows a days-left message but does not block", () => {
  const now = new Date("2026-01-06T00:00:00Z");
  const trialEndsAt = new Date("2026-01-08T00:00:00Z").toISOString();
  const gate = describeSubscriptionGate({ status: "trialing", trialEndsAt, now });
  assert.equal(gate.blocked, false);
  assert.equal(gate.daysLeftInTrial, 2);
  assert.ok(gate.message?.includes("2 days left"));
});

test("trialing with exactly one day left uses singular 'day'", () => {
  const now = new Date("2026-01-07T00:00:00Z");
  const trialEndsAt = new Date("2026-01-08T00:00:00Z").toISOString();
  const gate = describeSubscriptionGate({ status: "trialing", trialEndsAt, now });
  assert.equal(gate.daysLeftInTrial, 1);
  assert.ok(gate.message?.includes("1 day left"));
  assert.ok(!gate.message?.includes("1 days"));
});

test("trialing past its end time is blocked", () => {
  const now = new Date("2026-01-09T00:00:00Z");
  const trialEndsAt = new Date("2026-01-08T00:00:00Z").toISOString();
  const gate = describeSubscriptionGate({ status: "trialing", trialEndsAt, now });
  assert.equal(gate.blocked, true);
  assert.equal(gate.daysLeftInTrial, 0);
  assert.ok(gate.message?.includes("trial has ended"));
});

test("trialing with a missing trial_ends_at never blocks on the data gap", () => {
  const gate = describeSubscriptionGate({ status: "trialing", trialEndsAt: null, now: new Date() });
  assert.equal(gate.blocked, false);
  assert.equal(gate.message, null);
});

test("mapStripeSubscriptionStatus: active and trialing map directly", () => {
  assert.equal(mapStripeSubscriptionStatus("active"), "active");
  assert.equal(mapStripeSubscriptionStatus("trialing"), "trialing");
});

test("mapStripeSubscriptionStatus: past_due maps directly", () => {
  assert.equal(mapStripeSubscriptionStatus("past_due"), "past_due");
});

test("mapStripeSubscriptionStatus: unpaid/incomplete/incomplete_expired/paused/canceled all collapse to canceled", () => {
  for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
    assert.equal(mapStripeSubscriptionStatus(status), "canceled");
  }
});
