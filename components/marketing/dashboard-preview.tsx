"use client";

import { useEffect, useState } from "react";
import {
  MessageCircle,
  Sparkles,
  CalendarCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Bell,
  BookOpen,
  Inbox,
  Wrench,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EASE, ScrollReveal, GentleSwap } from "@/components/shared/motion";

/**
 * Landing Experience, Section 2 — was "The Invisible Weight" (worry
 * questions), then a dashboard-stat teaser, then a signup checklist,
 * then (V7) an independent live-event feed.
 *
 * V8 "Emotion, Journey & Product Feel" (2026-08-04): the V7 feed was
 * alive but each card was independent — a fixed 8-item list cycling
 * on a fixed interval, which the founder correctly named as "an
 * obvious loop" with "predictable timing" the moment you watched it
 * for more than a few seconds. The brief: make the events tell a
 * story, one action leading naturally into the next, and never let
 * the rhythm become guessable.
 *
 * The fix is structural, not cosmetic. `CHAINS` below are causal
 * sequences (customer message → reply → knowledge check → booking →
 * diary → confirmation → inbox cleared — the founder's own example,
 * verbatim, as `CHAINS[0]`), not an unordered pool. `useNarrativeFeed`
 * plays one chain to completion with randomised per-step delays, then
 * picks a *different* chain at random and plays that one — so the
 * page never repeats the same beat-for-beat rhythm twice in a row, and
 * the timing is never metronomic. The "just learned" line (still
 * proving the learning claim with a concrete example, per the
 * previous pass) is no longer on its own independent clock — it now
 * updates exactly when a chain's own knowledge-check step fires,
 * tying the two halves of this panel into one story instead of two
 * unrelated animations sharing a box.
 */

interface FeedStep {
  icon: typeof MessageCircle;
  tone: "primary" | "success" | "attention" | "learning";
  text: string;
  /** Fires the "Just learned" reveal at exactly this point in the
   * story, rather than that line rotating on its own schedule. */
  learned?: string;
}

interface FeedChain {
  steps: readonly FeedStep[];
}

/** Three different shifts, not one loop wearing different clothes.
 * Each ends on "Inbox cleared" then one further beat — the founder's
 * own example chain (V9, 2026-08-04) closes on "Owner uninterrupted,"
 * not just a system-state fact. Every chain now ends on that same
 * idea in its own words (`Wrench`/`primary`, deliberately distinct
 * from every colour used earlier in the chain) — the payoff isn't
 * that the inbox is tidy, it's that none of this needed the owner. */
const CHAINS: readonly FeedChain[] = [
  {
    steps: [
      { icon: MessageCircle, tone: "primary", text: "A customer messages in" },
      { icon: Sparkles, tone: "primary", text: "A reply is drafted instantly" },
      { icon: BookOpen, tone: "learning", text: "Checked against what's been taught", learned: "how you price call-outs" },
      { icon: CalendarCheck, tone: "success", text: "Thursday afternoon booked in" },
      { icon: Clock, tone: "learning", text: "Diary updated" },
      { icon: CheckCircle2, tone: "success", text: "Customer confirms the time" },
      { icon: Inbox, tone: "success", text: "Inbox cleared" },
      { icon: Wrench, tone: "primary", text: "You never had to stop what you were doing" },
    ],
  },
  {
    steps: [
      { icon: MessageCircle, tone: "primary", text: "An urgent message comes in" },
      { icon: AlertTriangle, tone: "attention", text: "Recognised as urgent, not routine" },
      { icon: Bell, tone: "learning", text: "Team alerted immediately" },
      { icon: Sparkles, tone: "primary", text: "Customer reassured help is on its way" },
      { icon: Clock, tone: "learning", text: "Follow-up reminder set", learned: "what counts as an emergency" },
      { icon: CheckCircle2, tone: "success", text: "Added to today's schedule" },
      { icon: Inbox, tone: "success", text: "Inbox cleared" },
      { icon: Wrench, tone: "primary", text: "Handled before you even saw your phone" },
    ],
  },
  {
    steps: [
      { icon: MessageCircle, tone: "primary", text: "A customer asks for a price" },
      { icon: BookOpen, tone: "learning", text: "Checked your most-asked questions", learned: "your most-asked questions" },
      { icon: FileText, tone: "primary", text: "Quote sent before the last job even finished" },
      { icon: CheckCircle2, tone: "success", text: "Customer comes back with a yes" },
      { icon: CalendarCheck, tone: "success", text: "Booking added to the diary" },
      { icon: Clock, tone: "learning", text: "Reminder set for the day before" },
      { icon: Inbox, tone: "success", text: "Inbox cleared" },
      { icon: Wrench, tone: "primary", text: "One less thing waiting for you tonight" },
    ],
  },
] as const;

