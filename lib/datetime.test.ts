import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNowLondon, todayLondonDateString, londonWallClockToUtcIso } from "./datetime";

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
