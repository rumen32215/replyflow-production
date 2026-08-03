"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/shared/motion";

/**
 * Landing Experience, Section 2 — The Invisible Weight
 * (`DOCS/SPECS/ReplyFlow-Landing-Experience-Design.md` §3). Recognition,
 * not explanation — the questions are quoted directly from Founder
 * Handbook Ch.01's "The Invisible Weight," unaltered, closing on that
 * same chapter's own line. No feature mapping here; that's §4's job.
 *
 * First real use of the scroll-triggered "Arrival" motion purpose
 * (Visual Language §7) for a staggered group rather than a single
 * card — same technique `ScrollReveal` already establishes
 * (whileInView + viewport once), applied per line so the questions
 * settle in one after another instead of all at once.
 */

const QUESTIONS = [
  "Did I reply to that customer?",
  "Did I send that quotation?",
  "Did I forget somebody?",
  "What jobs need my attention today?",
] as const;

export function InvisibleWeight() {
  return (
    <section className="bg-card">
      <div className="mx-auto max-w-2xl px-6 py-20 text-center sm:py-28 lg:py-32">
        <div className="space-y-5 sm:space-y-6">
          {QUESTIONS.map((question, i) => (
            <motion.p
              key={question}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -80px 0px" }}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.15 }}
              className="text-[21px] font-semibold leading-snug tracking-tight text-foreground sm:text-[24px]"
            >
              {question}
            </motion.p>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -80px 0px" }}
          transition={{ duration: 0.5, ease: EASE, delay: QUESTIONS.length * 0.15 + 0.15 }}
          className="mt-10 text-[16px] leading-relaxed text-muted-foreground sm:mt-12 sm:text-[17px]"
        >
          The mental load is often far bigger than the physical work.
        </motion.p>
      </div>
    </section>
  );
}
