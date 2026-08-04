"use client";

import { useEffect, useState } from "react";
import {
  MessageCircle,
  CalendarCheck,
  AlertTriangle,
  UserPlus,
  CheckCircle2,
  Clock,
  FileText,
  Bell,
  BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EASE, ScrollReveal, GentleSwap } from "@/components/shared/motion";

/**
 * Landing Experience, Section 2 — was "The Invisible Weight" (worry
 * questions), then a dashboard-stat teaser, then a labelled sign-up
 * checklist preview (ninth founder review).
 *
 * V7 "Prove it, don't explain it" (2026-08-04): "now the weakest
 * section" again, for a different reason than before — the phone
 * above already *proves* the product works; this section immediately
 * reverted to explaining it ("what happens the moment you sign up?"),
 * a signup-checklist framing that doesn't belong right after a live
 * demo. The brief: replace the story entirely, and answer "what is
 * ReplyFlow actually doing behind the scenes?" — while the owner is
 * out working, not while they're filling in a signup form.
 *
 * Two things needed to be true for the preview to read as "she's
 * genuinely working right now" rather than a static screenshot:
 * events had to keep happening on their own (the live feed below,
 * `useLiveFeed`) and the thing everyone claims — "it learns your
 * business" — had to be shown as concrete examples, not asserted
 * (`LEARNED`, point 4 of the brief, literally: show what it learns
 * rather than say it learns).
 */

interface ActivityEvent {
  icon: typeof MessageCircle;
  tone: "primary" | "success" | "attention" | "learning";
  text: string;
}

/** Present-perfect, one completed action each — read as things that
 * *just happened*, not status labels. A WhatsApp mention survives
 * here specifically so the "connects to your existing number" claim
 * (a named priority in the previous review) stays visible without
 * this section reverting to a checklist to say it. */
const ACTIVITY: readonly ActivityEvent[] = [
  { icon: MessageCircle, tone: "primary", text: "Answered a WhatsApp message about tomorrow" },
  { icon: CalendarCheck, tone: "success", text: "Booked Thursday afternoon into the diary" },
  { icon: AlertTriangle, tone: "attention", text: "Spotted an urgent job and alerted the team" },
  { icon: UserPlus, tone: "primary", text: "Saved a new customer's details automatically" },
  { icon: CheckCircle2, tone: "success", text: "Cleared the inbox — every message answered" },
  { icon: Clock, tone: "learning", text: "Set a reminder to call back this afternoon" },
  { icon: FileText, tone: "primary", text: "Sent a quote while still finishing the last job" },
  { icon: Bell, tone: "learning", text: "Notified the team the moment it mattered" },
] as const;

/** What "she learns your business" concretely means — shown, not
 * claimed. Cycles the same way the sign-up page's own reassurance
 * line does (`signup-form.tsx`'s `REASSURANCE_LINES`), reusing the
 * project's established "quiet rotating proof line" pattern. */
const LEARNED: readonly string[] = [
  "your opening hours",
  "which areas you cover",
  "how you price call-outs",
  "what counts as an emergency",
  "your most-asked questions",
  "how you like bookings confirmed",
] as const;

const TONE_CLASSES: Record<ActivityEvent["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  attention: "bg-attention/15 text-attention",
  learning: "bg-learning/10 text-learning",
};

const FEED_VISIBLE = 3;
const FEED_INTERVAL_MS = 3400;
const LEARNED_INTERVAL_MS = 2600;

function useRotatingIndex(length: number, intervalMs: number): number {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % length), intervalMs);
    return () => clearInterval(id);
  }, [length, intervalMs]);
  return index;
}

/** A live log, not a static list — a new event slides in from the top
 * on its own timer, the oldest visible one slides out, and every card
 * still on screen shifts down via `layout` rather than jumping. */
function useLiveFeed(intervalMs: number): number {
  const [head, setHead] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setHead((h) => h + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return head;
}

export function DashboardPreview() {
  const head = useLiveFeed(FEED_INTERVAL_MS);
  const learnedIndex = useRotatingIndex(LEARNED.length, LEARNED_INTERVAL_MS);

  const visible = Array.from({ length: FEED_VISIBLE }, (_, k) => {
    const pos = head - k;
    const eventIndex = ((pos % ACTIVITY.length) + ACTIVITY.length) % ACTIVITY.length;
    return { key: pos, event: ACTIVITY[eventIndex]! };
  });

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
          While you&apos;re on the job, she&apos;s already working the phones.
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
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {visible.map(({ key, event }) => (
                  <motion.div
                    key={key}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5"
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[event.tone]}`}>
                      <event.icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="text-[13px] font-medium text-foreground">{event.text}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-border/60 pt-3 text-[12.5px] font-semibold text-learning">
              <BookOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
              <span>Just learned:</span>
              <GentleSwap swapKey={learnedIndex} className="font-medium text-foreground/80">
                {LEARNED[learnedIndex]}
              </GentleSwap>
            </div>
          </div>
        </ScrollReveal>

        <p className="mt-4 text-[12px] text-muted-foreground/70">
          An example office, showing typical activity — not real data. Runs on the WhatsApp Business number you already use.
        </p>
      </div>
    </section>
  );
}