const TONE_CLASSES: Record<FeedStep["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  attention: "bg-attention/15 text-attention",
  learning: "bg-learning/10 text-learning",
};

/** Raw RGB triplets matching the same design-system tokens as
 * `TONE_CLASSES` above — needed here (not as Tailwind classes)
 * because the arrival glow below is an animated `boxShadow` keyframe,
 * which Tailwind can't express declaratively. */
const TONE_GLOW: Record<FeedStep["tone"], string> = {
  primary: "37,99,235",
  success: "34,197,94",
  attention: "245,158,11",
  learning: "168,85,247",
};

const FEED_VISIBLE = 3;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * V10 founder review (2026-08-04): "still feels like cards appearing
 * inside a SaaS dashboard... we are demonstrating autonomy, not
 * software." Two structural changes, not a re-skin:
 *
 * 1. New steps now *append* (`[...v, {key,step}]`), not prepend. The
 *    founder's own diagram writes every chain top-to-bottom with
 *    downward arrows (cause above effect) — the previous version had
 *    the newest card enter at the *top*, which is backwards from that
 *    reading order. Now the origin (the customer message) is always
 *    the oldest-of-visible, sitting above what it caused, and each
 *    new effect arrives *beneath* it — "important activity naturally
 *    sits above," and every existing card genuinely does shift
 *    upward as the next thing completes, exactly as asked, because
 *    it's making room below itself rather than being pushed down.
 *
 * 2. `learned` is `string | null`, not a string with a placeholder
 *    default. The row it drives is never in the DOM until the first
 *    real knowledge-check step actually fires — "only appear when
 *    something was genuinely learned, never simply because time
 *    passed" ruled out ever showing a plausible-sounding default
 *    before anything had actually happened.
 */
function useNarrativeFeed(maxVisible: number): { visible: { key: number; step: FeedStep }[]; learned: string | null } {
  const [visible, setVisible] = useState<{ key: number; step: FeedStep }[]>([]);
  const [learned, setLearned] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let keyCounter = 0;
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    // Seeded with the START of the first chain (the cause, not the
    // resolution) so the panel never sits empty for the ~1.5s before
    // the first live step arrives — reads as walking in just as a
    // message came in, not as the feature booting up.
    const seed = CHAINS[0]!.steps.slice(0, 2);
    setVisible(seed.map((step, i) => ({ key: i, step })));
    keyCounter = seed.length - 1;

    async function playChain(chain: FeedChain) {
      for (const step of chain.steps) {
        if (cancelled) return;
        await wait(randomBetween(1300, 2500));
        if (cancelled) return;
        keyCounter += 1;
        const key = keyCounter;
        setVisible((v) => [...v, { key, step }].slice(-maxVisible));
        if (step.learned) setLearned(step.learned);
      }
    }

    async function loop() {
      // The seed already showed chain 0's opening beats on screen
      // without going through `playChain` — finish that exact chain
      // first, continuing the story already visible, before the
      // normal randomised rotation (which then deliberately excludes
      // chain 0 on its first pick, so the same chain never plays
      // twice back to back).
      await playChain({ steps: CHAINS[0]!.steps.slice(seed.length) });
      if (cancelled) return;
      await wait(randomBetween(3800, 5200));

      let lastChain = 0;
      while (!cancelled) {
        let idx = Math.floor(Math.random() * CHAINS.length);
        if (CHAINS.length > 1) {
          while (idx === lastChain) idx = Math.floor(Math.random() * CHAINS.length);
        }
        lastChain = idx;
        await playChain(CHAINS[idx]!);
        if (cancelled) return;
        await wait(randomBetween(3800, 5200));
      }
    }
    void loop();
    return () => {
      cancelled = true;
    };
  }, [maxVisible]);

  return { visible, learned };
}

