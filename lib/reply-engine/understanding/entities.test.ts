import { test } from "node:test";
import assert from "node:assert/strict";
import { withPostcodeBackstop } from "./entities";
import { EMPTY_CONVERSATION_STATE } from "./state";

/**
 * ReplyFlow V2 (2026-08-11) — proactive postcode qualification. This
 * covers only the deterministic backstop (`withPostcodeBackstop`):
 * classification itself is a live model call, tested by the reply
 * engine's own fixtures elsewhere, not unit-testable here.
 */

test("fills location from a pattern-matched postcode when the slot is empty", () => {
  const result = withPostcodeBackstop(EMPTY_CONVERSATION_STATE, {
    phoneNumbers: [],
    postcodes: ["SW1A 1AA"],
    emails: [],
    explicitDates: [],
  });
  assert.equal(result.slots.location, "SW1A 1AA");
});

test("never overwrites a location already collected, even if a different postcode appears", () => {
  const state = { ...EMPTY_CONVERSATION_STATE, slots: { ...EMPTY_CONVERSATION_STATE.slots, location: "Already given address" } };
  const result = withPostcodeBackstop(state, {
    phoneNumbers: [],
    postcodes: ["SW1A 1AA"],
    emails: [],
    explicitDates: [],
  });
  assert.equal(result.slots.location, "Already given address");
});

test("leaves state untouched when no postcode was found", () => {
  const result = withPostcodeBackstop(EMPTY_CONVERSATION_STATE, {
    phoneNumbers: [],
    postcodes: [],
    emails: [],
    explicitDates: [],
  });
  assert.equal(result.slots.location, null);
  assert.equal(result, EMPTY_CONVERSATION_STATE);
});

test("does not mutate the input state object", () => {
  const state = { ...EMPTY_CONVERSATION_STATE, slots: { ...EMPTY_CONVERSATION_STATE.slots } };
  withPostcodeBackstop(state, { phoneNumbers: [], postcodes: ["EC1A 1BB"], emails: [], explicitDates: [] });
  assert.equal(state.slots.location, null);
});
