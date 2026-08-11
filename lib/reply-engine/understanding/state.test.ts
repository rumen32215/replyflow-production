import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeUrgency, toConversationState, EMPTY_CONVERSATION_STATE } from "./state";

/**
 * ReplyFlow V2 (2026-08-11) — Job-Ready computation needs a reliable
 * urgency signal at read time (Front Desk), not just in the moment a
 * single message was classified — these cover the merge/parse logic
 * that carries it forward.
 */

test("mergeUrgency keeps the stronger of the two readings", () => {
  assert.equal(mergeUrgency("none", "urgent"), "urgent");
  assert.equal(mergeUrgency("urgent", "none"), "urgent");
  assert.equal(mergeUrgency("soon", "urgent"), "urgent");
  assert.equal(mergeUrgency("urgent", "soon"), "urgent");
});

test("mergeUrgency never downgrades an already-urgent reading to a calmer follow-up", () => {
  assert.equal(mergeUrgency("urgent", "none"), "urgent");
});

test("mergeUrgency returns none when both readings are none", () => {
  assert.equal(mergeUrgency("none", "none"), "none");
});

test("toConversationState defaults urgency to none when absent", () => {
  const state = toConversationState({ stage: "collect" });
  assert.equal(state.urgency, "none");
});

test("toConversationState reads back a valid persisted urgency", () => {
  const state = toConversationState({ ...EMPTY_CONVERSATION_STATE, urgency: "urgent" });
  assert.equal(state.urgency, "urgent");
});

test("toConversationState rejects a malformed urgency value rather than propagating it", () => {
  const state = toConversationState({ urgency: "extremely-urgent-typo" });
  assert.equal(state.urgency, "none");
});

test("malformed/missing raw input still degrades to EMPTY_CONVERSATION_STATE, urgency included", () => {
  assert.deepEqual(toConversationState(null), EMPTY_CONVERSATION_STATE);
  assert.deepEqual(toConversationState(undefined), EMPTY_CONVERSATION_STATE);
});

/**
 * ReplyFlow V4 (Conversation Episodes, Phase 3) — preferredTimeResolved
 * must only ever be a real, parseable timestamp, never a passthrough
 * of whatever the model happened to write.
 */

test("preferredTimeResolved parses a genuine ISO timestamp", () => {
  const state = toConversationState({ slots: { preferredTimeResolved: "2026-08-12T09:00:00.000Z" } });
  assert.equal(state.slots.preferredTimeResolved, "2026-08-12T09:00:00.000Z");
});

test("preferredTimeResolved is null when absent", () => {
  const state = toConversationState({ slots: { issue: "leak" } });
  assert.equal(state.slots.preferredTimeResolved, null);
});

test("preferredTimeResolved rejects a malformed date rather than propagating it to a Work Card", () => {
  const state = toConversationState({ slots: { preferredTimeResolved: "tomorrow-ish" } });
  assert.equal(state.slots.preferredTimeResolved, null);
});

test("preferredTimeResolved also accepts the snake_case key the model may return", () => {
  const state = toConversationState({ slots: { preferred_time_resolved: "2026-08-12T09:00:00.000Z" } });
  assert.equal(state.slots.preferredTimeResolved, "2026-08-12T09:00:00.000Z");
});
