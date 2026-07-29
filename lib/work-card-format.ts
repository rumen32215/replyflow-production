/**
 * Pure formatting helpers for the Work Card detail page (Master
 * Execution Plan 2.1), kept free of any client-only dependency so
 * they're directly unit-testable — the same split used throughout
 * (pricing.ts, error-events-format.ts, incident-alert-format.ts).
 */

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
