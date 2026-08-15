import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultAvailability,
  describeWeeklyHours,
  hasCustomizedHours,
  dayKeyForDate,
  candidateSlotsForDay,
  hasSchedulingConflict,
  type BusyInterval,
} from "./availability";

/** A guaranteed weekday, found the same forward-search way the rest of
 * this file's date logic already works — never a hand-picked date that
 * could silently land on a weekend after a calendar changes underfoot. */
function findWeekday(from: Date): Date {
  const d = new Date(from);
  while (dayKeyForDate(d) === "sat" || dayKeyForDate(d) === "sun") d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function findWeekendDay(from: Date): Date {
  const d = new Date(from);
  while (dayKeyForDate(d) !== "sat") d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function at(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

const WEEKDAY = findWeekday(new Date(2026, 0, 1));
const WEEKEND = findWeekendDay(new Date(2026, 0, 1));
const MIDNIGHT = at(WEEKDAY, "00:00"); // "now" far enough before minNoticeHours never excludes anything by accident

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

// ---------------------------------------------------------------------
// hasSchedulingConflict — the one real conflict check, shared by slot
// generation and booking creation/reschedule.

test("hasSchedulingConflict: true when the new window genuinely overlaps an existing one", () => {
  const busy: BusyInterval[] = [{ start: at(WEEKDAY, "09:00"), end: at(WEEKDAY, "10:00") }];
  assert.equal(hasSchedulingConflict(at(WEEKDAY, "09:30"), at(WEEKDAY, "10:30"), busy), true);
});

test("hasSchedulingConflict: false when one booking ends exactly as another starts (adjacent, not overlapping)", () => {
  const busy: BusyInterval[] = [{ start: at(WEEKDAY, "09:00"), end: at(WEEKDAY, "10:00") }];
  assert.equal(hasSchedulingConflict(at(WEEKDAY, "10:00"), at(WEEKDAY, "11:00"), busy), false);
  assert.equal(hasSchedulingConflict(at(WEEKDAY, "08:00"), at(WEEKDAY, "09:00"), busy), false);
});

test("hasSchedulingConflict: true when the new window fully contains an existing booking", () => {
  const busy: BusyInterval[] = [{ start: at(WEEKDAY, "09:00"), end: at(WEEKDAY, "10:00") }];
  assert.equal(hasSchedulingConflict(at(WEEKDAY, "08:00"), at(WEEKDAY, "11:00"), busy), true);
});

test("hasSchedulingConflict: false against an empty busy list", () => {
  assert.equal(hasSchedulingConflict(at(WEEKDAY, "09:00"), at(WEEKDAY, "10:00"), []), false);
});

// ---------------------------------------------------------------------
// candidateSlotsForDay

test("candidateSlotsForDay: a normal open weekday with no bookings offers real slots across the working window", () => {
  const availability = defaultAvailability("08:00", "17:00");
  const slots = candidateSlotsForDay(availability, WEEKDAY, 60, [], MIDNIGHT);
  assert.ok(slots.length > 0);
  assert.equal(slots[0]!.start.getHours(), 8);
  // Every slot must actually fit inside the working day and be a real hour long.
  for (const slot of slots) {
    assert.ok(slot.start >= at(WEEKDAY, "08:00"));
    assert.ok(slot.end <= at(WEEKDAY, "17:00"));
    assert.equal(slot.end.getTime() - slot.start.getTime(), 60 * 60_000);
  }
});

test("candidateSlotsForDay: a closed weekend day offers nothing", () => {
  const availability = defaultAvailability("08:00", "17:00");
  const slots = candidateSlotsForDay(availability, WEEKEND, 60, [], MIDNIGHT);
  assert.deepEqual(slots, []);
});

test("candidateSlotsForDay: a day off offers nothing, even though it would otherwise be a working weekday", () => {
  const availability = defaultAvailability("08:00", "17:00");
  availability.daysOff.push({ date: `${WEEKDAY.getFullYear()}-${String(WEEKDAY.getMonth() + 1).padStart(2, "0")}-${String(WEEKDAY.getDate()).padStart(2, "0")}`, reason: "Holiday" });
  const slots = candidateSlotsForDay(availability, WEEKDAY, 60, [], MIDNIGHT);
  assert.deepEqual(slots, []);
});

test("candidateSlotsForDay: a fully-booked day offers nothing", () => {
  const availability = defaultAvailability("08:00", "17:00");
  const ds = `${WEEKDAY.getFullYear()}-${String(WEEKDAY.getMonth() + 1).padStart(2, "0")}-${String(WEEKDAY.getDate()).padStart(2, "0")}`;
  availability.fullyBooked.push(ds);
  const slots = candidateSlotsForDay(availability, WEEKDAY, 60, [], MIDNIGHT);
  assert.deepEqual(slots, []);
});

test("candidateSlotsForDay: an existing booking removes only the slots that would overlap it", () => {
  const availability = defaultAvailability("08:00", "17:00");
  const busy: BusyInterval[] = [{ start: at(WEEKDAY, "10:00"), end: at(WEEKDAY, "11:00") }];
  const slots = candidateSlotsForDay(availability, WEEKDAY, 60, busy, MIDNIGHT);
  const overlapsBooking = slots.some((s) => hasSchedulingConflict(s.start, s.end, busy));
  assert.equal(overlapsBooking, false);
  // 09:30 would run into the 10:00 booking, so it must be excluded too.
  assert.ok(!slots.some((s) => s.start.getTime() === at(WEEKDAY, "09:30").getTime()));
  // 08:00 and 11:00 remain genuinely free.
  assert.ok(slots.some((s) => s.start.getTime() === at(WEEKDAY, "08:00").getTime()));
  assert.ok(slots.some((s) => s.start.getTime() === at(WEEKDAY, "11:00").getTime()));
});

test("candidateSlotsForDay: reaching maxJobsPerDay closes the day out, even with open time left", () => {
  const availability = defaultAvailability("08:00", "17:00");
  availability.rules.maxJobsPerDay = 1;
  const busy: BusyInterval[] = [{ start: at(WEEKDAY, "08:00"), end: at(WEEKDAY, "09:00") }];
  const slots = candidateSlotsForDay(availability, WEEKDAY, 60, busy, MIDNIGHT);
  assert.deepEqual(slots, []);
});

test("candidateSlotsForDay: minNoticeHours excludes slots that are too soon, keeps the rest", () => {
  const availability = defaultAvailability("08:00", "17:00");
  availability.rules.minNoticeHours = 2;
  const now = at(WEEKDAY, "08:30"); // +2h notice = nothing bookable before 10:30
  const slots = candidateSlotsForDay(availability, WEEKDAY, 60, [], now);
  assert.ok(!slots.some((s) => s.start < at(WEEKDAY, "10:30")));
  assert.ok(slots.some((s) => s.start.getTime() === at(WEEKDAY, "11:00").getTime()));
});

test("candidateSlotsForDay: an enabled lunch break blocks slots that would overlap it", () => {
  const availability = defaultAvailability("08:00", "17:00");
  availability.rules.lunchBreak = { enabled: true, start: "12:00", end: "13:00" };
  const slots = candidateSlotsForDay(availability, WEEKDAY, 60, [], MIDNIGHT);
  assert.ok(!slots.some((s) => hasSchedulingConflict(s.start, s.end, [{ start: at(WEEKDAY, "12:00"), end: at(WEEKDAY, "13:00") }])));
  assert.ok(slots.some((s) => s.start.getTime() === at(WEEKDAY, "11:00").getTime()));
  assert.ok(slots.some((s) => s.start.getTime() === at(WEEKDAY, "13:00").getTime()));
});

test("candidateSlotsForDay: a travel buffer pads real space around an existing booking, not just the exact overlap", () => {
  const availability = defaultAvailability("08:00", "17:00");
  availability.rules.travelBufferMinutes = 30;
  const busy: BusyInterval[] = [{ start: at(WEEKDAY, "10:00"), end: at(WEEKDAY, "11:00") }];
  const slots = candidateSlotsForDay(availability, WEEKDAY, 60, busy, MIDNIGHT);
  // 09:30 would end at 10:30, inside the 30-minute buffer before the booking — must be excluded.
  assert.ok(!slots.some((s) => s.start.getTime() === at(WEEKDAY, "09:30").getTime()));
  // 09:00 ends exactly at 10:00, still inside the buffer zone (buffer pushes the busy window back to 09:30) — excluded too.
  assert.ok(!slots.some((s) => s.start.getTime() === at(WEEKDAY, "09:00").getTime()));
  // 08:00-09:00 is clear of the padded window (09:30-11:30).
  assert.ok(slots.some((s) => s.start.getTime() === at(WEEKDAY, "08:00").getTime()));
});

test("candidateSlotsForDay: a job duration longer than the working day offers nothing, never a partial/overrunning slot", () => {
  const availability = defaultAvailability("08:00", "10:00");
  const slots = candidateSlotsForDay(availability, WEEKDAY, 180, [], MIDNIGHT);
  assert.deepEqual(slots, []);
});
