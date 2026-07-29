/**
 * Pure formatting helpers for the Work Card detail page (Master
 * Execution Plan 2.1), kept free of any client-only dependency so
 * they're directly unit-testable — the same split used throughout
 * (pricing.ts, error-events-format.ts, incident-alert-format.ts).
 *
 * Every `toLocaleString`/`toLocaleDateString` call below pins an
 * explicit `timeZone` — found the hard way, verified against real
 * production: without it, a Client Component's server-rendered HTML
 * (Vercel's server timezone) and its client hydration (the browser's
 * local timezone) can format the identical timestamp as different
 * text, which is a hydration mismatch (React errors #418/#422/#425).
 * That mismatch was confirmed live — it silently broke the status
 * badge's ability to visually update after a real, successful status
 * change (the database write worked; the UI just stopped
 * re-rendering correctly). Pinning the timezone makes server and
 * client always agree, regardless of which machine runs the code.
 * "Europe/London" matches this product's real market — every other
 * date display in the app already uses "en-GB" formatting.
 */

const TIME_ZONE = "Europe/London";

/** For a `datetime-local` input's value, which needs local time with
 * no timezone suffix. */
export function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A Google Maps search URL — no API key needed, works universally.
 * Encoded, so an address containing spaces/commas/unicode never
 * breaks the link. */
export function mapsHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });
}
