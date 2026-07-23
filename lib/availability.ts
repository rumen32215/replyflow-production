/**
 * The receptionist's diary — pure types and helpers, no React, no
 * Supabase. Availability V1: weekly hours, days off, fully booked
 * days, booking rules. Stored as one jsonb document on `businesses`.
 */

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export interface DayHours {
  closed: boolean;
  open: string; // "08:00"
  close: string; // "17:00"
}

export interface DayOff {
  date: string; // "2026-07-20"
  reason: string; // "Holiday", "Family event"...
}

export interface BookingRules {
  sameDay: boolean;
  emergency: boolean;
  minNoticeHours: number;
  maxJobsPerDay: number | null;
  /** What actually protects a tradesperson's time beyond same-day and
   * emergency toggles (Diary V2). */
  lunchBreak: { enabled: boolean; start: string; end: string };
  travelBufferMinutes: number;
  weekendEmergencyOnly: boolean;
  workingRadiusMiles: number | null;
  /** Free text — when emergency call-outs actually run (e.g. "24/7" or
   * "Weekdays after 6pm"), since that varies too much to chip-select. */
  emergencyHours: string;
}

export interface Availability {
  hours: Record<DayKey, DayHours>;
  daysOff: DayOff[];
  fullyBooked: string[]; // dates
  rules: BookingRules;
}

export function defaultAvailability(opening = "08:00", closing = "17:30"): Availability {
  const workday: DayHours = { closed: false, open: opening, close: closing };
  return {
    hours: {
      mon: { ...workday },
      tue: { ...workday },
      wed: { ...workday },
      thu: { ...workday },
      fri: { ...workday },
      sat: { closed: true, open: opening, close: closing },
      sun: { closed: true, open: opening, close: closing },
    },
    daysOff: [],
    fullyBooked: [],
    rules: {
      sameDay: true,
      emergency: true,
      minNoticeHours: 2,
      maxJobsPerDay: null,
      lunchBreak: { enabled: false, start: "12:00", end: "13:00" },
      travelBufferMinutes: 0,
      weekendEmergencyOnly: false,
      workingRadiusMiles: null,
      emergencyHours: "",
    },
  };
}

/** Merges whatever is stored (possibly {}) over sensible defaults so
 * the diary always renders complete — the owner never meets a broken
 * or empty structure. */
export function parseAvailability(stored: unknown, opening?: string, closing?: string): Availability {
  const base = defaultAvailability(opening, closing);
  if (!stored || typeof stored !== "object") return base;
  const s = stored as Partial<Availability>;
  return {
    hours: { ...base.hours, ...(s.hours ?? {}) },
    daysOff: Array.isArray(s.daysOff) ? s.daysOff : [],
    fullyBooked: Array.isArray(s.fullyBooked) ? s.fullyBooked : [],
    rules: { ...base.rules, ...(s.rules ?? {}) },
  };
}

export function dayKeyForDate(date: Date): DayKey {
  return DAY_KEYS[(date.getDay() + 6) % 7] ?? "mon";
}

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type DayStanding =
  | { kind: "off"; reason: string }
  | { kind: "fully-booked" }
  | { kind: "closed" }
  | { kind: "open"; open: string; close: string };

/** What the diary says about a specific date — the one function the
 * whole app asks "are we available then?" */
export function standingForDate(availability: Availability, date: Date): DayStanding {
  const ds = toDateString(date);
  const off = availability.daysOff.find((d) => d.date === ds);
  if (off) return { kind: "off", reason: off.reason || "Day off" };
  if (availability.fullyBooked.includes(ds)) return { kind: "fully-booked" };
  const hours = availability.hours[dayKeyForDate(date)];
  if (hours.closed) return { kind: "closed" };
  return { kind: "open", open: hours.open, close: hours.close };
}

export function describeStanding(standing: DayStanding): string {
  switch (standing.kind) {
    case "off":
      return standing.reason;
    case "fully-booked":
      return "Fully booked";
    case "closed":
      return "Closed";
    case "open":
      return `${standing.open} – ${standing.close}`;
  }
}

/**
 * What she'd actually say if a customer asked "are you free today?" —
 * the same "teach it, watch it, trust it" proof the Receptionist and
 * Business Knowledge pages already have, built the same deterministic
 * way (real facts only, never guessed). Every booking rule that's
 * genuinely relevant today shows up here, so changing a rule visibly
 * changes what she'd say, the same as everywhere else in the product.
 */
