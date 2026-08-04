"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/shared/motion";

/**
 * Landing Experience, Section 2 — replaces the "Front Desk" live-feed
 * panel (`dashboard-preview.tsx`, V7 through V10) entirely.
 *
 * Founder review (2026-08-04), verbatim: "Claude has interpreted Front
 * Desk as 'improve this widget' when the actual brief was 'convince me
 * ReplyFlow is intelligent.'... Every screenshot, my eye goes here,
 * then immediately — I don't know what I'm looking at. That's the
 * problem. Not the animations. The concept." Four versions of that
 * widget got smoother motion and a better data model; none of them
 * changed what it fundamentally was — a dashboard mockup, which reads
 * as software no matter how well it's animated. This isn't version 5
 * of that. It's a different section built on a different metaphor.
 *
 * The phone above already proves ReplyFlow can hold a conversation,
 * understand a photo, learn a business, and produce a good outcome —
 * genuinely different capabilities now, one per swipe (`hero.tsx`'s
 * `STORIES`). What it can't prove in thirty seconds is *duration*:
 * that this keeps happening, reliably, without anyone checking in.
 * That's this section's one job, and it's a different axis entirely
 * from anything the phone shows — one real conversation vs. a whole
 * day — so telling it never repeats the phone's own proof.
 *
 * Second founder review (2026-08-04): the first version of this
 * section over-corrected — "keep the simplicity, but it now feels
 * like documentation, not evidence... find the middle ground." Three
 * things came back, all deliberately short of a dashboard: (1) the
 * timeline sits inside one soft, elevated surface (`rounded-3xl`,
 * subtle shadow) instead of floating on plain background — presence,
 * without a single piece of window chrome; (2) a very quiet
 * morning-to-evening ambient wash behind the whole section, the same
 * "atmosphere carries meaning" principle the phone's own mood glow
 * uses, applied here to *time* instead of *scenario*; (3) the payoff
 * line gets one soft glow bloom the moment it settles — the section's
 * only real flourish, spent entirely on the one line that's the whole
 * point of it. Still no cards, no icons beyond the same two dot sizes
 * already here, no per-item colour-coding — still evidence, not a
 * dashboard, just no longer bare.
 */

interface Moment {
  time: string;
  text: string;
}

/** One believable working day, five beats — enough to feel like a
 * real arc (an early urgency, a routine booking, a midday quote, a
 * second urgent moment handled with the team, then evening calm), not
 * so many that reading it becomes work. The last line is the entire
 * point of the section; everything before it exists to earn it. */
const MOMENTS: readonly Moment[] = [
  { time: "7:12am", text: "A leak reported." },
  { time: "7:14am", text: "Already booked in for today." },
  { time: "1:40pm", text: "A quote sent while you were still on the tools." },
  { time: "4:05pm", text: "An urgent job flagged, team alerted immediately." },
  { time: "6:30pm", text: "You check your phone. Nothing's waiting." },
] as const;

export function DayInTheLife() {
  return (
    <section className="relative overflow-hidden bg-card">
      {/* Morning-to-evening wash — the same "atmosphere tells the
       * story" idea as the phone's own mood glow, applied to the
       * passage of a day instead of a scenario. Kept extremely quiet
       * (low-opacity, no hard edges) — a visitor should feel a day
       * passing without ever consciously clocking a gradient. */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: "linear-gradient(180deg, rgba(37,99,235,0.05) 0%, transparent 35%, transparent 65%, rgba(245,158,11,0.06) 100%)",
        }}
      />

      <div className="relative mx-auto max-w-xl px-6 py-24 text-center sm:py-32 lg:py-36">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -100px 0px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-[22px] font-semibold leading-relaxed text-foreground sm:text-[26px]"
        >
          You didn&apos;t have to think about any of this today.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -100px 0px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
          className="relative mx-auto mt-14 max-w-sm rounded-3xl border border-border/50 bg-background/80 p-7 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04),0_20px_45px_-28px_rgba(15,23,42,0.16)] backdrop-blur-sm sm:mt-16 sm:p-9"
        >
          {/* The one structural device this section allows itself — a
           * thin line marking "these are one continuous day," not a
           * decoration. Deliberately quiet: 1px, low-opacity border
           * colour, nothing that competes with the words next to it. */}
          <div className="absolute bottom-9 left-[31px] top-9 w-px bg-border sm:left-[39px]" aria-hidden />

          <ul className="flex flex-col gap-9 sm:gap-10">
            {MOMENTS.map((moment, i) => {
              const isLast = i === MOMENTS.length - 1;
              return (
                <motion.li
                  key={moment.time}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "0px 0px -80px 0px" }}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.12 }}
                  className="relative flex items-baseline gap-4 pl-7"
                >
                  {/* Every dot is the same shape; only the last one
                   * gets any real weight — size and colour alone
                   * mark "this is the point," not a fourth icon. A
                   * soft glow blooms once behind it as it settles —
                   * this section's one flourish, spent on its one
                   * line that matters. */}
                  {isLast && (
                    <motion.span
                      aria-hidden
                      className="absolute -left-3 top-1 h-8 w-8 rounded-full bg-success/25 blur-md"
                      initial={{ opacity: 0, scale: 0.6 }}
                      whileInView={{ opacity: [0, 1, 0.5], scale: [0.6, 1.3, 1] }}
                      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
                      transition={{ duration: 1.1, ease: EASE, delay: i * 0.12 + 0.15 }}
                    />
                  )}
                  <span
                    aria-hidden
                    className={
                      isLast
                        ? "absolute left-0 top-[7px] h-2 w-2 rounded-full bg-success"
                        : "absolute left-[2px] top-[8px] h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
                    }
                  />
                  <span className="w-[62px] shrink-0 text-[12.5px] font-medium tabular-nums text-muted-foreground/70">
                    {moment.time}
                  </span>
                  <span
                    className={
                      isLast
                        ? "text-[15.5px] font-semibold leading-snug text-foreground"
                        : "text-[15px] leading-snug text-foreground/80"
                    }
                  >
                    {moment.text}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "0px 0px -80px 0px" }}
          transition={{ duration: 0.5, ease: EASE, delay: MOMENTS.length * 0.12 + 0.3 }}
          className="mt-6 text-[12px] text-muted-foreground/60"
        >
          An example day — not real data.
        </motion.p>
      </div>
    </section>
  );
}
