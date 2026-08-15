import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNowLondon, todayLondonDateString, londonWallClockToUtcIso, resolvePreferredDateTime } from "./datetime";

test("formatNowLondon renders a real weekday, date, and time", () => {
  // 11 Aug 2026, 14:32 UTC — a fixed, known instant.
  const d = new Date("2026-08-11T14:32:00.000Z");
  const formatted = formatNowLondon(d);
  assert.match(formatted, /Tuesday/);
  assert.match(formatted, /11 August 2026/);
});

test("formatNowLondon correctly shifts a summer (BST) evening into the next London day", () => {
  // 23:30 UTC in August is 00:30 the next day in London (BST = UTC+1).
  const d = new Date("2026-08-11T23:30:00.000Z");
  const formatted = formatNowLondon(d);
  assert.match(formatted, /12 August 2026/, "23:30 UTC in summer should already be the 12th in London");
});

test("todayLondonDateString matches the UTC date when there is no BST offset (winter)", () => {
  const d = new Date("2026-01-15T10:00:00.000Z");
  assert.equal(todayLondonDateString(d), "2026-01-15");
});

test("todayLondonDateString shifts forward across midnight UTC during BST (summer)", () => {
  const d = new Date("2026-08-11T23:30:00.000Z");
  assert.equal(todayLondonDateString(d), "2026-08-12");
});

test("todayLondonDateString is stable and well-formed (YYYY-MM-DD)", () => {
  const result = todayLondonDateString(new Date("2026-03-01T12:00:00.000Z"));
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
});

/* -------- londonWallClockToUtcIso (live-test regression: 10am -> 11am bug) -------- */

test("10am London local in August (BST, UTC+1) becomes 09:00 UTC, not 10:00 UTC", () => {
  const result = londonWallClockToUtcIso("2026-08-12T10:00:00");
  assert.equal(result, "2026-08-12T09:00:00.000Z");
  // Round-trip: formatting this UTC instant back in London must read 10:00 again.
  const displayed = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(result!)
  );
  assert.equal(displayed, "10:00");
});

test("10am London local in January (GMT, UTC+0) stays 10:00 UTC", () => {
  const result = londonWallClockToUtcIso("2026-01-12T10:00:00");
  assert.equal(result, "2026-01-12T10:00:00.000Z");
});

test("a trailing Z from the model is ignored — the literal digits are always read as London local time", () => {
  // This is the exact bug: the model wrote "10:00:00.000Z" meaning
  // 10am London time, not 10am UTC. The fix must not trust the Z.
  const result = londonWallClockToUtcIso("2026-08-12T10:00:00.000Z");
  assert.equal(result, "2026-08-12T09:00:00.000Z");
});

test("seconds are optional", () => {
  assert.equal(londonWallClockToUtcIso("2026-08-12T10:00"), "2026-08-12T09:00:00.000Z");
});

test("malformed input returns null, never a guessed or partial timestamp", () => {
  assert.equal(londonWallClockToUtcIso(""), null);
  assert.equal(londonWallClockToUtcIso("not a date"), null);
  assert.equal(londonWallClockToUtcIso("2026-13-40T99:99:00"), null);
});

test("a date right on the BST-to-GMT clock-change weekend still resolves to the correct offset", () => {
  // UK clocks went back on 25 Oct 2026 at 02:00 BST -> 01:00 GMT.
  // A request for 9am on the 26th (after the change) must use GMT (+0).
  const afterChange = londonWallClockToUtcIso("2026-10-26T09:00:00");
  assert.equal(afterChange, "2026-10-26T09:00:00.000Z");
  // The day before the change (still BST, +1) must still convert.
  const beforeChange = londonWallClockToUtcIso("2026-10-24T09:00:00");
  assert.equal(beforeChange, "2026-10-24T08:00:00.000Z");
});

/* -------- resolvePreferredDateTime (deterministic replacement for the
   classification model's own date arithmetic) -------- */

test("'tomorrow at 10am' resolves against the message's own date, BST-correct", () => {
  // Tuesday 11 Aug 2026, 14:32 UTC = Tuesday 15:32 London (BST).
  const messageTimestamp = new Date("2026-08-11T14:32:00.000Z");
  const result = resolvePreferredDateTime("tomorrow at 10am", messageTimestamp);
  // Wednesday 12 Aug, 10:00 London (BST, +1) = 09:00 UTC.
  assert.equal(result, "2026-08-12T09:00:00.000Z");
});

test("a message sent after midnight London time (but not yet after midnight UTC) resolves 'tomorrow' against the correct London day", () => {
  // 23:30 UTC on 11 Aug is already 00:30 on 12 Aug in London (BST) —
  // the exact cross-midnight case todayLondonDateString is tested
  // against above. A naive UTC-calendar reference would compute
  // "tomorrow" as the 12th; the correct London-local answer is the 13th.
  const messageTimestamp = new Date("2026-08-11T23:30:00.000Z");
  const result = resolvePreferredDateTime("tomorrow at 9am", messageTimestamp);
  assert.equal(result, "2026-08-13T08:00:00.000Z");
});

test("'next Monday at 2pm' resolves to the coming Monday, not today or a past one", () => {
  // Tuesday 11 Aug 2026.
  const messageTimestamp = new Date("2026-08-11T10:00:00.000Z");
  const result = resolvePreferredDateTime("next Monday at 2pm", messageTimestamp);
  // Monday 17 Aug, 14:00 London (BST, +1) = 13:00 UTC.
  assert.equal(result, "2026-08-17T13:00:00.000Z");
});

test("a bare weekday with a time ('Monday at 2pm') resolves forward, never to a day that's already passed", () => {
  // Wednesday 12 Aug 2026 — the customer's own real wording from a live
  // production test.
  const messageTimestamp = new Date("2026-08-12T10:00:00.000Z");
  const result = resolvePreferredDateTime("Monday at 2pm", messageTimestamp);
  // The next Monday after Wednesday 12 Aug is 17 Aug, not the 10th.
  assert.equal(result, "2026-08-17T13:00:00.000Z");
});

test("a date with no time at all ('next Monday') returns null rather than inventing a default hour", () => {
  const messageTimestamp = new Date("2026-08-11T10:00:00.000Z");
  assert.equal(resolvePreferredDateTime("next Monday", messageTimestamp), null);
  assert.equal(resolvePreferredDateTime("tomorrow", messageTimestamp), null);
});

test("genuinely unparseable or absent timing returns null, never a guess", () => {
  const messageTimestamp = new Date("2026-08-11T10:00:00.000Z");
  assert.equal(resolvePreferredDateTime("whenever suits", messageTimestamp), null);
  assert.equal(resolvePreferredDateTime("", messageTimestamp), null);
});

test("a time with no date at all ('around 4pm') resolves to today's date", () => {
  // Wednesday 12 Aug 2026, 10:00 UTC = 11:00 London (BST) — before 4pm,
  // so "today" is the correct, unambiguous reading.
  const messageTimestamp = new Date("2026-08-12T10:00:00.000Z");
  const result = resolvePreferredDateTime("around 4pm", messageTimestamp);
  assert.equal(result, "2026-08-12T15:00:00.000Z");
});
