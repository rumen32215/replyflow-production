"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Check,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
} from "lucide-react";
import { SettleCard, Reveal, press } from "@/components/shared/motion";
import { formatWaitingTime } from "@/lib/dashboard-signals";
import { cn } from "@/lib/utils";

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

export function HomeGreeting({ name, supportLine }: { name: string; supportLine: string }) {
  return (
    <SettleCard>
      <h1 className="text-[24px] font-extrabold tracking-tight md:text-[26px]" suppressHydrationWarning>
        {greetingForNow()}, {name}.
      </h1>
      <p className="mt-1 text-[14px] text-muted-foreground">{supportLine}</p>
    </SettleCard>
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

/* --------------------------- State 1: the checklist -------------------------- */

export interface ChecklistState {
  whatsappConnected: boolean;
  hasFirstEnquiry: boolean;
  hasFirstBooking: boolean;
}

export function GettingStartedChecklist({ state }: { state: ChecklistState }) {
  const steps = [
    { label: "Receptionist ready", done: true, href: "/dashboard/receptionist" },
    { label: "Connect WhatsApp", done: state.whatsappConnected, href: "/dashboard/whatsapp" },
    { label: "Receive your first enquiry", done: state.hasFirstEnquiry, href: null },
    { label: "Complete your first booking", done: state.hasFirstBooking, href: null },
  ];
  const next = steps.find((s) => !s.done);

  return (
    <SettleCard delay={0.05} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-[15px] font-bold tracking-tight">Your receptionist is ready.</p>
      </div>
      <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
        {next?.label === "Connect WhatsApp"
          ? "Connect WhatsApp and I can start looking after your customers."
          : "Here's how your first customer will arrive."}
      </p>
      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const row = (
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px]",
                step.done ? "text-muted-foreground" : "font-semibold",
                !step.done && step.href && "bg-accent/70 text-primary"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  step.done ? "border-success bg-success text-success-foreground" : "border-border bg-card"
                )}
              >
                {step.done && (
                  <motion.span
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.15 + i * 0.05 }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </motion.span>
                )}
              </span>
              <span className={cn(step.done && "line-through decoration-border")}>{step.label}</span>
              {!step.done && step.href && <ArrowRight className="ml-auto h-3.5 w-3.5" />}
            </div>
          );
          return (
            <Reveal key={step.label} index={i}>
              {!step.done && step.href ? (
                <Link href={step.href} className="block">
                  <motion.div {...press}>{row}</motion.div>
                </Link>
              ) : (
                row
              )}
            </Reveal>
          );
        })}
      </div>
    </SettleCard>
  );
}

/* --------------------------- Availability at a glance ------------------------ */

export function TodayInTheDiary({ line }: { line: string }) {
  return (
    <SettleCard delay={0.22}>
      <Link href="/dashboard/availability" className="group block">
        <motion.div
          {...press}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow group-hover:shadow-md"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <Phone className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">Today&apos;s diary</p>
            <p className="truncate text-[12.5px] text-muted-foreground">{line}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </motion.div>
      </Link>
    </SettleCard>
  );
}
