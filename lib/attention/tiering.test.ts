import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyAttentionTier, crossesQuietHours } from "./tiering";

test("no pending replies and a healthy connection is never a candidate", () => {
  assert.equal(
    classifyAttentionTier({ pendingReplyCount: 0, hasEscalatedPendingReply: false, connectionStatus: "connected" }),
    "none"
  );
});

test("an escalated pending reply is always now, regardless of count", () => {
  assert.equal(
    classifyAttentionTier({ pendingReplyCount: 1, hasEscalatedPendingReply: true, connectionStatus: "connected" }),
    "now"
  );
});

test("an expired connection is now even with zero pending replies", () => {
  assert.equal(
    classifyAttentionTier({ pendingReplyCount: 0, hasEscalatedPendingReply: false, connectionStatus: "expired" }),
    "now"
  );
});

test("routine pending replies with no escalation are today, never now", () => {
  assert.equal(
    classifyAttentionTier({ pendingReplyCount: 5, hasEscalatedPendingReply: false, connectionStatus: "connected" }),
    "today"
  );
});

test("volume alone never escalates to now, however many replies are waiting", () => {
  assert.equal(
    classifyAttentionTier({ pendingReplyCount: 50, hasEscalatedPendingReply: false, connectionStatus: "connected" }),
    "today"
  );
});

test("an expiring-soon connection with nothing else pending is today, not now", () => {
  assert.equal(
    classifyAttentionTier({ pendingReplyCount: 0, hasEscalatedPendingReply: false, connectionStatus: "expiring_soon" }),
    "today"
  );
});

test("not_connected with nothing pending is none, not a false alarm", () => {
  assert.equal(
    classifyAttentionTier({ pendingReplyCount: 0, hasEscalatedPendingReply: false, connectionStatus: "not_connected" }),
    "none"
  );
});

test("only an owner-configured escalation crosses quiet hours", () => {
  assert.equal(crossesQuietHours({ pendingReplyCount: 1, hasEscalatedPendingReply: true, connectionStatus: "connected" }), true);
});

test("an expired connection alone does not cross quiet hours — it is now but not owner-configured urgent", () => {
  assert.equal(crossesQuietHours({ pendingReplyCount: 0, hasEscalatedPendingReply: false, connectionStatus: "expired" }), false);
});
