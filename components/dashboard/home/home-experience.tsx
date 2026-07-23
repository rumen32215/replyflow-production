"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Headset } from "lucide-react";
import { SettleCard, GentleSwap, press } from "@/components/shared/motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { calmStatusMessages } from "@/lib/dashboard-signals";
import type { TodaysPriority } from "@/lib/brain";
import { cn } from "@/lib/utils";

/**
 * Front Desk (Owner Experience 01) — Greeting and Today's Priority are
 * the only two sections still homed here; everything else (the
 * urgency-ordered work sections) moved to their own components under
 * components/dashboard/home/ so each one can be reasoned about on its
 * own (attention-queue.tsx, todays-work.tsx, waiting-for-customer.tsx,
 * recently-completed.tsx, receptionist-activity.tsx).
 */

/* ---------------------------------- Greeting --------------------------------- */

export function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Section 1 — the Greeting Card. Spec: largest single element, max
 * height 220px, contains only the greeting and one honest line about
 * today. Today's Priority is its own card directly beneath this one,
 * not nested inside it — the two used to share one panel, but the
 * spec is explicit that Greeting and Priority are separate sections.
 */
/** Set once, client-side only, the first time the setup journey is
 * ever seen complete — so "Amazing, you're live" is a genuine one-time
 * moment rather than repeating on every visit. No server/database
 * memory involved; a returning "have I already told them this" flag
 * is exactly what localStorage is for. */
const JOURNEY_CELEBRATED_KEY = "replyflow:office-ready-celebrated";

export function GreetingCard({
  name,
  logoUrl = null,
  supportLine,
  rotateCalm = false,
  whatsappConnected = false,
  topGaps = [],
  justBecameReady = false,
}: {
  name: string;
  logoUrl?: string | null;
  supportLine: string;
  rotateCalm?: boolean;
  whatsappConnected?: boolean;
  topGaps?: readonly string[];
  /** True whenever the setup journey (Business Profile, Receptionist,
   * WhatsApp) is fully done — the component itself decides, via
   * localStorage, whether that's genuinely the first time. */
  justBecameReady?: boolean;
}) {
  const messages = calmStatusMessages(whatsappConnected, topGaps);
  const [calmIndex, setCalmIndex] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (!rotateCalm) return;
    const t = setInterval(() => setCalmIndex((i) => (i + 1) % messages.length), 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotateCalm]);

  useEffect(() => {
    if (!justBecameReady || typeof window === "undefined") return;
    if (window.localStorage.getItem(JOURNEY_CELEBRATED_KEY)) return;
    window.localStorage.setItem(JOURNEY_CELEBRATED_KEY, "1");
    setShowCelebration(true);
    const t = setTimeout(() => setShowCelebration(false), 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justBecameReady]);

  const line = showCelebration
    ? "Amazing — you're live. I'm now watching for customers."
    : rotateCalm
      ? messages[calmIndex % messages.length]
      : supportLine;

  return (
    <SettleCard className="relative max-h-[220px] overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
      {/* Sprint 7.7 — Aurora: an almost-invisible wash of the two brand
       * colours drifting behind the greeting, confined entirely to this
       * card. Meant to be felt, not seen — see app/globals.css for the
       * "why CSS, not framer-motion" note. */}
      <div className="aurora-layer" aria-hidden="true">
        <div className="aurora-blob aurora-blob-primary" />
        <div className="aurora-blob aurora-blob-success" />
      </div>
      <div className="relative flex items-start gap-3.5">
        {/* The business's own logo takes this spot when set — the
         * business is the centre of the experience, not ReplyFlow
         * itself; falls back to the headset badge (her presence)
         * otherwise. */}
        <Avatar className="mt-0.5 h-10 w-10 shrink-0 border border-success/20 bg-success/10 text-success">
          {logoUrl && <AvatarImage src={logoUrl} alt="" />}
          <AvatarFallback className="bg-transparent text-success">
            <Headset className="h-[18px] w-[18px]" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70" suppressHydrationWarning>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-0.5 text-[22px] font-extrabold tracking-tight md:text-[24px]" suppressHydrationWarning>
            {greetingForNow()}, {name}.
          </h1>
          <GentleSwap swapKey={showCelebration ? "celebrate" : rotateCalm ? calmIndex : -1} className="mt-1">
            <p className="text-[14px] leading-relaxed text-muted-foreground">{line}</p>
          </GentleSwap>
        </div>
      </div>
    </SettleCard>
  );
}

/* ------------------------------ Today's Priority ------------------------------ */

const PRIORITY_TONE = {
  urgent: {
    border: "border-attention/30",
    bg: "bg-attention/[0.05]",
    label: "text-attention",
    button: "bg-attention text-attention-foreground hover:bg-attention/90",
  },
  active: {
    border: "border-primary/25",
    bg: "bg-primary/[0.04]",
    label: "text-primary",
    button: "bg-primary text-primary-foreground hover:bg-primary/90",
  },
  calm: {
    border: "border-success/25",
    bg: "bg-success/[0.05]",
    label: "text-success",
    button: "bg-success text-success-foreground hover:bg-success/90",
  },
} as const;

