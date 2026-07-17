"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Headset,
  MapPin,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { SettleCard, Reveal, press } from "@/components/shared/motion";
import { formatWaitingTime } from "@/lib/dashboard-signals";

/**
 * Home — the owner's morning briefing (Home Experience V2).
 * Screen order is fixed by the doc: Greeting -> Right Now -> Needs You
 * -> Up Next -> Today's Progress. Every card answers one question; if
 * a card has nothing useful to say, it doesn't render (never empty
 * widgets, never analytics for the sake of analytics).
 */

/* ---------------------------------- Greeting --------------------------------- */

export function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Her presence — the first thing Front Desk shows, every time it's
 * opened. The headset badge marks this as her speaking (not a page
 * title); no SettleCard of its own, since it sits inside the same
 * panel as the fast lane beneath it (Front Desk V3: she's felt right
 * above the actions, not in a separate floating card).
 */
export function HomeGreeting({ name, supportLine }: { name: string; supportLine: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Headset className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <h1 className="text-[22px] font-extrabold tracking-tight md:text-[24px]" suppressHydrationWarning>
          {greetingForNow()}, {name}.
        </h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{supportLine}</p>
      </div>
    </div>
  );
}

/* --------------------------------- Right Now --------------------------------- */

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

export function RightNowCard({ job, allCaughtUp }: { job: RightNowJob | null; allCaughtUp: boolean }) {
  if (!job) {
    if (!allCaughtUp) return null;
    return (
      <SettleCard delay={0.05} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Right now</p>
        <p className="mt-2 text-[17px] font-bold tracking-tight">You&apos;re all caught up.</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          Nothing needs you at the moment — I&apos;ll bring anything new straight here.
        </p>
      </SettleCard>
    );
  }

  const time = timeLabel(job.scheduledFor);
  return (
    <SettleCard
      delay={0.05}
      className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card p-5 shadow-md"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(circle at 100% 0%, rgba(37,99,235,0.06), transparent 55%)" }}
      />
      <p className="relative text-[11px] font-bold uppercase tracking-widest text-primary">
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
    </SettleCard>
  );
}

/* --------------------------------- Needs You --------------------------------- */

export interface NeedsYouItem {
  conversationId: string;
  name: string;
  reason: string;
  minutes: number;
}

export function NeedsYou({ items }: { items: NeedsYouItem[] }) {
  if (items.length === 0) return null;
  return (
    <SettleCard delay={0.1}>
      <h2 className="mb-2.5 text-[15px] font-bold tracking-tight">Needs you</h2>
      <div className="space-y-2">
        {items.map((item, i) => (
          <Reveal key={item.conversationId} index={i}>
            <Link href={`/dashboard/conversations/${item.conversationId}`} className="group block">
              <motion.div
                {...press}
                className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 transition-shadow group-hover:shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[13px] font-bold text-amber-700">
                  {item.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{item.name}</p>
                  <p className="truncate text-[12.5px] text-muted-foreground">
                    {item.reason} · waiting {formatWaitingTime(item.minutes)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-amber-600 transition-transform group-hover:translate-x-0.5" />
              </motion.div>
            </Link>
          </Reveal>
        ))}
      </div>
    </SettleCard>
  );
}

/* ---------------------------------- Up Next ---------------------------------- */

export function UpNext({ job }: { job: RightNowJob | null }) {
  if (!job) return null;
  const date = job.scheduledFor ? new Date(job.scheduledFor) : null;
  return (
    <SettleCard delay={0.14}>
      <h2 className="mb-2.5 text-[15px] font-bold tracking-tight">Up next</h2>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <CalendarDays className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{job.jobTitle}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {job.customerName}
            {date && (
              <>
                {" · "}
                {date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                {" · "}
                {date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}
              </>
            )}
          </p>
        </div>
      </div>
    </SettleCard>
  );
}

/* ------------------------------ Today's Progress ----------------------------- */

export function TodaysProgress({
  completed,
  waiting,
  remaining,
}: {
  completed: number;
  waiting: number;
  remaining: number;
}) {
  if (completed === 0 && waiting === 0 && remaining === 0) return null;
  const rows = [
    { icon: <Check className="h-3.5 w-3.5 text-success" />, label: `${completed} ${completed === 1 ? "job" : "jobs"} completed`, show: completed > 0 },
    { icon: <MessageCircle className="h-3.5 w-3.5 text-amber-500" />, label: `${waiting} waiting for you`, show: waiting > 0 },
    { icon: <CalendarDays className="h-3.5 w-3.5 text-primary" />, label: `${remaining} remaining today`, show: remaining > 0 },
  ].filter((r) => r.show);

  return (
    <SettleCard delay={0.18}>
      <h2 className="mb-2.5 text-[15px] font-bold tracking-tight">Today&apos;s progress</h2>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-2.5 text-[13.5px]">
              {row.icon}
              <span>{row.label}</span>
            </div>
          ))}
        </div>
      </div>
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
    <SettleCard delay={0.05} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3.5">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
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

