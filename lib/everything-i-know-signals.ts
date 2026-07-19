/**
 * Everything I Know (Sprint 8 / Feature 11) — pure functions only, no
 * Supabase, no React. Same convention as lib/dashboard-signals.ts,
 * lib/mission-control-signals.ts, lib/customer-memory-signals.ts.
 *
 * This feature is the visible window into the Shared Brain (lib/brain)
 * — it invents nothing. Every helper here only groups, sorts, or
 * phrases facts `getBrainContext()` and the business's own rows
 * already produced. No sentiment, no intent detection, no evidence
 * scoring — that is real NLP/ML work the Feature 11/13 specs describe
 * that this product does not have (see Sprint 8 planning report).
 */

import type { BrainDomain, BrainTopic } from "@/lib/brain";

export const DOMAIN_META: Record<BrainDomain, { heading: string; verb: string }> = {
  knowledge: { heading: "Your business", verb: "know" },
  receptionist: { heading: "How I should behave", verb: "know" },
  diary: { heading: "Your diary", verb: "know" },
};

export function groupTopicsByDomain(topics: readonly BrainTopic[]): Record<BrainDomain, BrainTopic[]> {
  const grouped: Record<BrainDomain, BrainTopic[]> = { knowledge: [], receptionist: [], diary: [] };
  for (const topic of topics) {
    const list = grouped[topic.domain];
    if (list) list.push(topic);
  }
  return grouped;
}

/**
 * "What changed recently" reads two real `updated_at` columns
 * (`businesses`, `ai_configurations`) — the only change-recency data
 * that actually exists. Neither table tracks *which* field changed or
 * a full history, only "this row was last written to at time T", so
 * the copy stays honestly general ("your business & diary details")
 * rather than claiming a specific fact was taught (a genuine schema
 * limitation — see the Sprint 8 report). Only surfaced when the write
 * was genuinely recent; older than the window, it's simply omitted —
 * "recently" shouldn't stretch to cover a change from four months ago.
 */
const RECENT_WINDOW_DAYS = 14;

export function formatRecentChange(label: string, updatedAt: string, createdAt: string): string | null {
  const updated = new Date(updatedAt).getTime();
  const created = new Date(createdAt).getTime();
  // Never written to since the row was first created — nothing to report.
  if (updated <= created + 60_000) return null;

  const daysAgo = (Date.now() - updated) / (1000 * 60 * 60 * 24);
  if (daysAgo > RECENT_WINDOW_DAYS) return null;

  if (daysAgo < 1) return `${label} — updated earlier today.`;
  const days = Math.round(daysAgo);
  return `${label} — updated ${days} ${days === 1 ? "day" : "days"} ago.`;
}
