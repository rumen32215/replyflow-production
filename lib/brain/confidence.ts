/**
 * Confidence calculation — moved unchanged from lib/intelligence.ts
 * (Sprint 6 migration). A single, deterministic mapping from the
 * Brain's completion percentage to the only vocabulary ever shown to
 * an owner (Shared Brain Architecture doc: "Confidence is not a
 * percentage shown to users"). Kept in its own file so every future
 * Brain module that needs to label a percentage reads from the same
 * one place, rather than each re-deriving its own thresholds.
 */
export function confidenceLabelFor(percent: number): "Learning" | "Growing" | "Complete" {
  if (percent >= 100) return "Complete";
  if (percent >= 50) return "Growing";
  return "Learning";
}
