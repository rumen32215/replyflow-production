import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNowLondon, todayLondonDateString } from "./datetime";

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
