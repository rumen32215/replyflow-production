"use client";

import Link from "next/link";
import { SettleCard, Reveal } from "@/components/shared/motion";
import { TONE_ICON, TONE_STYLE } from "@/components/shared/insight";
import type { Observation } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

/**
 * Section 8 — Recent Learning (Feature 01). Spec: "uses timeline
 * layout... growth should feel alive, never like statistics." The
 * Brain's `observations` (lib/intelligence.ts) are already ranked by
 * real importance — this renders them as a connected timeline instead
 * of a flat list, reusing the exact icon/colour vocabulary from
 * `components/shared/insight.tsx` rather than inventing a second one.
 * Renders nothing at all when there's genuinely nothing to say.
 *
 * "use client" (Sprint 6 fix, discovered during migration
 * verification, unrelated to the Brain migration itself): TONE_ICON's
 * values are dynamically indexed (`TONE_ICON[o.tone]`) from
 * insight.tsx, a "use client" module — the RSC bundler can't resolve
 * that dynamic lookup into its client manifest from a Server
 * Component, which threw "Could not find the module in the React
 * Client Manifest" the first time this component actually rendered
 * with real data. Same pattern already used successfully by its
 * sibling, recommendations.tsx.
 */
export function RecentLearning({ observations }: { observations: readonly Observation[] }) {
  const shown = observations.slice(0, 4);
  if (shown.length === 0) return null;

  return (
    <SettleCard delay={0.23} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Recent learning</h2>
      <div className="space-y-4">
        {shown.map((o, i) => {
          const Icon = TONE_ICON[o.tone];
          const isLast = i === shown.length - 1;
          const content = (
            <div className="flex gap-3">
              <div className="relative flex flex-col items-center">
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", TONE_STYLE[o.tone])}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {!isLast && <span aria-hidden className="mt-1 w-px flex-1 bg-border" />}
              </div>
              <p
                className={cn(
                  "pb-4 text-[13.5px] leading-relaxed",
                  o.href ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {o.text}
              </p>
            </div>
          );
          return (
            <Reveal key={o.id} index={i}>
              {o.href ? (
                <Link href={o.href} className="-m-1 block rounded-lg p-1 transition-colors hover:bg-muted/50">
                  {content}
                </Link>
              ) : (
                content
              )}
            </Reveal>
          );
        })}
      </div>
    </SettleCard>
  );
}
