import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttachmentAcknowledgmentDraft } from "./attachment-acknowledgment";

const input = { businessId: "biz-1", conversationId: "conv-1", episodeId: "ep-1", customerMessageId: "msg-1" };

test("references the exact business, conversation, episode, and message it's acknowledging", () => {
  const draft = buildAttachmentAcknowledgmentDraft(input);
  assert.equal(draft.business_id, "biz-1");
  assert.equal(draft.conversation_id, "conv-1");
  assert.equal(draft.episode_id, "ep-1");
  assert.equal(draft.customer_message_id, "msg-1");
});

test("never claims to understand the attachment", () => {
  const draft = buildAttachmentAcknowledgmentDraft(input);
  assert.ok(!/image|photo|picture|video|document/i.test(draft.draft_text));
  assert.ok(draft.draft_text.toLowerCase().includes("not able to view"));
});

test("is always a normal pending draft, never auto-sent", () => {
  const draft = buildAttachmentAcknowledgmentDraft(input);
  assert.equal(draft.status, "pending");
  assert.equal(draft.would_auto_send, false);
});

test("never escalates and never claims a fact was used", () => {
  const draft = buildAttachmentAcknowledgmentDraft(input);
  assert.equal(draft.requires_escalation, false);
  assert.equal(draft.escalation_reason, null);
  assert.deepEqual(draft.facts_used, []);
});

test("only uses real, constraint-valid enum values", () => {
  const draft = buildAttachmentAcknowledgmentDraft(input);
  assert.ok(["unknown", "low", "medium", "high"].includes(draft.understanding_confidence));
  assert.ok(["unknown", "low", "medium", "high", "verified"].includes(draft.confidence));
  assert.ok(["pending", "approved", "edited", "rejected", "sent", "failed", "no_reply_needed"].includes(draft.status));
});
