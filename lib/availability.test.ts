import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultAvailability, describeWeeklyHours, hasCustomizedHours } from "./availability";

test("hasCustomizedHours: false against the untouched Mon-Fri/weekend-closed default", () => {
  const base = defaultAvailability("08:00", "17:30");
  assert.equal(hasCustomizedHours(base.hours, "08:00", "17:30"), false);
});

test("hasCustomizedHours: true once weekend hours are actually set", () => {
  const base = defaultAvailability("08:00", "17:30");
  const withSaturday = { ...base.hours, sat: { closed: false, open: "09:00", close: "13:00" } };
  assert.equal(hasCustomizedHours(withSaturday, "08:00", "17:30"), true);
});

test("describeWeeklyHours: collapses the default Mon-Fri open / Sat-Sun closed grid into two lines", () => {
  const base = defaultAvailability("08:00", "17:30");
  assert.deepEqual(describeWeeklyHours(base.hours), ["Monday–Friday: 08:00–17:30", "Saturday–Sunday: Closed"]);
});

test("describeWeeklyHours: every day open at the same hours collapses into one line", () => {
  const base = defaultAvailability("09:00", "18:00");
  const everyDay = Object.fromEntries(
    Object.keys(base.hours).map((k) => [k, { closed: false, open: "09:00", close: "18:00" }])
  ) as typeof base.hours;
  assert.deepEqual(describeWeeklyHours(everyDay), ["Monday–Sunday: 09:00–18:00"]);
});

test("describeWeeklyHours: a single different day breaks the run", () => {
  const base = defaultAvailability("08:00", "17:30");
  const shortFriday = { ...base.hours, fri: { closed: false, open: "08:00", close: "13:00" } };
  assert.deepEqual(describeWeeklyHours(shortFriday), [
    "Monday–Thursday: 08:00–17:30",
    "Friday: 08:00–13:00",
    "Saturday–Sunday: Closed",
  ]);
});
