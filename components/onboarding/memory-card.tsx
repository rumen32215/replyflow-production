"use client";

import { motion } from "framer-motion";
import { GlowCard } from "@/components/shared/glow-card";
import { EASE, GrowingCheck } from "@/components/shared/motion";

/**
 * V22 — the visible memory of the encounter. One card per completed
 * fact, real data only: a category, the actual value(s) just given,
 * and the exact completion status the founder specified per card
 * (`lib/onboarding-script.ts`'s `CARD_META`). No ellipsis menu, no
 * progress bar, no avatar images, no countdown — every element here
 * maps to something real or it doesn't exist on the card at all.
 */
export function MemoryCard({
  label,
  status,
  lines,
  delay = 0,
}: {
  label: string;
  status: string;
  /** One or more real values — a single name, several areas, two
   * knowledge notes. Rendered as separate lines, never truncated into
   * one sentence that hides how many things were actually captured. */
  lines: string[];
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
    >
      <GlowCard className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/80">{label}</span>
          <GrowingCheck className="h-4 w-4 shrink-0" delay={delay + 0.25} />
        </div>
        <div className="mt-2 space-y-1">
          {lines.map((line, i) => (
            <p key={i} className="text-[15px] font-semibold leading-snug text-foreground">
              {line}
            </p>
          ))}
        </div>
        <p className="mt-3 text-[12px] font-medium text-success">✓ {status}</p>
      </GlowCard>
    </motion.div>
  );
}
