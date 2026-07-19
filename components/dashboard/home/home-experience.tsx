"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, Check, Headset, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { SettleCard, ScrollReveal, GentleSwap, Reveal, press, EASE } from "@/components/shared/motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatWaitingTime, calmStatusMessages } from "@/lib/dashboard-signals";
import type { TodaysPriority } from "@/lib/brain";
import { cn } from "@/lib/utils";

/**
 * Front Desk (Sprint 3 rebuild) — the canonical hierarchy from
 * Feature 01: Greeting -> Today's Priority -> AI Summary -> Urgent
 * Items -> Today's Diary -> AI Recommendations -> Business Health ->
 * Recent Learning -> Quick Actions. Every section answers exactly one
 * question and renders nothing at all when it has nothing true to say
 * (never an empty widget, never filler).
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
export function GreetingCard({
  name,
  logoUrl = null,
  supportLine,
  rotateCalm = false,
  whatsappConnected = false,
  topGaps = [],
}: {
  name: string;
  logoUrl?: string | null;
  supportLine: string;
  rotateCalm?: boolean;
  whatsappConnected?: boolean;
  topGaps?: readonly string[];
}) {
  const messages = calmStatusMessages(whatsappConnected, topGaps);
  const [calmIndex, setCalmIndex] = useState(0);

  useEffect(() => {
    if (!rotateCalm) return;
    const t = setInterval(() => setCalmIndex((i) => (i + 1) % messages.length), 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotateCalm]);

  const line = rotateCalm ? messages[calmIndex % messages.length] : supportLine;

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
          <GentleSwap swapKey={rotateCalm ? calmIndex : -1} className="mt-1">
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

/* -------------------------------- AI Summary ----------------------------------- */

/**
 * Section 3 — up to four bullets, never paragraphs. `bullets` is
 * already-filtered, real-facts-only text from `buildDailySummaryBullets`
 * — this component only renders it.
 */
export function AISummaryCard({ bullets }: { bullets: readonly string[] }) {
  if (bullets.length === 0) return null;
  return (
    <ScrollReveal className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Today so far</h2>
      <ul className="space-y-2">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </ScrollReveal>
  );
}

/* -------------------------------- Urgent Items --------------------------------- */

export interface UrgentItem {
  conversationId: string;
  name: string;
  reason: string;
  minutes: number;
}

/**
 * Section 4 — only appears when required (spec: "if nothing is
 * urgent, hide this section completely"). Left accent strip per the
 * UI spec's "Urgent Section" styling.
 */
