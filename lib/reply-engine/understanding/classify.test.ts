import { test, mock, before } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_CONVERSATION_STATE } from "./state";

/**
 * Focused coverage for the classification-failure fallback path
 * (production test, 2026-08-16): a failed completion call used to
 * carry the prior conversation state forward completely unresolved —
 * skipping resolvePreferredTime entirely — so a customer's already-
 * stated preferred time could sit with `preferredTimeResolved` left
 * null (or stale) for this turn even though the raw wording was
 * already known. The fix re-runs the same deterministic resolver the
 * happy path already uses.
 */

mock.module("server-only", { namedExports: {} });

let completionError: Error | null = null;
mock.module("../llm/client", {
  namedExports: {
    getCompletion: async () => {
      if (completionError) throw completionError;
      throw new Error("this test only exercises the failure path");
    },
  },
});

let recordedErrorEvents: Array<{ source: string }> = [];
mock.module("@/lib/error-events", {
  namedExports: {
    recordErrorEvent: async (input: { source: string }) => {
      recordedErrorEvents.push(input);
    },
  },
});

let classifyMessage: (typeof import("./classify"))["classifyMessage"];
before(async () => {
  ({ classifyMessage } = await import("./classify"));
});

test.beforeEach(() => {
  completionError = new Error("model unavailable");
  recordedErrorEvents = [];
});

test("a completion failure still resolves a carried-forward preferred time, not just an unresolved fallback", async () => {
  const priorState = {
    ...EMPTY_CONVERSATION_STATE,
    slots: { ...EMPTY_CONVERSATION_STATE.slots, issue: "Leaking radiator", preferredTime: "next Monday at 2pm", preferredTimeResolved: null },
  };

  const result = await classifyMessage("biz-1", "any message", priorState);

  assert.equal(result.primaryIntent, "UNCLEAR", "the safe fallback classification is still used on failure");
  assert.equal(recordedErrorEvents.length, 1);
  assert.ok(result.conversationState.slots.preferredTimeResolved, "preferredTimeResolved should be computed even though the completion call failed");
  assert.match(result.conversationState.slots.preferredTimeResolved!, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test("a completion failure with no stated preferred time stays null, not a guess", async () => {
  const priorState = {
    ...EMPTY_CONVERSATION_STATE,
    slots: { ...EMPTY_CONVERSATION_STATE.slots, issue: "Leaking radiator" },
  };

  const result = await classifyMessage("biz-1", "any message", priorState);
  assert.equal(result.conversationState.slots.preferredTimeResolved, null);
});

test("a completion failure carries forward every other slot value unchanged", async () => {
  const priorState = {
    ...EMPTY_CONVERSATION_STATE,
    slots: { ...EMPTY_CONVERSATION_STATE.slots, issue: "Leaking radiator", location: "NW1 1AA" },
  };

  const result = await classifyMessage("biz-1", "any message", priorState);
  assert.equal(result.conversationState.slots.issue, "Leaking radiator");
  assert.equal(result.conversationState.slots.location, "NW1 1AA");
});

test("a carried-forward TIME WINDOW ('between 1 and 2pm') resolves both the start and the window end, never collapsed to one instant (production test, 2026-08-16 round 2)", async () => {
  const priorState = {
    ...EMPTY_CONVERSATION_STATE,
    slots: {
      ...EMPTY_CONVERSATION_STATE.slots,
      issue: "Cracked kitchen tiles",
      preferredTime: "between 1&2 afternoon on 27th August",
      preferredTimeResolved: null,
      preferredTimeWindowEnd: null,
    },
  };

  const result = await classifyMessage("biz-1", "any message", priorState);

  assert.ok(result.conversationState.slots.preferredTimeResolved, "window start should resolve");
  assert.ok(result.conversationState.slots.preferredTimeWindowEnd, "window end should also resolve, not be dropped");
  assert.ok(
    new Date(result.conversationState.slots.preferredTimeWindowEnd!).getTime() >
      new Date(result.conversationState.slots.preferredTimeResolved!).getTime(),
    "the window end must be genuinely after the start"
  );
});
