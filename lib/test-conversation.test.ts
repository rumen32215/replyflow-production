import { test } from "node:test";
import assert from "node:assert/strict";
import { TEST_CONVERSATION_PHONE, isTestConversationPhone } from "./test-conversation";

test("the reserved test phone number is recognised", () => {
  assert.equal(isTestConversationPhone(TEST_CONVERSATION_PHONE), true);
});

test("a real customer phone number is never mistaken for the test conversation", () => {
  assert.equal(isTestConversationPhone("447911123456"), false);
});

test("null/undefined never matches", () => {
  assert.equal(isTestConversationPhone(null), false);
  assert.equal(isTestConversationPhone(undefined), false);
});

test("the reserved number is inside the UK's Ofcom fictional range (07700 900xxx), matching the convention scripts/reply-engine-tests already uses", () => {
  assert.match(TEST_CONVERSATION_PHONE, /^447700900\d{3}$/);
});
