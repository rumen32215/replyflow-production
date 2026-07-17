"use client";

import Link from "next/link";
import { AlertTriangle, Check, Eye, type LucideIcon } from "lucide-react";
import { SettleCard } from "@/components/shared/motion";
import type { Brain } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

/**
 * The Brain's `thoughts` (lib/intelligence.ts) made visible — not a
 * new signal, just the first place any of it is actually shown. What
 * it's watching, what it's already handled today, and the single
 * safety-critical gap that still worries it most (untaught rules or
 * escalation rank first). Real facts only — never fabricated, and it
 * renders nothing at all when there's genuinely nothing to say (never
 * an empty widget).
 */
export function WhatsOnMyMind({ thoughts }: { thoughts: Brain["thoughts"] }) {
  const rows: { icon: LucideIcon; text: string; href?: string }[] = [
    ...thoughts.watching.map((text) => ({ icon: Eye, text })),
    ...thoughts.handled.map((text) => ({ icon: Check, text })),
  ];
  const topWorry = thoughts.worriesAbout[0];
  if (topWorry) {
    rows.push({ icon: AlertTriangle, text: `Still worries me: ${topWorry.label}`, href: topWorry.href });
  }

  if (rows.length === 0) return null;

  return (
    <SettleCard delay={0.12} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        What I&apos;m thinking
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => {
          const Icon = row.icon;
          const content = (
            <div className="flex items-center gap-2.5 text-[13.5px]">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  row.href ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className={row.href ? "font-medium text-foreground" : "text-muted-foreground"}>{row.text}</span>
            </div>
          );
          return row.href ? (
            <Link
              key={i}
              href={row.href}
              className="-mx-1 block rounded-lg px-1 py-0.5 transition-colors hover:bg-muted/50"
            >
              {content}
            </Link>
          ) : (
            <div key={i}>{content}</div>
          );
        })}
      </div>
    </SettleCard>
  );
}