export function DashboardPreview() {
  const { visible, learned } = useNarrativeFeed(FEED_VISIBLE);

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
          {/* V9 founder review (2026-08-04): "introduces an
           * unnecessary gender and feels weaker than the rest of the
           * page... a headline that better represents ReplyFlow as an
           * intelligent business system rather than a person." Judged
           * against alternatives built the same way ("One system,
           * working every message," "Nothing waits for you to be
           * free," "Every message handled — while you're somewhere
           * else entirely") — this one won for naming the actual
           * feature shown directly beneath it ("Front Desk," the
           * panel's own real label), for reusing a work idiom this
           * trade audience already lives by ("clocks off"), and for
           * implying always-on reliability without having to state it
           * outright — all without a pronoun. */}
          The front desk that never clocks off.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -80px 0px" }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.25 }}
          className="mt-4 text-[15px] text-muted-foreground"
        >
          Every reply, booking and follow-up happens quietly in the background. Here&apos;s a snapshot of what that looks like, live.
        </motion.p>

        <ScrollReveal
          delay={0.5}
          className="mt-10 overflow-hidden rounded-2xl border border-border bg-background text-left shadow-md"
        >
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
            <div className="flex items-center gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/40" />
              <span className="h-2.5 w-2.5 rounded-full bg-attention/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/50" />
            </div>
            <span className="text-[12px] font-semibold text-foreground/70">Front Desk</span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-success">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Online
            </span>
          </div>

          <div className="p-4 sm:p-5">
            {/* V10 founder review (2026-08-04): "cause above effect...
             * important activity naturally sits above." New steps now
             * enter from *below* (matching the append-at-the-end
             * change in `useNarrativeFeed`) and settle upward into
             * place — reversed from the earlier version, where new
             * cards dropped in from above. Position, not just motion,
             * now carries hierarchy too: the oldest-of-visible card
             * (the cause everything below it stems from) sits at a
             * calmer, slightly lower opacity than the newest (the
             * thing that just happened, still the current focus) —
             * a static gradient, not a fourth colour or a louder
             * badge, and it updates smoothly as the stack shifts
             * rather than snapping. Retained from the previous pass:
             * the spring settle, the staggered icon, and the
             * tone-coloured arrival glow that blooms once and fades. */}
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {visible.map(({ key, step }, idx) => {
                  const posOpacity = [0.62, 0.85, 1][idx - (visible.length - 3)] ?? 1;
                  return (
                    <motion.div
                      key={key}
                      layout
                      initial={{ opacity: 0, y: 14, scale: 0.95 }}
                      animate={{
                        opacity: posOpacity,
                        y: 0,
                        scale: 1,
                        boxShadow: [
                          `0 0 0 5px rgba(${TONE_GLOW[step.tone]},0.16)`,
                          "0 0 0 0 rgba(0,0,0,0)",
                        ],
                      }}
                      exit={{ opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.3, ease: EASE } }}
                      transition={{
                        layout: { type: "spring", stiffness: 300, damping: 30 },
                        default: { type: "spring", stiffness: 260, damping: 24, mass: 0.9 },
                        boxShadow: { duration: 0.9, ease: "easeOut" },
                      }}
                      className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5"
                    >
                      <motion.span
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1, type: "spring", stiffness: 420, damping: 18 }}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[step.tone]}`}
                      >
                        <step.icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </motion.span>
                      <span className="text-[13px] font-medium text-foreground">{step.text}</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* V10 founder review (2026-08-04): "'Just learned' should
             * feel earned... only appear when something was genuinely
             * learned, never simply because time passed." Previously
             * always present with a plausible-sounding placeholder;
             * now the whole row is absent from the DOM until the
             * first real knowledge-check step actually fires, then
             * arrives once, on its own, rather than ever having shown
             * something unearned. */}
            <AnimatePresence>
              {learned && (
                <motion.div
                  initial={{ opacity: 0, y: 6, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto", marginTop: 12 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="flex flex-wrap items-center gap-x-1.5 gap-y-1 overflow-hidden border-t border-border/60 pt-3 text-[12.5px] font-semibold text-learning"
                >
                  <BookOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                  <span>Just learned:</span>
                  <GentleSwap swapKey={learned} className="font-medium text-foreground/80">
                    {learned}
                  </GentleSwap>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollReveal>

        <p className="mt-4 text-[12px] text-muted-foreground/70">
          An example office, showing typical activity — not real data. Runs on the WhatsApp Business number you already use.
        </p>
      </div>
    </section>
  );
}
