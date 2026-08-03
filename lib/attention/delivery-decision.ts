import type { AttentionTier } from "./tiering";

/**
 * Owner Attention Architecture, §4 (avoiding noise) — the concrete
 * mechanisms, not just the intent. Pure and deterministic; every input
 * is a primitive the caller already has, so this stays directly
 * testable without a clock mock or a database.
 */

const TIME_ZONE = "Europe/London";

/** Below this, a repeat "now" nudge about the same still-unresolved
 * urgent fact would itself become the noise this architecture exists
 * to prevent — genuinely urgent, but not urgent enough to justify a
 * fresh interruption every single cron tick. A tunable default (doc 14
 * §9), not a permanent architectural choice. */
const NOW_COOLDOWN_MINUTES = 45;

/** "Today"-tier items are expected, routine, and already tolerant of a
 * few hours' delay by definition (doc 14 §2.2) — a longer cooldown
 * keeps a business with a steady trickle of enquiries to one or two
 * nudges across a working day, not one per item. */
const TODAY_COOLDOWN_MINUTES = 240;

function minutesBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 60_000;
}

/** The business's local wall-clock "HH:MM", pinned to Europe/London —
 * same convention and reasoning as `lib/work-card-format.ts`'s
 * `formatDateTime` (server/client must agree regardless of which
 * machine's local timezone is running the code). */
function localTimeOfDay(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIME_ZONE }).format(now);
}

function toMinutesSinceMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** `openingTime`/`closingTime` are the same `businesses.opening_time` /
 * `closing_time` columns the diary already uses — real, owner-set data,
 * reused rather than a new quiet-hours concept invented for this. */
export function isWithinQuietHours(now: Date, openingTime: string, closingTime: string): boolean {
  const nowMinutes = toMinutesSinceMidnight(localTimeOfDay(now));
  const openMinutes = toMinutesSinceMidnight(openingTime);
  const closeMinutes = toMinutesSinceMidnight(closingTime);
  if (openMinutes === closeMinutes) return false; // a degenerate "always open" config never counts as quiet
  return nowMinutes < openMinutes || nowMinutes >= closeMinutes;
}

export interface DeliveryDecisionInput {
  tier: AttentionTier;
  now: Date;
  /** The most recent time this business was actually notified, for any
   * tier — `null` means never. Read from the most recent
   * `attention.notified` product_events row (no new table). */
  lastNotifiedAt: Date | null;
  openingTime: string;
  closingTime: string;
  /** From `crossesQuietHours()` (tiering.ts) — kept as an explicit
   * input rather than recomputed here, so this module never needs to
   * know what a snapshot looks like. */
  crossesQuietHours: boolean;
}

/**
 * The single yes/no this whole module exists to answer, folding
 * together every §4 rule: tiering already filtered (§4.1), this
 * applies the cooldown (§4.2) and quiet-hours (§4.4) rules together.
 * Suppression on resolution (§4.3) is not this function's job — it's
 * satisfied structurally by always calling this against a freshly
 * computed snapshot, never a stale one.
 */
export function shouldDeliver(input: DeliveryDecisionInput): boolean {
  if (input.tier === "none") return false;

  const inQuietHours = isWithinQuietHours(input.now, input.openingTime, input.closingTime);
  if (inQuietHours && !input.crossesQuietHours) return false;

  const cooldownMinutes = input.tier === "now" ? NOW_COOLDOWN_MINUTES : TODAY_COOLDOWN_MINUTES;
  if (input.lastNotifiedAt && minutesBetween(input.now, input.lastNotifiedAt) < cooldownMinutes) return false;

  return true;
}