export function UrgentItems({ items }: { items: UrgentItem[] }) {
  if (items.length === 0) return null;
  return (
    <SettleCard delay={0.11}>
      <h2 className="mb-2.5 text-[15px] font-bold tracking-tight">Urgent</h2>
      <div className="space-y-2">
        {items.map((item, i) => (
          <Reveal key={item.conversationId} index={i}>
            <Link href={`/dashboard/conversations/${item.conversationId}`} className="group block">
              <motion.div
                {...press}
                className="flex items-center gap-3 rounded-2xl border-l-4 border-attention bg-attention/[0.06] p-4 pl-3.5 transition-shadow group-hover:shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-attention/15 text-[13px] font-bold text-attention">
                  {item.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{item.name}</p>
                  <p className="truncate text-[12.5px] text-muted-foreground">
                    {item.reason} · waiting {formatWaitingTime(item.minutes)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-attention transition-transform group-hover:translate-x-0.5" />
              </motion.div>
            </Link>
          </Reveal>
        ))}
      </div>
    </SettleCard>
  );
}

/* -------------------------------- Today's Diary -------------------------------- */

export interface RightNowJob {
  id: string;
  customerName: string;
  jobTitle: string;
  scheduledFor: string | null;
  notes: string | null;
  isCurrent: boolean;
}

function timeLabel(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
}

/** Internal — used only inside `TodaysDiary` below. */
function RightNowSection({ job, allCaughtUp }: { job: RightNowJob | null; allCaughtUp: boolean }) {
  if (!job) {
    if (!allCaughtUp) return null;
    return (
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Right now</p>
        <p className="mt-2 text-[17px] font-bold tracking-tight">You&apos;re all caught up.</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          Nothing needs you at the moment — I&apos;ll bring anything new straight here.
        </p>
      </div>
    );
  }

  const time = timeLabel(job.scheduledFor);
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(circle at 100% 0%, rgba(34,197,94,0.07), transparent 55%)" }}
      />
      <p className="relative text-[11px] font-bold uppercase tracking-widest text-success">
        {job.isCurrent ? "Right now" : "Next job"}
      </p>
      <p className="relative mt-2 text-[18px] font-bold tracking-tight">{job.jobTitle}</p>
      <p className="relative mt-0.5 text-[13.5px] text-muted-foreground">
        {job.customerName}
        {time && <> · {time}</>}
      </p>
      {job.notes && (
        <p className="relative mt-2 flex items-start gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {job.notes}
        </p>
      )}
    </div>
  );
}

/**
 * Section 5 — compact, not calendar mode. Spec: "the owner wants
 * confidence, not administration... answers 'can I relax today?'"
 * Right Now, Up Next, and Today's Progress share one card since all
 * three are really one concern (today's schedule).
 */
export function TodaysDiary({
  rightNow,
  allCaughtUp,
  upNext,
  completed,
  waiting,
  remaining,
}: {
  rightNow: RightNowJob | null;
  allCaughtUp: boolean;
  upNext: RightNowJob | null;
  completed: number;
  waiting: number;
  remaining: number;
}) {
  const showRightNow = Boolean(rightNow) || allCaughtUp;
  const progressRows = [
    { icon: <Check className="h-3.5 w-3.5 text-success" />, label: `${completed} ${completed === 1 ? "job" : "jobs"} completed`, show: completed > 0 },
    { icon: <MessageCircle className="h-3.5 w-3.5 text-attention" />, label: `${waiting} waiting for you`, show: waiting > 0 },
    { icon: <CalendarDays className="h-3.5 w-3.5 text-success" />, label: `${remaining} remaining today`, show: remaining > 0 },
  ].filter((r) => r.show);
  const showProgress = progressRows.length > 0;

  if (!showRightNow && !upNext && !showProgress) return null;

  const upNextDate = upNext?.scheduledFor ? new Date(upNext.scheduledFor) : null;

  return (
    <SettleCard delay={0.14} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Today&apos;s diary</h2>

      {showRightNow && <RightNowSection job={rightNow} allCaughtUp={allCaughtUp} />}

      {upNext && (
        <>
          {showRightNow && <div className="my-4 h-px bg-border/70" />}
          <div>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Up next</h3>
            <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{upNext.jobTitle}</p>
                <p className="truncate text-[12.5px] text-muted-foreground">
                  {upNext.customerName}
                  {upNextDate && (
                    <>
                      {" · "}
                      {upNextDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      {" · "}
                      {upNextDate.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {showProgress && (
        <>
          {(showRightNow || upNext) && <div className="my-4 h-px bg-border/70" />}
          <div>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Today&apos;s progress
            </h3>
            <div className="space-y-2.5">
              {progressRows.map((row) => (
                <div key={row.label} className="flex items-center gap-2.5 text-[13.5px]">
                  {row.icon}
                  <span>{row.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </SettleCard>
  );
}

/* ------------------------ State 1: before the first enquiry ------------------- */

export interface ReadyStatusState {
  whatsappConnected: boolean;
}

/**
 * What she's doing right now for a brand-new business — replaces the
 * old milestone checklist. She never reads as a setup wizard waiting
 * on steps; she always has one true, live thing to say (Front Desk
 * V3 / One Thought Ahead: never a blank screen waiting for progress).
 */
export function ReadyStatus({ state }: { state: ReadyStatusState }) {
  const line = state.whatsappConnected
    ? "No enquiries yet. I'll let you know the moment someone gets in touch."
    : "I'm ready to go. Once WhatsApp is connected, I'll start watching for messages.";

  return (
    <SettleCard delay={0.05} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3.5">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
          <Sparkles className="h-4 w-4" />
          {state.whatsappConnected && (
            <motion.span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card"
              animate={{ opacity: [1, 0.45, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
        <p className="text-[14px] font-semibold leading-snug">{line}</p>
      </div>
    </SettleCard>
  );
}

/* ----------------------------- Setup progress --------------------------------- */

/**
 * The final stretch before going live — appears once the essentials
 * (Business Knowledge, teaching her how to speak) are substantially
 * done, so the owner feels themselves approaching a real milestone
 * rather than an open-ended checklist. This is a progress narrative
 * only: it never disables or hides the real Connect WhatsApp step,
 * which stays fully usable throughout (nothing here is a gate).
 *
 * Design System: "Growth should be visible. Not through percentages.
 * Through behaviour." — the bar shows progress visually; the heading
 * carries the meaning. No numeric badge sits beside it.
 */
export function SetupProgress({ percent }: { percent: number }) {
  const ready = percent >= 100;
  return (
    <SettleCard delay={0.04} className="rounded-2xl border border-success/25 bg-success/5 p-6 shadow-sm">
      <h2 className="text-[15px] font-bold tracking-tight">
        {ready ? "I'm ready to go live" : "Almost ready"}
      </h2>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-success"
          initial={false}
          animate={{ width: `${Math.max(percent, 4)}%` }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        {ready
          ? "You've taught me everything I need. Connect WhatsApp below and I'll start looking after real customers."
          : "Finish teaching me your business and how to talk to customers, and I'll be ready to connect WhatsApp and go live."}
      </p>
    </SettleCard>
  );
}
