import { test } from "node:test";
import assert from "node:assert/strict";
import { composeAttentionEmail } from "./copy";

const BASE = { businessName: "SHABZ Plumbing", appUrl: "https://replyflow-production.vercel.app" };

test("an expired connection leads the message, even over an escalated reply", () => {
  const email = composeAttentionEmail({ ...BASE, pendingReplyCount: 1, hasEscalatedPendingReply: true, connectionStatus: "expired" });
  assert.match(email.subject, /connection has expired/);
});

test("a single escalated reply names it as urgent, singular wording", () => {
  const email = composeAttentionEmail({ ...BASE, pendingReplyCount: 1, hasEscalatedPendingReply: true, connectionStatus: "connected" });
  assert.match(email.subject, /A reply is waiting for your OK — it's urgent/);
});

test("multiple pending with one escalated states the real count and flags it's urgent", () => {
  const email = composeAttentionEmail({ ...BASE, pendingReplyCount: 3, hasEscalatedPendingReply: true, connectionStatus: "connected" });
  assert.match(email.subject, /3 replies waiting for your OK — one of them is urgent/);
});

test("routine pending replies never claim urgency", () => {
  const email = composeAttentionEmail({ ...BASE, pendingReplyCount: 2, hasEscalatedPendingReply: false, connectionStatus: "connected" });
  assert.match(email.subject, /2 replies waiting for your OK/);
  assert.doesNotMatch(email.subject, /urgent/);
});

test("the body links to the real dashboard using the caller's own app URL, never hardcoded", () => {
  const email = composeAttentionEmail({ ...BASE, pendingReplyCount: 1, hasEscalatedPendingReply: false, connectionStatus: "connected" });
  assert.match(email.text, /https:\/\/replyflow-production\.vercel\.app\/dashboard/);
});
