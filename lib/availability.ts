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
