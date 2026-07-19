"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { SettleCard, Reveal, press, EASE } from "@/components/shared/motion";
import type { Topic } from "@/lib/intelligence";

/**
 * Section 6 — AI Recommendations (Feature 01). Spec: maximum three,
 * each must explain why / estimated benefit / suggested action, or it
 * doesn't appear at all. Sourced entirely from the shared Brain's real
 * gaps (`lib/intelligence.ts`) — safety-critical gaps (house rules,
 * escalation) always rank first, since teaching those genuinely
 * matters most. The "benefit" is an honest, general statement, never
 * a fabricated number — there's no scheduling or revenue engine behind
 * this yet, so nothing here claims one.
 *
 * Sprint 7.6: this used to have only two possible sentences (one for
 * `important`, one for not) — with up to three cards shown at once,
 * two of them would frequently read identically, which is exactly the
 * "repeating similar actions" feeling the sprint asked to remove. Six
 * variants (crossing the topic's real domain with its real importance)
 * make repetition rare without inventing anything — every sentence is
 * still just an honest restatement of facts the topic already carries.
 */
function benefitFor(topic: Topic): string {
  if (topic.domain === "receptionist") {
    return topic.important
      ? "Reduces the chance I get something important wrong."
      : "Helps me sound more like you when I reply.";
  }
  if (topic.domain === "diary") {
    return topic.important
      ? "Helps me protect your time from double-bookings."
      : "Helps me plan your day more accurately.";
  }
  return topic.important
    ? "Means I never guess something a customer asks about your business."
    : "Helps me answer this confidently instead of guessing.";
}

export function Recommendations({ gaps }: { gaps: readonly Topic[] }) {
  const ranked = [...gaps].sort((a, b) => Number(Boolean(b.important)) - Number(Boolean(a.important))).slice(0, 3);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = ranked.filter((t) => !dismissed.has(t.id));

  if (visible.length === 0) return null;

  return (
    <SettleCard delay={0.17}>
      <h2 className="mb-2.5 text-[15px] font-bold tracking-tight">Recommendations</h2>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {visible.map((topic, i) => (
            <Reveal key={topic.id} index={i}>
              <motion.div
                layout
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-semibold leading-snug">Teach me {topic.label}</p>
                  <button
                    type="button"
                    aria-label="Dismiss recommendation"
                    onClick={() => setDismissed((d) => new Set(d).add(topic.id))}
                    className="shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{topic.prompt}</p>
                <p className="mt-1.5 text-[12px] font-medium text-primary">{benefitFor(topic)}</p>
                <Link href={topic.href} className="mt-3 inline-block">
                  <motion.span
                    {...press}
                    className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground"
                  >
                    Teach me
                    <ArrowRight className="h-3.5 w-3.5" />
                  </motion.span>
                </Link>
              </motion.div>
            </Reveal>
          ))}
        </AnimatePresence>
      </div>
    </SettleCard>
  );
}
