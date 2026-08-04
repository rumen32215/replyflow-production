"use client";

import { CalendarCheck, MessageCircle, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { EASE, ScrollReveal } from "@/components/shared/motion";

/**
 * Landing Experience, Section 2 — The Invisible Weight
 * (`DOCS/SPECS/ReplyFlow-Landing-Experience-Design.md` §3).
 *
 * Sixth founder review (2026-08-04) — the biggest content change of
 * this pass. The previous version quoted Founder Handbook Ch.01's four
 * "Did I..." questions directly; the founder's own instruction here
 * was explicit: stop naming the worry, start showing the answer to
 * it — a quiet preview of what ReplyFlow actually keeps track of,
 * closer to a dashboard teaser than a list of anxieties. The one line
 * from the old version the founder singled out as already right (*"The
 * mental load is often far bigger than the physical work"*) survives,
 * moved to the top as the section's opening thought rather than its
 * closing one — recognition first, then the demonstration.
 *
 * The four rows below reuse the product's own real status vocabulary
 * and colour tokens (attention = needs a look, success = resolved,
 * primary = neutral information) — a genuine taste of the real
 * dashboard's visual language, not an invented illustration of one.
 * Honest per Visual Language §0.1: captioned as an example, since a
 * signed-out visitor has no real data yet.
 */

interface StatusRow {
  icon: typeof CalendarCheck;
  tone: "success" | "attention" | "primary";
  text: string;
}

const ROWS: readonly StatusRow[] = [
  { icon: CalendarCheck, tone: "success", text: "3 jobs booked today" },
  { icon: MessageCircle, tone: "attention", text: "1 customer waiting for a reply" },
  { icon: ClipboardCheck, tone: "primary", text: "2 quotes waiting for your OK" },
  { icon: CheckCircle2, tone: "success", text: "Nothing's been missed this week" },
] as const;

const TONE_CLASSES: Record<StatusRow["tone"], string> = {
  success: "bg-success/10 text-success",
  attention: "bg-attention/10 text-attention",
  primary: "bg-primary/10 text-primary",
};

export function InvisibleWeight() {
  return (
    <section className="bg-card">
      <div className="mx-auto max-w-lg px-6 py-20 text-center sm:py-28 lg:py-32">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -80px 0px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-[21px] font-semibold leading-relaxed text-foreground sm:text-[24px]"
        >
          The mental load is often far bigger than the physical work.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -80px 0px" }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.25 }}
          className="mt-4 text-[15px] text-muted-foreground"
        >
          Here&apos;s what a day looks like once something else is keeping track.
        </motion.p>

        <ScrollReveal
          delay={0.5}
          className="mt-10 rounded-2xl border border-border bg-background p-5 text-left shadow-sm sm:p-6"
        >
          <div className="space-y-4">
            {ROWS.map((row, i) => (
              <ScrollReveal key={row.text} delay={0.6 + i * 0.1} className="flex items-center gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[row.tone]}`}>
                  <row.icon className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <span className="text-[14.5px] font-medium text-foreground">{row.text}</span>
              </ScrollReveal>
            ))}
          </div>
        </ScrollReveal>

        <p className="mt-4 text-[12px] text-muted-foreground/70">An example day — not real data.</p>
      </div>
    </section>
  );
}
