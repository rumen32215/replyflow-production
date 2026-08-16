import { test } from "node:test";
import assert from "node:assert/strict";
import { toDateTimeLocalValue, mapsHref, formatDateTime, formatDate } from "./work-card-format";

test("toDateTimeLocalValue: null returns an empty string, not 'null' or NaN", () => {
  assert.equal(toDateTimeLocalValue(null), "");
});

test("toDateTimeLocalValue: pads single-digit month/day/hour/minute", () => {
  // 2026-01-05T03:07 local — every component below 10 needs a leading zero.
  const iso = new Date(2026, 0, 5, 3, 7).toISOString();
  assert.equal(toDateTimeLocalValue(iso), "2026-01-05T03:07");
});

test("toDateTimeLocalValue: round-trips through the datetime-local input format", () => {
  const iso = new Date(2026, 11, 25, 14, 30).toISOString();
  const value = toDateTimeLocalValue(iso);
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

// Hardening (production test, 2026-08-16): the previous implementation
// used Date's unpinned local getters (getHours/getFullYear/etc.), which
// read whichever timezone the running process happens to be in — right
// on a dev machine already set to Europe/London, wrong on a UTC
// production server for roughly half the year (BST). Asserted with a
// fixed UTC instant and an exact expected string, the same discipline
// formatDateTime/formatDate below already use, so this can't pass by
// coincidence on any one machine's local timezone.
test("toDateTimeLocalValue: pinned to Europe/London — a BST instant shows the London wall-clock time, not the raw UTC one", () => {
  // 2026-06-15T10:00:00Z is 11:00 in Europe/London (BST, +1) — if this
  // ever silently reverted to reading the UTC instant's own getters
  // (or the running process's local timezone) directly, this would only
  // coincidentally show 11:00 on a machine already in Europe/London.
  assert.equal(toDateTimeLocalValue("2026-06-15T10:00:00.000Z"), "2026-06-15T11:00");
});

test("toDateTimeLocalValue: a GMT (winter) instant has no offset applied", () => {
  assert.equal(toDateTimeLocalValue("2026-01-05T03:07:00.000Z"), "2026-01-05T03:07");
});

test("mapsHref: encodes spaces and punctuation so the link never breaks", () => {
  const href = mapsHref("12 High St, Flat 2B, London");
  assert.ok(href.startsWith("https://www.google.com/maps/search/?api=1&query="));
  assert.ok(!href.includes(" "));
  assert.ok(href.includes(encodeURIComponent("12 High St, Flat 2B, London")));
});

test("mapsHref: an empty address still produces a valid (if useless) URL, never throws", () => {
  assert.doesNotThrow(() => mapsHref(""));
});

// These two matter beyond the happy path: a Client Component that
// calls Date formatting without a pinned timeZone produced a real,
// confirmed-in-production React hydration mismatch (server render vs.
// client render disagreeing on the formatted text), which silently
// broke the status badge's ability to update after a real status
// change. Pinning "Europe/London" makes the output identical
// regardless of which machine/timezone actually runs the code —
// asserted here as an exact fixed string, not just "doesn't crash".
test("formatDateTime: pinned to Europe/London regardless of the runtime's local timezone", () => {
  // 2026-06-15T10:00:00Z is 11:00 BST (Europe/London, summer) — if this
  // ever silently reverted to unpinned local-timezone formatting, this
  // assertion would only coincidentally pass on a machine already set
  // to Europe/London, which is exactly the bug class being guarded
  // against.
  const result = formatDateTime("2026-06-15T10:00:00.000Z");
  assert.equal(result, "Mon 15 Jun, 11:00");
});

test("formatDateTime: null returns null, not a formatted 'Invalid Date'", () => {
  assert.equal(formatDateTime(null), null);
});

test("formatDate: pinned to Europe/London, date-only", () => {
  const result = formatDate("2026-06-15T10:00:00.000Z");
  assert.equal(result, "15 Jun 2026");
});

test("formatDate: a date near UTC midnight doesn't shift to the wrong day once localised", () => {
  // 2026-01-01T00:30:00Z is still 2025-12-31 at 00:30 in Europe/London
  // (GMT, no offset in January) — wait, London has no offset from UTC
  // in January, so this stays 2026-01-01. Use a BST-affected time
  // instead: 2026-06-01T23:30:00Z is 2026-06-02T00:30 in Europe/London
  // (BST, +1) — a real case where naive UTC-only formatting would show
  // the wrong day.
  const result = formatDate("2026-06-01T23:30:00.000Z");
  assert.equal(result, "2 Jun 2026");
});
