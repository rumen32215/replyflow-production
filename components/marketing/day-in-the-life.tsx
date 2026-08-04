"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { EASE } from "@/components/shared/motion";
import { PhoneFrame, Bubble } from "@/components/shared/phone-preview";
import { DeviceFrame } from "@/components/marketing/device-frame";
import { ProductMomentCard, type ProductMoment } from "@/components/marketing/product-moment";
import { MOOD_GLOW, type StoryMood } from "@/components/marketing/mood-glow";
import { cn } from "@/lib/utils";

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
 * That's this section's one job.
 *
 * Second founder review (2026-08-04): the first version over-corrected
 * into documentation. Three things came back: a soft elevated surface
 * for the timeline, a quiet morning-to-evening ambient wash, and one
 * glow bloom spent entirely on the payoff line.
 *
 * Third founder review (2026-08-04): "the current title doesn't create
 * enough emotion... the previous direction ('front desk that never
 * clocks off') had stronger positioning. Combine the best parts of
 * both." "You worked. The business handled the rest." keeps the old
 * headline's declarative confidence while naming a feeling neither
 * version did: relief — not just "it happened," but "you didn't have
 * to be the one holding it together."
 *
 * Fourth founder review (2026-08-04) — architectural, not cosmetic.
 * Studying an unrelated scroll-story component (`ScrollGlobe`), the
 * founder named what actually makes that pattern feel premium: "one
 * persistent visual element guiding the visitor through the story as
 * sections transition around it," not the globe itself. ReplyFlow
 * already has that element — the Hero phone — and this section was the
 * one place the page dropped it entirely, cutting from an interactive
 * device to a static text card. The gap read as two disconnected
 * experiences stitched together, not one story.
 *
 * Fix: this section gets its own phone (same `DeviceFrame` chassis,
 * same `PhoneFrame`/`Bubble` chrome as Hero, same `MOOD_GLOW` colour
 * language — deliberately the identical grammar, not a lookalike, so
 * it reads as the same object continuing its day rather than a new
 * one). It pins (`position: sticky`) beside the timeline and its
 * screen crossfades to a small scene matching whichever moment is
 * nearest the centre of the viewport (`useActiveMomentIndex` below,
 * an `IntersectionObserver` scrollspy — no hand-rolled scroll-position
 * math, CSS sticky already gives the "pin while the long sibling
 * scrolls past" behaviour for free). The same business (Dean's
 * Plumbing — Hero's own opening story) carries through both sections,
 * so this reads as one business's whole day, not a second demo.
 *
 * Confirmed live at common laptop heights (~900px): the five-item
 * timeline in its previous, tighter spacing rendered entirely within
 * one viewport, leaving no real distance to scroll through — the
 * "story before screens" crossfade never got the chance to play.
 * `gap-16`+ between moments (was `gap-9`) gives the section genuine
 * scroll depth without changing the timeline's own compact visual
 * density, and the scrollspy's trigger band sits above dead-centre
 * (`-35%…-55%`, not `-45%…-45%`) so the first moment scrolled to is
 * naturally the one already registering, rather than landing mid-story
 * on first paint.
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

const BUSINESS_NAME = "Dean's Plumbing";

/** One phone scene per `MOMENTS` entry (same index) — the same
 * conversation, continuing across the day, not five unrelated demos.
 * Moods reuse Hero's own four-value language (`MOOD_GLOW`): blue for
 * something arriving or informational, green for a routine win, red
 * for a genuine emergency (kept efficient, not the section's default
 * state), amber for the day's own payoff — the same meaning each mood
 * already carries in Hero, continued here rather than reinvented. */
type DayScene =
  | { kind: "conversation"; mood: StoryMood; customer: string; reply?: string; outcome?: ProductMoment }
  | { kind: "payoff"; mood: StoryMood; text: string };

const SCENES: readonly DayScene[] = [
  {
    kind: "conversation",
    mood: "blue",
    customer: "My kitchen tap's been leaking since first thing this morning — any chance of a look today?",
  },
  {
    kind: "conversation",
    mood: "green",
    customer: "My kitchen tap's been leaking since first thing this morning — any chance of a look today?",
    reply: "I can get someone out today — does 2pm work?",
    outcome: { text: "Booked in for today", kind: "job" },
  },
  {
    kind: "conversation",
    mood: "blue",
    customer: "Roughly what would a boiler service cost?",
    reply: "I can do you a fixed quote — sending it over now.",
    outcome: { text: "Quote sent", kind: "quote" },
  },
  {
    kind: "conversation",
    mood: "urgent",
    customer: "The extension's got a burst pipe — water's coming through the ceiling!",
    reply: "That's urgent — I'm getting the team moving right now.",
    outcome: { text: "Team alerted", kind: "urgent" },
  },
  { kind: "payoff", mood: "amber", text: "Nothing waiting for you" },
] as const;

/** Battery drains across the day rather than sitting fixed — a small,
 * honest detail in the same register as `device-frame.tsx`'s own
 * "never identical forever" battery variation, applied here to a
 * whole day instead of four unrelated stories. */
const BATTERY_BY_MOMENT: readonly number[] = [96, 94, 89, 85, 81] as const;

/** Which timeline moment is nearest the centre of the viewport right
 * now — an `IntersectionObserver` scrollspy, the standard, performant
 * way to answer this (no per-frame scroll math, unlike a hand-rolled
 * RAF handler). The thin horizontal band (`rootMargin`) means at most
 * one moment is ever "active" at a time; whichever `<li>` crosses it
 * becomes the phone's current scene. Deterministic first render (index
 * 0, matching the first moment) — the observer only ever runs
 * client-side, after mount, so there's nothing for hydration to
 * disagree about. */
function useActiveMomentIndex(count: number) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const i = refs.current.indexOf(entry.target as HTMLLIElement);
          if (i !== -1) setActive(i);
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0 }
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  return { active, refs };
}

