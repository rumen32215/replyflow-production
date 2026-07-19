"use client";

import Link from "next/link";
import { AlertTriangle, Check, Eye, GraduationCap, Sparkles, type LucideIcon } from "lucide-react";
import type { Observation } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

/**
 * The Brain's visual voice — one primitive, used identically wherever
 * ReplyFlow has something to say. This component has no opinion about
 * *what* to show — that decision already happened in `buildBrain()`
 * (lib/intelligence.ts). It only renders whichever `Observation`s it's
 * handed, consistently, so an observation looks and feels the same on
 * Front Desk, Receptionist, or Diary — one continuous intelligence,
 * not per-page tips that happen to share a colour.
 */

// Exported so other Brain-voice layouts (e.g. Front Desk's Recent
// Learning timeline) reuse the exact same icon/colour vocabulary
// instead of redeclaring it — one mind, rendered consistently.
export const TONE_ICON: Record<Observation["tone"], LucideIcon> = {
  watching: Eye,
  worry: AlertTriangle,
  learning: GraduationCap,
  handled: Check,
  confident: Sparkles,
};

// Same two tokens `StatusPill` and `ConfidenceBar` read — `learning`
// (purple) means growth/brain-activity everywhere, `attention` (amber)
// means "worth noticing, not urgent" everywhere. "handled" fades into
// the background on purpose (Front Desk rule: completed work fades).
export const TONE_STYLE: Record<Observation["tone"], string> = {
  watching: "bg-attention/10 text-attention",
  worry: "bg-attention/10 text-attention",
  learning: "bg-learning/10 text-learning",
  handled: "bg-muted text-muted-foreground",
  confident: "bg-success/10 text-success",
};

export function Insight({ observation, className }: { observation: Observation; className?: string }) {
  const Icon = TONE_ICON[observation.tone];
  const content = (
    <div className={cn("flex items-center gap-2.5 text-[13.5px]", className)}>
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", TONE_STYLE[observation.tone])}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className={observation.href ? "font-medium text-foreground" : "text-muted-foreground"}>
        {observation.text}
      </span>
    </div>
  );

  return observation.href ? (
    <Link href={observation.href} className="-mx-1 block rounded-lg px-1 py-0.5 transition-colors hover:bg-muted/50">
      {content}
    </Link>
  ) : (
    content
  );
}

/** Renders up to `limit` observations, in the order the Brain already
 * ranked them, or nothing at all if there's genuinely nothing to say —
 * never an empty widget, never padding with filler. */
export function InsightList({
  observations,
  limit = 1,
  className,
}: {
  observations: readonly Observation[];
  limit?: number;
  className?: string;
}) {
  const shown = observations.slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {shown.map((o) => (
        <Insight key={o.id} observation={o} />
      ))}
    </div>
  );
}
