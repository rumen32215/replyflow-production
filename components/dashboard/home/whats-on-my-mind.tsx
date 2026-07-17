import { SettleCard } from "@/components/shared/motion";
import { InsightList } from "@/components/shared/insight";
import type { Observation } from "@/lib/intelligence";

/**
 * The Brain's `observations` (lib/intelligence.ts) made visible — this
 * component owns no opinion about what's worth mentioning; `buildBrain()`
 * already decided that and ranked it. Renders nothing at all when
 * there's genuinely nothing to say (never an empty widget).
 */
export function WhatsOnMyMind({ observations }: { observations: readonly Observation[] }) {
  if (observations.length === 0) return null;

  return (
    <SettleCard delay={0.12} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        What I&apos;m thinking
      </p>
      <InsightList observations={observations} limit={3} />
    </SettleCard>
  );
}