/** The phone's own screen content for one scene — the identical
 * `PhoneFrame`/`Bubble` chrome Hero uses, so this reads as the same
 * product, not a second visual system. The payoff scene deliberately
 * breaks from a chat bubble (there's nothing left to show being said)
 * for one calm, centred confirmation instead — the section's one
 * remaining flourish, spent entirely on the line that's the point. */
function DayScenePhone({ scene }: { scene: DayScene }) {
  return (
    <PhoneFrame
      businessName={BUSINESS_NAME}
      scrollable
      headerInsetTop
      className="h-full w-full rounded-none border-0 shadow-none"
    >
      {scene.kind === "conversation" ? (
        <>
          <Bubble from="customer" className="text-[12px] lg:text-[13px]">{scene.customer}</Bubble>
          {scene.reply && (
            <Bubble from="receptionist" className="text-[12px] lg:text-[13px]">{scene.reply}</Bubble>
          )}
          {scene.outcome && (
            <div className="pt-2">
              <ProductMomentCard moment={scene.outcome} />
            </div>
          )}
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 py-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/12">
            <CheckCircle2 className="h-5 w-5 text-primary" strokeWidth={2.5} />
          </span>
          <p className="text-[13px] font-semibold text-foreground">{scene.text}</p>
        </div>
      )}
    </PhoneFrame>
  );
}

/** The persistent anchor itself — pins via plain `position: sticky`
 * (no `fixed` + scroll-math needed: sticky already keeps an element in
 * place for as long as its own parent, here the flex row/column
 * wrapping both the phone and the timeline, is taller than the
 * viewport and still in view, then releases naturally as that parent's
 * bottom edge approaches — exactly the "pin, then hand off" feeling
 * the section needs, for free). Same off-centre `MOOD_GLOW` lighting
 * as Hero, crossfading per scene rather than per story. */
function DayPhoneAnchor({ activeIndex }: { activeIndex: number }) {
  const scene = SCENES[activeIndex]!;
  return (
    <div className="relative mx-auto w-[210px] sm:w-[230px] lg:w-[250px]">
      <div
        className="pointer-events-none absolute -inset-x-10 -top-10 -bottom-16 -z-10 rounded-full blur-[55px] sm:-inset-x-12 sm:blur-[65px] lg:-inset-x-16 lg:blur-[75px]"
        aria-hidden
      >
        {(Object.keys(MOOD_GLOW) as StoryMood[]).map((mood) => (
          <motion.div
            key={mood}
            className="absolute inset-0 rounded-full"
            animate={{ opacity: scene.mood === mood ? 1 : 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ background: MOOD_GLOW[mood] }}
          />
        ))}
      </div>

      <motion.div
        initial={{ y: 0 }}
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <DeviceFrame battery={BATTERY_BY_MOMENT[activeIndex] ?? 90} className="w-[210px] sm:w-[230px] lg:w-[250px]">
          <AnimatePresence initial={false}>
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="absolute inset-0 h-full w-full"
            >
              <DayScenePhone scene={scene} />
            </motion.div>
          </AnimatePresence>
        </DeviceFrame>
      </motion.div>
    </div>
  );
}

