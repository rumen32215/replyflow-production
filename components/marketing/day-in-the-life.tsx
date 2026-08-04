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
 * The brief was explicit about the form that proof should take: "no
 * dashboard, no analytics, no animated cards... a calm, premium story
 * ... think Apple rather than SaaS... question whether every element
 * deserves to exist." So there is no panel, no chrome, no window
 * controls, no icons, no colour-coded badges — nothing here reads as
 * a UI at all. It's five short, time-stamped sentences and a single
 * quiet line connecting them, read once as the section scrolls into
 * view and then still — a settled record of a day already finished,
 * deliberately the opposite temporal register from the phone above it
 * (which is always live, always mid-conversation). That contrast is
 * the point: the phone shows it happening; this shows it already
 * happened, routinely, the way a normal Tuesday would.
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
    <section className="bg-card">
      <div className="mx-auto max-w-xl px-6 py-24 text-center sm:py-32 lg:py-36">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -100px 0px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-[22px] font-semibold leading-relaxed text-foreground sm:text-[26px]"
        >
          You didn&apos;t have to think about any of this today.
        </motion.p>

        <div className="relative mx-auto mt-16 max-w-sm text-left sm:mt-20">
          {/* The one structural device this section allows itself — a
           * thin line marking "these are one continuous day," not a
           * decoration. Deliberately quiet: 1px, low-opacity border
           * colour, nothing that competes with the words next to it. */}
          <div className="absolute bottom-2 left-[3px] top-2 w-px bg-border" aria-hidden />

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
                   * mark "this is the point," not a fourth icon. */}
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
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "0px 0px -80px 0px" }}
          transition={{ duration: 0.5, ease: EASE, delay: MOMENTS.length * 0.12 + 0.15 }}
          className="mt-14 text-[12px] text-muted-foreground/60 sm:mt-16"
        >
          An example day — not real data.
        </motion.p>
      </div>
    </section>
  );
}
