"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, GraduationCap } from "lucide-react";
import { SettleCard, Reveal, press } from "@/components/shared/motion";
import { DOMAIN_META, groupTopicsByDomain } from "@/lib/everything-i-know-signals";
import type { BrainDomain, BrainTopic } from "@/lib/brain";
import { cn } from "@/lib/utils";

const DOMAIN_ORDER: BrainDomain[] = ["knowledge", "receptionist", "diary"];

/**
 * "What I'm still learning" — the Brain's real, complete gap list
 * (never capped at 3 the way Front Desk's Recommendations is; this
 * page's whole purpose is the full picture). Safety-critical gaps
 * (`important`) are visually distinct, not just first in a sort —
 * an owner scanning this page should see immediately which unknowns
 * genuinely matter.
 */
export function LearningTopics({ gaps }: { gaps: readonly BrainTopic[] }) {
  if (gaps.length === 0) {
    return (
      <SettleCard delay={0.1} className="rounded-2xl border border-success/25 bg-success/5 p-6 shadow-sm">
        <p className="text-[14px] font-semibold">I know everything I need right now.</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">If anything changes, I&apos;ll list it here.</p>
      </SettleCard>
    );
  }

  const grouped = groupTopicsByDomain(gaps);

  return (
    <SettleCard delay={0.1} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        What I&apos;m still learning
      </h2>
      <div className="space-y-5">
        {DOMAIN_ORDER.map((domain) => {
          const list = grouped[domain] ?? [];
          if (list.length === 0) return null;
          return (
            <div key={domain}>
              <h3 className="mb-2 text-[13px] font-bold tracking-tight">{DOMAIN_META[domain].heading}</h3>
              <div className="space-y-2">
                {list.map((topic, i) => (
                  <Reveal key={topic.id} index={i}>
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3.5",
                        topic.important ? "border-attention/25 bg-attention/[0.05]" : "border-border bg-muted/20"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                          topic.important ? "bg-attention/15 text-attention" : "bg-learning/10 text-learning"
                        )}
                      >
                        {topic.important ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <GraduationCap className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] leading-relaxed">{topic.prompt}</p>
                        <Link href={topic.href} className="mt-2 inline-block rounded-lg">
                          <motion.span
                            {...press}
                            className="flex min-h-[32px] items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground"
                          >
                            Teach me
                            <ArrowRight className="h-3.5 w-3.5" />
                          </motion.span>
                        </Link>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SettleCard>
  );
}
