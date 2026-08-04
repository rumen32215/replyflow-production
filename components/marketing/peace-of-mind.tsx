"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/shared/motion";

/**
 * Landing Experience, Section 2 — replaces `day-in-the-life.tsx`
 * outright, not iterated on top of it.
 *
 * V13 founder review (2026-08-04), verbatim: "The new section with
 * another sticky phone... is not working. It doesn't build trust. It
 * introduces another phone. It feels heavier. It feels slower. It
 * breaks the experience. Most importantly, it repeats information...
 * Do not redesign it. Replace it." And on the timeline mechanic
 * specifically that section had inherited from its own predecessor:
 * "7:12, 7:14, 1:40, 4:05 — those are facts. They are not trust
 * builders. I don't care about times. I care about confidence...
 * Replace the entire section with something that makes me think: 'I
 * understand exactly how this fits into my business.'"
 *
 * Two decisions follow directly from that:
 *
 * 1. No second phone, anywhere. "The Hero phone has already become
 *    the hero... the rest of the page should support the first
 *    phone, not compete with it." This section is typography only.
 * 2. No chronology. The old file's dot-and-connecting-line language
 *    specifically meant "these are ordered in time" — honest for a
 *    log of a day, dishonest for what this section says now (three
 *    reasons to trust it, not three events in sequence). Dropped
 *    entirely rather than reused for content it no longer describes.
 *
 * One line survives from every earlier version of this section:
 * "Nothing waiting for you" — named explicitly as the thing worth
 * keeping, and as the destination the section should build toward:
 * "Because that is what the customer is actually buying. Not AI. Not
 * automation. Peace of mind." Kept the one flourish (a soft glow
 * bloom) this section's history has always spent entirely on that
 * line — still true here, just earned by three short statements
 * instead of a fictional day's timestamps.
 */

const CONFIDENCE_POINTS = [
  "Every message gets answered — even the ones you miss.",
  "It only ever says what's actually true about your business.",
  "Anything that genuinely needs you, waits for you. Nothing else does.",
] as const;

export function PeaceOfMind() {
  return (
    <section className="relative overflow-hidden bg-card">
      {/* Echoes the phone's own blue/green glow language without
       * showing a phone — the same colours carrying the same meaning
       * (calm, working, trustworthy) into a section that has no
       * product surface of its own. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: "radial-gradient(ellipse 70% 55% at 50% 20%, rgba(37,99,235,0.05), transparent 60%), radial-gradient(ellipse 70% 55% at 50% 85%, rgba(34,197,94,0.06), transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-xl px-6 py-24 text-center sm:py-32 lg:py-36">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -100px 0px" }}
          transition={{ duration: 0.5, ease: EASE }}
          className="text-[13px] font-bold uppercase tracking-widest text-primary/60"
        >
          How this actually fits into your day
        </motion.p>

        <div className="mt-10 space-y-8 sm:mt-12 sm:space-y-10">
          {CONFIDENCE_POINTS.map((point, i) => (
            <motion.p
              key={point}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -80px 0px" }}
              transition={{ duration: 0.55, ease: EASE, delay: i * 0.12 }}
              className="text-[18px] leading-relaxed text-foreground/80 sm:text-[21px]"
            >
              {point}
            </motion.p>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -100px 0px" }}
          transition={{ duration: 0.6, ease: EASE, delay: CONFIDENCE_POINTS.length * 0.12 + 0.2 }}
          className="relative mt-16 sm:mt-20"
        >
          {/* This section's one flourish, spent entirely on the one
           * line that's the whole point of it — same convention every
           * earlier version of this section has used for this exact
           * line. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success/20 blur-2xl"
            initial={{ opacity: 0, scale: 0.7 }}
            whileInView={{ opacity: [0, 1, 0.6], scale: [0.7, 1.15, 1] }}
            viewport={{ once: true, margin: "0px 0px -100px 0px" }}
            transition={{ duration: 1.2, ease: EASE, delay: CONFIDENCE_POINTS.length * 0.12 + 0.35 }}
          />
          <p className="relative text-[26px] font-bold leading-snug text-foreground sm:text-[32px]">
            Nothing waiting for you.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
