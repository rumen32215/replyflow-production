/**
 * Pure policy for ai-rate-limit.ts, deliberately kept free of the
 * `server-only` guard so it can be unit-tested directly — the same
 * split used for lib/reply-engine/llm/pricing.ts (0.1).
 *
 * The threshold is deliberately generous, not finely tuned: real
 * production telemetry (from 0.1's own ai_usage_events) shows the
 * Receptionist teaching page's live preview alone fires a legitimate
 * burst of 8 real completion calls (1 main reply + 3 tone examples,
 * each a classify+generate pair) on every taught change, debounced but
 * repeatable several times a minute during an active teaching session.
 * This exists to put a hard ceiling on a genuinely uncapped loop (the
 * exact failure mode 0.2 fixes for the onboarding demo) — not to
 * police normal use. Treat these numbers as a conservative starting
 * ceiling to tighten later using real usage data, not values tuned
 * from assumptions.
 */
export const WINDOW_SECONDS = 120;
export const MAX_EVENTS_PER_WINDOW = 120;

export function isOverLimit(recentEventCount: number): boolean {
  return recentEventCount >= MAX_EVENTS_PER_WINDOW;
}
