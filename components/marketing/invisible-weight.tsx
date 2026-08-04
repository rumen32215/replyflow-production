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
 * Fourth founder review (2026-08-04): the four questions all opening
 * "Did I..." read as a list once every line arrives in identical size
 * and rhythm — the fix isn't different words (these are quoted, not
 * invented) but irregular presentation: a hand-tuned, uneven pace
 * (quick pair, a real pause, quick pair again) and a small, deliberate
 * size variation per line, closer to how these thoughts actually
 * arrive than a metronome would be. No scatter, no rotation, no
 * gimmicks — still centred, still calm, still `whileInView` (first
 * real use of the scroll-triggered "Arrival" motion purpose for a
 * staggered group, `ScrollReveal`'s own technique applied per line).
 *
 * The closing line is the section's actual emotional conclusion, not
 * a caption — given real size, weight, and its own slower, separate
 * entrance after a genuine pause, rather than just the fifth line in
 * the same list.
 */

interface Question {
  text: string;
  /** Seconds after the section enters view — hand-tuned, not uniform. */
  delay: number;
  /** A small, deliberate step, not a dramatic one. */
  size: string;
}

const QUESTIONS: readonly Question[] = [
  { text: "Did I reply to that customer?", delay: 0, size: "text-[22px] sm:text-[25px]" },
  { text: "Did I send that quotation?", delay: 0.4, size: "text-[19px] sm:text-[22px]" },
  { text: "Did I forget somebody?", delay: 1.3, size: "text-[24px] sm:text-[27px]" },
  { text: "What jobs need my attention today?", delay: 1.7, size: "text-[20px] sm:text-[23px]" },
] as const;

export function InvisibleWeight() {
  return (
    <section className="bg-card">
      <div className="mx-auto max-w-2xl px-6 py-20 text-center sm:py-28 lg:py-32">
        <div className="space-y-5 sm:space-y-6">
          {QUESTIONS.map((question) => (
            <motion.p
              key={question.text}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -80px 0px" }}
              transition={{ duration: 0.5, ease: EASE, delay: question.delay }}
              className={`${question.size} font-semibold leading-snug tracking-tight text-foreground`}
            >
              {question.text}
            </motion.p>
          ))}
        </div>

        {/* The conclusion, not another list item — larger, heavier,
         * and given a real pause and its own slower settle rather than
         * arriving on the same beat as the questions above it. */}
        <motion.p
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "0px 0px -80px 0px" }}
          transition={{ duration: 0.7, ease: EASE, delay: 2.6 }}
          className="mt-14 text-[19px] font-semibold leading-relaxed text-foreground sm:mt-16 sm:text-[22px]"
        >
          The mental load is often far bigger than the physical work.
        </motion.p>
      </div>
    </section>
  );
}
