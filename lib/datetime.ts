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
