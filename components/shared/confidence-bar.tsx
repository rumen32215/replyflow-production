"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/shared/motion";
import { confidenceLabelFor } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

/**
 * The growth indicator — colour communicates where the receptionist
 * genuinely stands, not a generic blue bar for every value. Extracted
 * from Business Knowledge's original inline block so growth reads
 * identically wherever it's shown, not reinvented per page.
 *
 * "Growing" (the middle tier) uses the `learning` token — Design
 * System: purple means learning/growth — the same token `StatusPill`
 * and `Insight` use for the same idea. "Learning" (the earliest,
 * just-starting tier) stays neutral on purpose: nothing to celebrate
 * yet, so it shouldn't compete for attention.
 */

const CONFIDENCE_STYLE: Record<"Learning" | "Growing" | "Complete", { bar: string; text: string }> = {
  Complete: { bar: "bg-success", text: "text-success" },
  Growing: { bar: "bg-learning", text: "text-learning" },
  Learning: { bar: "bg-muted-foreground/40", text: "text-muted-foreground" },
};

export function ConfidenceBar({
  title,
  percent,
  caption,
}: {
  title: string;
  percent: number;
  /** Defaults to the same "N% of what I could know" phrasing Business
   * Knowledge already used — override for a page-specific fact. */
  caption?: string;
}) {
  const label = confidenceLabelFor(percent);
  const style = CONFIDENCE_STYLE[label];

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
        <span className={cn("text-[13px] font-bold", style.text)}>{label}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("h-full rounded-full", style.bar)}
          initial={false}
          animate={{ width: `${Math.max(percent, 4)}%` }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{caption ?? `${percent}% of what I could know`}</p>
    </div>
  );
}
