"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { GentleSwap } from "@/components/shared/motion";

/**
 * Front Desk's own loading state — more specific than the generic
 * (dashboard) group fallback (Sprint 2A), just for this route. Feature
 * 01: "Never use empty white screens. Skeleton cards appear
 * immediately. Greeting loads first. Priority second... Loading
 * should feel intelligent," with the exact rotating copy the spec
 * names rather than a bare spinner.
 */
const MESSAGES = ["Organising today's work...", "Reviewing overnight conversations...", "Checking today's diary..."] as const;

function RotatingCaption() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), 1300);
    return () => clearInterval(t);
  }, []);
  return (
    <GentleSwap swapKey={index}>
      <p className="text-[13px] text-muted-foreground">{MESSAGES[index]}</p>
    </GentleSwap>
  );
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-6 shadow-sm ${className ?? ""}`}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-5 w-2/3" />
      <Skeleton className="mt-2 h-3.5 w-full" />
      <Skeleton className="mt-1.5 h-3.5 w-4/5" />
    </div>
  );
}

export default function FrontDeskLoading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-7">
      {/* Greeting loads first. */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3.5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <RotatingCaption />
          </div>
        </div>
      </div>

      {/* Priority second — the largest, most prominent skeleton. */}
      <CardSkeleton className="sm:p-8" />

      {/* Everything else progressively fills. */}
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
