"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

/**
 * V18 founder review (2026-08-04): the flow is internally built around
 * a "one-minute setup" (`use-onboarding-store.ts`'s own doc comment)
 * but never tells the person filling it in how much is left — the
 * single most consistently-cited, lowest-risk lever in onboarding
 * research (the goal-gradient effect: a partially-filled bar
 * measurably lifts completion). One shared, tiny component rather than
 * a bespoke bar per screen, reusing the same `EASE` curve and
 * `primary`->`success` gradient every other multi-step reveal on this
 * page already uses.
 *
 * Deliberately just a track + label, not a numbered stepper — the flow
 * is strictly linear with no back-and-forth between named sections, so
 * a stepper's extra affordance (jumping between named steps) would be
 * decoration nothing here uses.
 */
export function OnboardingProgress({
  step,
  total,
  caption,
}: {
  step: number;
  total: number;
  caption?: string;
}) {
  const pct = Math.min(100, Math.max(0, (step / total) * 100));

  return (
    <div className="mb-7">
      <div className="mb-2 flex items-center justify-between text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground/80">
        <span>
          Step {step} of {total}
        </span>
        {caption && <span className="normal-case tracking-normal text-muted-foreground/70">{caption}</span>}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
        <motion.div
          className={cn("h-full rounded-full bg-gradient-to-r from-primary to-success")}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: EASE }}
        />
      </div>
    </div>
  );
}

/** Pathname -> step index, for the 4 screens sharing `OnboardingLayout`.
 * `/welcome` isn't here — it lives in a separate route group (`(auth)`)
 * and renders its own `OnboardingProgress` directly (always step 1). */
export const ONBOARDING_STEP_MAP: Record<string, number> = {
  "/onboarding/business-name": 2,
  "/onboarding/trade": 3,
  "/onboarding/service-area": 4,
  "/onboarding/preparing": 5,
};
export const ONBOARDING_TOTAL_STEPS = 5;
