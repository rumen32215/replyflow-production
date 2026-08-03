import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldDeliver, isWithinQuietHours } from "./delivery-decision";

// January dates are GMT (UTC+0) in Europe/London, no DST — so a UTC ISO
// time can be read directly as the business's local wall-clock time.
const WORKING_HOURS = { openingTime: "08:00", closingTime: "17:30" };
const DURING_HOURS = new Date("2026-01-15T10:00:00Z");
const BEFORE_HOURS = new Date("2026-01-15T05:00:00Z");
const AFTER_HOURS = new Date("2026-01-15T20:00:00Z");

test("isWithinQuietHours: mid-morning is not quiet", () => {
  assert.equal(isWithinQuietHours(DURING_HOURS, "08:00", "17:30"), false);
});

test("isWithinQuietHours: before opening is quiet", () => {
  assert.equal(isWithinQuietHours(BEFORE_HOURS, "08:00", "17:30"), true);
});

test("isWithinQuietHours: after closing is quiet", () => {
  assert.equal(isWithinQuietHours(AFTER_HOURS, "08:00", "17:30"), true);
});

test("isWithinQuietHours: exactly at opening time is not quiet", () => {
  assert.equal(isWithinQuietHours(new Date("2026-01-15T08:00:00Z"), "08:00", "17:30"), false);
});

test("isWithinQuietHours: exactly at closing time is quiet", () => {
  assert.equal(isWithinQuietHours(new Date("2026-01-15T17:30:00Z"), "08:00", "17:30"), true);
});

test("tier none never delivers, regardless of everything else", () => {
  assert.equal(
    shouldDeliver({ tier: "none", now: DURING_HOURS, lastNotifiedAt: null, ...WORKING_HOURS, crossesQuietHours: true }),
    false
  );
});

test("today tier, first ever notification, during working hours, delivers", () => {
  assert.equal(
    shouldDeliver({ tier: "today", now: DURING_HOURS, lastNotifiedAt: null, ...WORKING_HOURS, crossesQuietHours: false }),
    true
  );
});

test("today tier outside working hours never crosses, even if nothing was ever sent before", () => {
  assert.equal(
    shouldDeliver({ tier: "today", now: AFTER_HOURS, lastNotifiedAt: null, ...WORKING_HOURS, crossesQuietHours: false }),
    false
  );
});

test("now tier crosses quiet hours only when the caller says the owner's own rules require it", () => {
  assert.equal(
    shouldDeliver({ tier: "now", now: AFTER_HOURS, lastNotifiedAt: null, ...WORKING_HOURS, crossesQuietHours: true }),
    true
  );
});

test("now tier caused only by connection health (crossesQuietHours false) waits for working hours like today would", () => {
  assert.equal(
    shouldDeliver({ tier: "now", now: AFTER_HOURS, lastNotifiedAt: null, ...WORKING_HOURS, crossesQuietHours: false }),
    false
  );
});

test("today tier is suppressed inside its cooldown window", () => {
  const lastNotifiedAt = new Date(DURING_HOURS.getTime() - 10 * 60_000); // 10 minutes ago
  assert.equal(shouldDeliver({ tier: "today", now: DURING_HOURS, lastNotifiedAt, ...WORKING_HOURS, crossesQuietHours: false }), false);
});

test("today tier delivers again once its cooldown has passed", () => {
  const lastNotifiedAt = new Date(DURING_HOURS.getTime() - 300 * 60_000); // 5 hours ago
  assert.equal(shouldDeliver({ tier: "today", now: DURING_HOURS, lastNotifiedAt, ...WORKING_HOURS, crossesQuietHours: false }), true);
});

test("now tier has a shorter cooldown than today — 10 minutes still suppresses it", () => {
  const lastNotifiedAt = new Date(DURING_HOURS.getTime() - 10 * 60_000);
  assert.equal(shouldDeliver({ tier: "now", now: DURING_HOURS, lastNotifiedAt, ...WORKING_HOURS, crossesQuietHours: false }), false);
});

test("now tier delivers again after 50 minutes, before today's own cooldown would have cleared", () => {
  const lastNotifiedAt = new Date(DURING_HOURS.getTime() - 50 * 60_000);
  assert.equal(shouldDeliver({ tier: "now", now: DURING_HOURS, lastNotifiedAt, ...WORKING_HOURS, crossesQuietHours: false }), true);
});