/**
 * Section 2 — exactly one priority, never multiple. Spec: "Large. Most
 * prominent card. Highest contrast. One action. One recommendation.
 * No distractions." The tone (urgent/active/calm) comes from a fixed,
 * honest precedence over real facts (see `selectTodaysPriority`) —
 * never a fabricated score.
 *
 * Sprint 7.5: the headline now reads clearly larger than the Greeting
 * Card's name above it — before, the two sat at nearly the same size
 * and competed for attention instead of one obviously leading (Design
 * System: "only one element should compete for immediate attention").
 * The action button also gained a hover state — the single most
 * important tap target on the page had none before this pass.
 */
export function TodaysPriorityCard({ priority }: { priority: TodaysPriority }) {
  const style = PRIORITY_TONE[priority.tone];
  return (
    <SettleCard
      delay={0.05}
      className={cn("rounded-2xl border p-6 shadow-sm sm:p-8", style.border, style.bg)}
    >
      <p className={cn("text-[11px] font-bold uppercase tracking-widest", style.label)}>Today&apos;s priority</p>
      <h2 className="mt-2 text-[24px] font-extrabold tracking-tight sm:text-[28px]">{priority.headline}</h2>
      <p className="mt-2 max-w-lg text-[14.5px] leading-relaxed text-muted-foreground">{priority.detail}</p>
      <Link
        href={priority.actionHref}
        className="mt-5 inline-block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <motion.span
          {...press}
          className={cn(
            "flex min-h-[48px] items-center gap-2 rounded-xl px-5 text-[14px] font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
            style.button
          )}
        >
          {priority.actionLabel}
          <ArrowRight className="h-4 w-4" />
        </motion.span>
      </Link>
    </SettleCard>
  );
}

/* -------------------------------- Setup journey -------------------------------- */

export interface JourneyStep {
  id: string;
  label: string;
  done: boolean;
  href: string;
}

/**
 * Sprint 8.8 — replaces ReadyStatus and SetupProgress (and the ad hoc
 * "isNewBusiness" flags that used to decide between them). Before this
 * sprint, Front Desk treated setup as something to quietly mention in
 * passing; this makes it the actual first thing the owner is asked to
 * do, in the same place they'll come back to every day afterwards.
 *
 * Deliberately generic — this component doesn't know what a "step" is
 * beyond a label, a done flag, and where it leads; the specific three
 * steps (and what counts as "done" for each) are decided once, from
 * real Shared Brain signals, in app/(dashboard)/dashboard/page.tsx.
 * Merges what used to be the Greeting Card and Today's Priority into
 * one arrival moment on purpose: during setup, the "priority" IS
 * getting set up, so there's nothing for a separate priority card to
 * say that this doesn't already cover.
 */
export function SetupJourney({ name, steps }: { name: string; steps: readonly JourneyStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done) ?? null;

  return (
    <SettleCard className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      {/* Same almost-invisible Aurora wash as the Greeting Card (Sprint
       * 7.7) — this card is standing in for arrival, so it earns it. */}
      <div className="aurora-layer" aria-hidden="true">
        <div className="aurora-blob aurora-blob-primary" />
        <div className="aurora-blob aurora-blob-success" />
      </div>
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70" suppressHydrationWarning>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-0.5 text-[22px] font-extrabold tracking-tight md:text-[24px]" suppressHydrationWarning>
          {greetingForNow()}, {name}.
        </h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">Let&apos;s get your office ready.</p>

        <div className="mt-5 space-y-1">
          {steps.map((step) => {
            const isNext = nextStep?.id === step.id;
            return (
              <Link
                key={step.id}
                href={step.href}
                className={cn(
                  "-mx-2.5 flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted/50",
                  isNext && "bg-primary/5"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    step.done ? "bg-success text-success-foreground" : "border border-border"
                  )}
                >
                  {step.done && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className={cn("text-[14px]", step.done ? "text-muted-foreground" : "font-semibold text-foreground")}>
                  {step.label}
                </span>
              </Link>
            );
          })}
        </div>

        <p className="mt-4 text-[12px] text-muted-foreground">
          {doneCount} of {steps.length} steps done
        </p>

        {nextStep && (
          <Link
            href={nextStep.href}
            className="mt-4 inline-block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <motion.span
              {...press}
              className="flex min-h-[48px] items-center gap-2 rounded-xl bg-primary px-5 text-[14px] font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              Continue to {nextStep.label}
              <ArrowRight className="h-4 w-4" />
            </motion.span>
          </Link>
        )}
      </div>
    </SettleCard>
  );
}
