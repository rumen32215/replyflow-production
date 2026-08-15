/**
 * ReplyFlow V4 (Conversation Episodes, Phase 3) — the one place "what
 * time is it right now, in the business's own timezone" is computed.
 * Production runs in UTC; without this, "tomorrow" has no real
 * grounding — a live test found the AI never resolving a customer's
 * own proposed time into anything storable. UK-only for now
 * (Europe/London), matching the current single-market launch.
 *
 * Pure and timezone-explicit deliberately: `new Date().toLocaleDateString()`
 * on a UTC server silently uses UTC, which is wrong for London for
 * roughly half the year (BST) — Intl's `timeZone` option is the only
 * part of this that must never be left to the server's own default.
 */

import * as chrono from "chrono-node";

const LONDON_TZ = "Europe/London";

/** A plain, human-readable "right now" — grounds the model's own
 * relative-date reasoning ("tomorrow", "next Tuesday") in a real,
 * stated fact rather than assumed training-time knowledge. */
export function formatNowLondon(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Today's date only, London-local, as YYYY-MM-DD — for anything that
 * needs to compare against a calendar day rather than read a sentence. */
export function todayLondonDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: LONDON_TZ }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/**
 * A real production bug, found and traced from a live "tomorrow at
 * 10am" booking: classifyMessage() gives the model a bare local time
 * via formatNowLondon() ("Wednesday, 12 August 2026, 14:30") with no
 * UTC offset, then asks it to resolve the customer's request into a
 * "Z"-suffixed UTC timestamp. The model has no way to do that
 * conversion correctly — it just wrote the London wall-clock digits it
 * reasoned about with a "Z" appended, silently mislabelling BST
 * (UTC+1 in summer) as UTC. "10am" became "10:00:00.000Z" — actually
 * 11am once correctly converted back to London time for display,
 * instead of the 10am the customer asked for.
 *
 * This is the fix: never trust a suffix the model attaches (even
 * though the prompt no longer asks for one) — always treat the literal
 * digits as a London *local* wall-clock time, then convert to the
 * correct UTC instant here, deterministically, accounting for
 * whichever offset (BST or GMT) is actually in effect on that specific
 * date. No DST rules are hardcoded — the real offset is read back from
 * Intl for the exact date in question, so this stays correct across
 * every DST transition, not just "always +1 in August".
 *
 * Returns null for anything that doesn't parse as a real date/time —
 * the same "never propagate a malformed value" discipline every other
 * defensive parser in this codebase already follows.
 */
export function londonWallClockToUtcIso(localWallClock: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(localWallClock.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s ?? "0");
  if ([year, month, day, hour, minute, second].some((n) => Number.isNaN(n))) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;

  // Step 1: treat the wall-clock digits as if they were already a UTC
  // instant — just a starting guess to anchor which date/DST regime
  // we're asking about.
  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(guessUtcMs)) return null;

  // Step 2: ask what London local time that guessed instant actually
  // corresponds to. The difference between what we asked for and what
  // we got back is the real UTC offset in effect on this date.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(guessUtcMs));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const guessAsLondonMs = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  const offsetMs = guessAsLondonMs - guessUtcMs;

  // Step 3: subtract that offset from the guess — this is the real UTC
  // instant whose London-local wall-clock time is exactly what was asked for.
  return new Date(guessUtcMs - offsetMs).toISOString();
}

/** `messageTimestamp`'s own London wall-clock digits, packed into a
 * plain UTC-labelled Date — the same "borrow Date's UTC getters/setters
 * to do calendar arithmetic that's actually London-local" trick
 * londonWallClockToUtcIso uses, needed here so chrono-node's own
 * relative-date math ("tomorrow", "next Monday") runs against the
 * calendar day it actually was in London, not whatever day UTC says it
 * was — those can differ for part of every day, all year round. */
function londonWallClockPartsAsUtcDate(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second")));
}

/**
 * Deterministically resolves a customer's own free-text timing ("2pm
 * Monday", "tomorrow morning", "next Friday") into a real UTC instant —
 * replacing what used to be the classification model's own mental date
 * arithmetic (lib/reply-engine/understanding/classify.ts, before this
 * change), which had no reliable way to get "which Monday" or DST-
 * correct offsets right and was never asked to check its own work.
 * chrono-node is a plain, well-tested calendar-math library, not a
 * second AI call — the same "deterministic wherever the task is
 * deterministic" discipline londonWallClockToUtcIso above already
 * follows for the timezone half of this same problem.
 *
 * Reads chrono's own parsed *components* (year/month/day/hour/minute)
 * rather than the Date instant chrono.parseDate() would hand back —
 * deliberately: that Date-round-trip turned out to depend on the
 * running process's own local timezone in a way that only shows up
 * when the process isn't running in UTC (caught by this function's own
 * tests failing on a machine whose local zone happens to be Europe/
 * London — exactly the class of bug this whole file exists to prevent
 * happening in production, where the server does run in UTC).
 * Component extraction has no such dependency: the numbers chrono
 * parsed are read directly, then handed to the existing, already-
 * correct londonWallClockToUtcIso for the actual DST-aware conversion.
 *
 * Only ever resolves when chrono marks the hour component "certain" —
 * i.e. the customer actually stated a time ("at 2pm", "around 4pm").
 * "next Monday" alone, with no time, correctly returns null rather
 * than inventing a default hour — the same "never assume a time of day
 * that wasn't stated" rule the classification prompt used to state to
 * the model now enforced deterministically instead. A date left
 * unstated (just "around 4pm", no day mentioned) is the one place a
 * default is legitimate — chrono then reads it off the reference
 * date's own calendar day, i.e. "today" relative to the message.
 */
export function resolvePreferredDateTime(text: string, messageTimestamp: Date): string | null {
  const referenceAsLondonCalendar = londonWallClockPartsAsUtcDate(messageTimestamp);
  const results = chrono.parse(text, referenceAsLondonCalendar, { forwardDate: true });
  const component = results[0]?.start;
  if (!component || !component.isCertain("hour")) return null;

  const year = component.get("year");
  const month = component.get("month");
  const day = component.get("day");
  const hour = component.get("hour");
  if (year == null || month == null || day == null || hour == null) return null;
  const minute = component.get("minute") ?? 0;
  const second = component.get("second") ?? 0;

  const pad = (n: number) => String(n).padStart(2, "0");
  return londonWallClockToUtcIso(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`);
}
