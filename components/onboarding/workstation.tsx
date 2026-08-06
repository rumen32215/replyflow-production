"use client";

import { motion } from "framer-motion";
import { Wrench, Zap, Paintbrush, Hammer, Home, MapPin, type LucideIcon } from "lucide-react";
import { EASE } from "@/components/shared/motion";
import { ONBOARDING_TRADE_LABELS, type ONBOARDING_TRADES } from "@/lib/trades";
import { cn } from "@/lib/utils";

/**
 * V22 — rebuilt properly in React from the disposable HTML prototype's
 * *concept* only (six real permanent parts of the product: Identity,
 * Trade, Coverage, Availability, Knowledge, Communication), not its
 * markup or CSS. Every object is driven entirely by props — no
 * internal timers, no wake-chain of its own. The parent step machine
 * is the single source of truth for what's known; this component only
 * ever asks "is this fact real yet," and if so, renders it.
 */

const TRADE_ICONS: Record<string, LucideIcon> = {
  plumbing: Wrench,
  electrical: Zap,
  painting: Paintbrush,
  building: Hammer,
  roofing: Home,
};

function toClockAngle(t: string): number {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  return ((h % 12) + m / 60) / 12 * 360;
}

function ObjectShell({
  awake,
  className,
  title,
  children,
}: {
  awake: boolean;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      title={title}
      animate={{
        borderStyle: awake ? "solid" : "dashed",
        borderColor: awake ? "hsl(var(--border))" : "hsl(var(--border) / 0.6)",
      }}
      transition={{ duration: 0.4, ease: EASE }}
      className={cn(
        "relative flex items-center justify-center rounded-2xl border-[1.5px] transition-colors",
        awake ? "bg-muted/60" : "bg-transparent",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

export function Workstation({
  businessName,
  trade,
  areas,
  hours,
  hasMemory,
  activated,
}: {
  businessName: string | null;
  trade: string | null;
  areas: string[];
  hours: { opening: string; closing: string } | null;
  hasMemory: boolean;
  activated: boolean;
}) {
  const TradeIcon = trade ? TRADE_ICONS[trade] : null;
  const tradeLabel = trade ? ONBOARDING_TRADE_LABELS[trade as (typeof ONBOARDING_TRADES)[number]] ?? trade : null;

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-elevated">
      {/* Coverage panel */}
      <ObjectShell awake={areas.length > 0} className="mb-3 h-20 overflow-hidden">
        {areas.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5 px-3">
            {areas.slice(0, 4).map((area) => (
              <motion.span
                key={area}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-primary"
              >
                <MapPin className="h-2.5 w-2.5" />
                {area}
              </motion.span>
            ))}
            {areas.length > 4 && (
              <span className="text-[11px] font-semibold text-muted-foreground">+{areas.length - 4}</span>
            )}
          </div>
        ) : (
          <MapPin className="h-4 w-4 text-muted-foreground/30" aria-hidden />
        )}
      </ObjectShell>

      {/* Desk row: tool / notebook / clock / phone */}
      <div className="grid grid-cols-4 gap-2.5">
        <ObjectShell awake={!!trade} className="h-16" title={tradeLabel ?? undefined}>
          {TradeIcon ? (
            <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 22 }}>
              <TradeIcon className="h-5 w-5 text-primary" />
            </motion.span>
          ) : (
            <Wrench className="h-4 w-4 text-muted-foreground/30" aria-hidden />
          )}
        </ObjectShell>

        <ObjectShell awake={hasMemory} className="h-16">
          <motion.div
            animate={{ scaleY: hasMemory ? 1 : 0.85 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex h-8 w-6 flex-col justify-center gap-1 rounded-sm border border-border/70 bg-card p-1"
          >
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: hasMemory ? "100%" : "0%" }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
              className="h-[2px] rounded-full bg-primary"
            />
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: hasMemory ? "70%" : "0%" }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.22 }}
              className="h-[2px] rounded-full bg-success"
            />
          </motion.div>
        </ObjectShell>

        <ObjectShell awake={!!hours} className="h-16">
          <div className="relative h-8 w-8 rounded-full border border-border/70">
            {hours && (
              <motion.div
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(from ${toClockAngle(hours.opening) - 90}deg, hsl(var(--success) / 0.25) 0deg, hsl(var(--success) / 0.25) ${Math.max(0, toClockAngle(hours.closing) - toClockAngle(hours.opening))}deg, transparent 0deg)`,
                }}
              />
            )}
            <motion.span
              aria-hidden
              animate={hours ? { rotate: 360 } : { rotate: 0 }}
              transition={hours ? { duration: 8, repeat: Infinity, ease: "linear" } : { duration: 0 }}
              className="absolute left-1/2 top-1/2 h-3 w-[1.5px] origin-bottom -translate-x-1/2 -translate-y-full bg-primary"
            />
          </div>
        </ObjectShell>

        <ObjectShell awake={activated} className="h-16">
          <motion.div
            animate={
              activated
                ? { opacity: [0.5, 1, 0.5], scale: [1, 1.06, 1] }
                : { opacity: 0.25, scale: 1 }
            }
            transition={activated ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
            className={cn("h-6 w-4 rounded-[3px]", activated ? "bg-gradient-to-br from-primary to-success" : "bg-muted-foreground/20")}
          />
        </ObjectShell>
      </div>

      {/* Nameplate */}
      <motion.div
        animate={{
          background: businessName ? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--success)))" : "transparent",
          borderStyle: businessName ? "solid" : "dashed",
        }}
        transition={{ duration: 0.4, ease: EASE }}
        className="mt-3 flex h-9 items-center justify-center rounded-xl border-[1.5px] border-border/70 px-3"
      >
        {businessName ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="truncate text-[12px] font-bold tracking-wide text-white"
          >
            {businessName}
          </motion.span>
        ) : (
          <span className="text-[11px] font-medium text-muted-foreground/40">Not yet named</span>
        )}
      </motion.div>
    </div>
  );
}