export function describeBookingReply(availability: Availability, now: Date): string {
  const standing = standingForDate(availability, now);
  const parts: string[] = [];

  if (standing.kind === "open") {
    parts.push(`Yes — we're open today until ${standing.close}.`);
  } else if (standing.kind === "fully-booked") {
    parts.push("We're fully booked today, but I can offer you the next available day.");
  } else if (standing.kind === "off") {
    parts.push(`We're closed today (${standing.reason.toLowerCase()}), but I can find you a slot soon after.`);
  } else {
    parts.push("We're closed today, but I can find you a slot soon after.");
  }

  const { rules } = availability;
  if (rules.minNoticeHours > 0) {
    parts.push(`I'll just need ${rules.minNoticeHours} hour${rules.minNoticeHours === 1 ? "" : "s"}' notice.`);
  }
  if (rules.maxJobsPerDay !== null) {
    parts.push(`We take up to ${rules.maxJobsPerDay} job${rules.maxJobsPerDay === 1 ? "" : "s"} a day, so it's worth booking ahead.`);
  }
  if (rules.weekendEmergencyOnly && [0, 6].includes(now.getDay())) {
    parts.push("Weekends are for emergencies only, so I'd check if this can wait until Monday.");
  }

  return parts.join(" ");
}

/** Whether the owner has actually engaged with the diary's booking
 * rules at all, vs. sitting on the untouched defaults — the one
 * signal the shared intelligence model (lib/intelligence.ts) needs
 * from this file. A plain deep-compare against defaultAvailability's
 * rules, not a stored "touched" flag (none exists on the schema). */
export function hasCustomizedBookingRules(rules: BookingRules): boolean {
  const base = defaultAvailability().rules;
  return JSON.stringify(rules) !== JSON.stringify(base);
}

/** Same "touched vs. untouched default" signal as
 * `hasCustomizedBookingRules`, for the weekly hours grid instead of
 * booking rules — Meet Your Receptionist needs to know whether
 * weekend hours are real taught knowledge or just the untouched
 * Mon–Fri/weekends-closed default, so it can say honestly "I don't
 * yet know your weekend availability" rather than presenting a guess
 * as a fact. */
export function hasCustomizedHours(hours: Availability["hours"], opening?: string, closing?: string): boolean {
  const base = defaultAvailability(opening, closing).hours;
  return JSON.stringify(hours) !== JSON.stringify(base);
}

function sameHours(a: DayHours, b: DayHours): boolean {
  return a.closed === b.closed && a.open === b.open && a.close === b.close;
}

/** A compact, human weekly-hours summary — consecutive days with
 * identical hours collapse into one line ("Monday–Friday: 8:00–17:30")
 * instead of seven separate ones. Used by Meet Your Receptionist so
 * real diary data reads the same way there as it does everywhere else
 * this file already describes hours. */
export function describeWeeklyHours(hours: Availability["hours"]): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < DAY_KEYS.length) {
    const start = i;
    const day = hours[DAY_KEYS[i]!]!;
    let end = i;
    while (end + 1 < DAY_KEYS.length && sameHours(hours[DAY_KEYS[end + 1]!]!, day)) end++;
    const label =
      start === end ? DAY_LABELS[DAY_KEYS[start]!] : `${DAY_LABELS[DAY_KEYS[start]!]}–${DAY_LABELS[DAY_KEYS[end]!]}`;
    lines.push(`${label}: ${day.closed ? "Closed" : `${day.open}–${day.close}`}`);
    i = end + 1;
  }
  return lines;
}

/**
 * The first real day she could offer, forward-searching up to two
 * weeks using the same rules standingForDate already applies (day
 * off, fully booked, closed, minimum notice) — deliberately scoped to
 * diary rules only. It cannot see real per-day job load (maxJobsPerDay
 * needs a live count from the jobs table, a Supabase concern this pure
 * function has no access to), so callers should present this as "a
 * suggested day based on the diary," never a guaranteed slot, and
 * never narrow it to a time — no time-slot granularity exists anywhere
 * in the app (ReplyFlow never guesses).
 */
export function nextAvailableSlot(availability: Availability, from: Date): { date: Date; label: string } | null {
  const earliest = new Date(from);
  earliest.setHours(earliest.getHours() + availability.rules.minNoticeHours);

  for (let i = 0; i < 14; i++) {
    const candidate = new Date(earliest);
    candidate.setDate(candidate.getDate() + i);
    candidate.setHours(0, 0, 0, 0);
    if (standingForDate(availability, candidate).kind !== "open") continue;
    const isToday = toDateString(candidate) === toDateString(from);
    const label = isToday
      ? "later today"
      : candidate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
    return { date: candidate, label };
  }
  return null;
}
