import { joinList } from "@/lib/knowledge";

/**
 * What a drafted reply actually leans on, in plain terms — turns the
 * Reply Engine's internal fact-grounding ids (Sprint 10A) into the one
 * trust signal that matters: not *that* it's grounded, but *in what*.
 * Category-level only — never claims a specific fact wasn't shown here
 * to keep the summary honest.
 *
 * Extracted out of components/dashboard/conversations/conversation-story.tsx
 * (Master Execution Plan 3.3) so the read-only admin conversation view
 * (app/admin/conversations/[id]/page.tsx, a Server Component) can reuse
 * the exact same logic without importing from a "use client" module —
 * conversation-story.tsx now imports this instead of defining its own
 * copy, so there's one source of truth, not two.
 */
const FACT_SOURCE_LABELS: Record<string, string> = {
  profile: "your business details",
  receptionist: "your FAQs",
  diary: "your diary",
  customer: "this customer's history",
};

export function factSourceSummary(factsUsed: string[] | null | undefined): string | null {
  if (!Array.isArray(factsUsed) || factsUsed.length === 0) return null;
  const prefixes = Array.from(new Set(factsUsed.map((id) => id.split(".")[0])));
  const labels = prefixes.map((p) => (p ? FACT_SOURCE_LABELS[p] : undefined)).filter((l): l is string => Boolean(l));
  return labels.length > 0 ? joinList(labels) : null;
}
