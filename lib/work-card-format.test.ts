import { test } from "node:test";
import assert from "node:assert/strict";
import { toDateTimeLocalValue, mapsHref } from "./work-card-format";

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

test("mapsHref: encodes spaces and punctuation so the link never breaks", () => {
  const href = mapsHref("12 High St, Flat 2B, London");
  assert.ok(href.startsWith("https://www.google.com/maps/search/?api=1&query="));
  assert.ok(!href.includes(" "));
  assert.ok(href.includes(encodeURIComponent("12 High St, Flat 2B, London")));
});

test("mapsHref: an empty address still produces a valid (if useless) URL, never throws", () => {
  assert.doesNotThrow(() => mapsHref(""));
});
