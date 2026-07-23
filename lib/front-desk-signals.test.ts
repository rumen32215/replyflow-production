import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttentionQueue, buildReceptionistActivity, attentionReason, type AttentionItem } from "./front-desk-signals";

test("buildAttentionQueue: emergencies and escalations sort before everything else", () => {
  const items = buildAttentionQueue({
    waitingConversations: [
      { kind: "waiting_conversation", conversationId: "c1", name: "Sam", reason: "New enquiry", minutes: 90, isEmergency: false },
      { kind: "waiting_conversation", conversationId: "c2", name: "Priya", reason: "New enquiry", minutes: 5, isEmergency: true },
    ],
    draftWorkCards: [
      { kind: "draft_work_card", workCardId: "w1", conversationId: null, issue: "Boiler service", customerName: "Alex", minutes: 200 },
    ],
    pendingReplies: [],
  });
  assert.equal(items[0]!.kind, "waiting_conversation");
  assert.equal((items[0] as Extract<AttentionItem, { kind: "waiting_conversation" }>).conversationId, "c2");
});

test("buildAttentionQueue: among non-urgent items, the longest-waiting sorts first regardless of kind", () => {
  const items = buildAttentionQueue({
    waitingConversations: [
      { kind: "waiting_conversation", conversationId: "c1", name: "Sam", reason: "New enquiry", minutes: 10, isEmergency: false },
    ],
    draftWorkCards: [
      { kind: "draft_work_card", workCardId: "w1", conversationId: null, issue: "Radiator", customerName: "Alex", minutes: 500 },
    ],
    pendingReplies: [
      { kind: "pending_reply", draftId: "d1", conversationId: "c2", customerName: "Jo", minutes: 50, requiresEscalation: false },
    ],
  });
  assert.equal(items[0]!.kind, "draft_work_card");
  assert.equal(items[1]!.kind, "pending_reply");
  assert.equal(items[2]!.kind, "waiting_conversation");
});

test("buildAttentionQueue: respects the limit", () => {
  const waiting = Array.from({ length: 10 }, (_, i) => ({
    kind: "waiting_conversation" as const,
    conversationId: `c${i}`,
    name: `Customer ${i}`,
    reason: "New enquiry",
    minutes: i,
    isEmergency: false,
  }));
  const items = buildAttentionQueue({ waitingConversations: waiting, draftWorkCards: [], pendingReplies: [], limit: 3 });
  assert.equal(items.length, 3);
});

test("attentionReason: an emergency conversation reads as Emergency, not its generic reason", () => {
  const item: AttentionItem = { kind: "waiting_conversation", conversationId: "c1", name: "Sam", reason: "New enquiry", minutes: 5, isEmergency: true };
  assert.equal(attentionReason(item), "Emergency");
});

test("buildReceptionistActivity: only real events, sorted newest first", () => {
  const events = buildReceptionistActivity({
    startedWorkCards: [{ id: "w1", issue: "Leak repair", customerName: "Sam", createdAt: "2026-07-20T09:00:00Z" }],
    bookedWorkCards: [
      { id: "w2", issue: "Boiler service", customerName: "Priya", approvedAt: "2026-07-21T10:00:00Z", scheduledFor: "2026-07-22T09:00:00Z" },
    ],
    completedWorkCards: [{ id: "w3", issue: "Radiator swap", customerName: "Alex", completedAt: "2026-07-19T09:00:00Z" }],
    newConversations: [],
    escalations: [{ id: "e1", reason: "Gas leak reported", occurredAt: "2026-07-21T12:00:00Z" }],
  });
  assert.equal(events[0]!.kind, "escalated");
  assert.equal(events[0]!.text, "Escalated: Gas leak reported");
  assert.ok(events.some((e) => e.text.includes("Booked Boiler service for Priya")));
  const times = events.map((e) => new Date(e.occurredAt).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => b - a));
});

test("buildReceptionistActivity: never invents an event with no real timestamp behind it", () => {
  const events = buildReceptionistActivity({
    startedWorkCards: [],
    bookedWorkCards: [],
    completedWorkCards: [],
    newConversations: [],
    escalations: [],
  });
  assert.deepEqual(events, []);
});

test("buildReceptionistActivity: respects the limit", () => {
  const started = Array.from({ length: 12 }, (_, i) => ({
    id: `w${i}`,
    issue: "Job",
    customerName: "Someone",
    createdAt: new Date(2026, 6, i + 1).toISOString(),
  }));
  const events = buildReceptionistActivity({
    startedWorkCards: started,
    bookedWorkCards: [],
    completedWorkCards: [],
    newConversations: [],
    escalations: [],
    limit: 4,
  });
  assert.equal(events.length, 4);
});
