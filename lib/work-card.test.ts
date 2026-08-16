import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWorkCardDraft } from "./work-card";
import { EMPTY_CONVERSATION_STATE } from "./reply-engine/understanding/state";
import type { ConversationState, Commitment } from "./reply-engine/understanding/state";

function state(
  overrides: Partial<Omit<ConversationState, "slots">> & { slots?: Partial<ConversationState["slots"]> } = {}
): ConversationState {
  return {
    ...EMPTY_CONVERSATION_STATE,
    ...overrides,
    slots: { ...EMPTY_CONVERSATION_STATE.slots, ...overrides.slots },
  };
}

function commitment(text: string, overrides: Partial<Commitment> = {}): Commitment {
  return { text, kind: "customer_fact", status: "resolved", ...overrides };
}

test("issue is sentence-cased from the customer's own lower-case wording", () => {
  const draft = buildWorkCardDraft(state({ slots: { issue: "leaking radiator" } }));
  assert.equal(draft.issue, "Leaking radiator");
});

test("an already-capitalized or empty issue is left exactly as-is", () => {
  assert.equal(buildWorkCardDraft(state({ slots: { issue: "Boiler making noise" } })).issue, "Boiler making noise");
  assert.equal(buildWorkCardDraft(state()).issue, "");
});

test("a resolved preferred time is shown as an absolute, formatted date — not the customer's relative wording", () => {
  const draft = buildWorkCardDraft(
    state({ slots: { issue: "Leaking radiator", preferredTime: "next Monday at 2pm", preferredTimeResolved: "2026-08-17T13:00:00.000Z" } })
  );
  assert.ok(draft.conversationSummary?.includes("Preferred time:"));
  assert.ok(!draft.conversationSummary?.includes("next Monday at 2pm"), "raw relative wording should not appear once resolved");
  assert.ok(draft.conversationSummary?.includes("Mon"), "should show the resolved, formatted date");
});

test("with no resolved time, the customer's raw relative wording is used as a fallback", () => {
  const draft = buildWorkCardDraft(state({ slots: { issue: "Leaking radiator", preferredTime: "next Monday at 2pm", preferredTimeResolved: null } }));
  assert.ok(draft.conversationSummary?.includes("Preferred time: next Monday at 2pm."));
});

test("a collected commitment that duplicates the location slot is excluded from both collectedDetails and the summary", () => {
  const draft = buildWorkCardDraft(
    state({
      slots: { issue: "Leaking radiator", location: "NW1 1AA" },
      commitments: [commitment("Postcode is NW1 1AA"), commitment("Dog on site, please knock")],
    })
  );
  assert.equal(draft.collectedDetails, "Dog on site, please knock");
  assert.ok(!draft.conversationSummary?.includes("Postcode is NW1 1AA"));
  assert.ok(draft.conversationSummary?.includes("Dog on site, please knock"));
  // The postcode still appears exactly once, via the location line.
  const occurrences = (draft.conversationSummary?.match(/NW1 1AA/g) ?? []).length;
  assert.equal(occurrences, 1);
});

test("a collected commitment unrelated to the location is retained", () => {
  const draft = buildWorkCardDraft(
    state({
      slots: { issue: "Leaking radiator", location: "NW1 1AA" },
      commitments: [commitment("Parking is available on the street")],
    })
  );
  assert.equal(draft.collectedDetails, "Parking is available on the street");
});

test("dedup is case-insensitive", () => {
  const draft = buildWorkCardDraft(
    state({
      slots: { issue: "Leaking radiator", location: "NW1 1AA" },
      commitments: [commitment("the postcode is nw1 1aa")],
    })
  );
  assert.equal(draft.collectedDetails, null);
});

test("empty state never invents anything — issue empty string, everything else null", () => {
  const draft = buildWorkCardDraft(state());
  assert.equal(draft.issue, "");
  assert.equal(draft.address, null);
  assert.equal(draft.collectedDetails, null);
  assert.equal(draft.conversationSummary, null);
  assert.equal(draft.preferredTimeResolved, null);
});

test("unresolved (non-customer_fact or non-resolved) commitments never appear in collectedDetails", () => {
  const draft = buildWorkCardDraft(
    state({
      slots: { issue: "Leaking radiator" },
      commitments: [
        commitment("Outstanding thing", { status: "outstanding" }),
        commitment("A receptionist-side question", { kind: "receptionist_question" }),
      ],
    })
  );
  assert.equal(draft.collectedDetails, null);
});