export function DayInTheLife() {
  const { active, refs } = useActiveMomentIndex(MOMENTS.length);

  // No `overflow-hidden` on the section below, deliberately — confirmed
  // live: it makes the browser treat this section as the sticky
  // positioning context instead of the real page scroll, so the phone
  // anchor released far too early (a well-known CSS interaction
  // between `overflow` and `position: sticky`). Nothing here actually
  // bleeds past the section's own bounds — the ambient wash is
  // `inset-0` (self-confining) and the phone's mood glow stays well
  // within this section's much taller box regardless.
  return (
    <section className="relative bg-card">
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

      <div className="relative mx-auto max-w-4xl px-6 py-24 text-center sm:py-32 lg:py-36">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -100px 0px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-[22px] font-semibold leading-relaxed text-foreground sm:text-[26px]"
        >
          You worked. The business handled the rest.
        </motion.p>

        <div className="mt-14 flex flex-col items-center gap-10 sm:mt-16 lg:flex-row lg:items-start lg:justify-center lg:gap-14">
          {/* Sticky only from `lg:` up, deliberately — confirmed live:
           * on a single stacked mobile column the sticky phone visually
           * collided with the timeline text scrolling up behind it (no
           * side-by-side room to route around it, unlike desktop's own
           * two columns). Below `lg:` the phone renders once, in normal
           * flow, and simply scrolls away with the rest of the page —
           * still updates live via the same `active` index if a
           * visitor scrolls back up to it, just not physically pinned
           * on a viewport too narrow to hold it without overlap. */}
          <div className="z-10 shrink-0 lg:sticky lg:top-24">
            <DayPhoneAnchor activeIndex={active} />
          </div>

          {/* The one structural device this section allows itself — a
           * thin line marking "these are one continuous day," not a
           * decoration. Deliberately quiet: 1px, low-opacity border
           * colour, nothing that competes with the words next to it. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -100px 0px" }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
            className="relative w-full max-w-sm rounded-3xl border border-border/50 bg-background/80 p-7 text-left shadow-[0_1px_3px_rgba(15,23,42,0.04),0_20px_45px_-28px_rgba(15,23,42,0.16)] backdrop-blur-sm sm:p-9"
          >
            <div className="absolute bottom-9 left-[31px] top-9 w-px bg-border sm:left-[39px]" aria-hidden />

            <ul className="flex flex-col gap-16 sm:gap-24 lg:gap-32">
              {MOMENTS.map((moment, i) => {
                const isLast = i === MOMENTS.length - 1;
                const isActive = i === active;
                return (
                  <motion.li
                    key={moment.time}
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
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
                      className={cn(
                        "absolute top-[7px] rounded-full transition-colors duration-500",
                        isLast ? "left-0 h-2 w-2 bg-success" : "left-[2px] h-1.5 w-1.5",
                        !isLast && (isActive ? "bg-primary" : "bg-muted-foreground/40")
                      )}
                    />
                    <span className="w-[62px] shrink-0 text-[12.5px] font-medium tabular-nums text-muted-foreground/70">
                      {moment.time}
                    </span>
                    <span
                      className={cn(
                        "leading-snug transition-colors duration-500",
                        isLast
                          ? "text-[15.5px] font-semibold text-foreground"
                          : cn("text-[15px]", isActive ? "text-foreground" : "text-foreground/80")
                      )}
                    >
                      {moment.text}
                    </span>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        </div>

        {/* Pure scroll runway, no content — confirmed live: without
         * this, the last two moments' centres never reach the
         * scrollspy's trigger band before the page runs out of room to
         * scroll (measured at a common 900px laptop height, the final
         * moment needed ~300px more travel than the page had). The
         * sticky phone stays visible and pinned throughout, so this
         * reads as continued scroll, never as a dead gap. */}
        <div className="h-56 sm:h-72 lg:h-96" aria-hidden />

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
