import { AlertTriangle, Briefcase, Check, MessageCircle, type LucideIcon } from "lucide-react";
import { SettleCard, Reveal } from "@/components/shared/motion";
import { minutesSince, formatWaitingTime } from "@/lib/dashboard-signals";
import type { ActivityEvent, ActivityKind } from "@/lib/front-desk-signals";
import { cn } from "@/lib/utils";

/**
 * Receptionist Activity (Owner Experience 01) — "what has my
 * receptionist already handled?" answered as a real, chronological
 * feed, not a summary she generated about herself. Every line comes
 * from lib/front-desk-signals.ts's buildReceptionistActivity, which
 * only ever turns real stored timestamps into sentences — never a
 * fabricated or paraphrased account of what happened.
 */
const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  work_card_started: Briefcase,
  work_card_booked: Check,
  work_card_completed: Check,
  conversation_started: MessageCircle,
  escalated: AlertTriangle,
};

const KIND_STYLE: Record<ActivityKind, string> = {
  work_card_started: "bg-primary/10 text-primary",
  work_card_booked: "bg-success/10 text-success",
  work_card_completed: "bg-success/10 text-success",
  conversation_started: "bg-attention/10 text-attention",
  escalated: "bg-destructive/10 text-destructive",
};

export function ReceptionistActivity({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) return null;

  return (
    <SettleCard delay={0.22} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Receptionist activity</h2>
      <div className="space-y-3">
        {events.map((event, i) => {
          const Icon = KIND_ICON[event.kind];
          return (
            <Reveal key={event.id} index={i}>
              <div className="flex items-start gap-2.5 text-[13.5px]">
                <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", KIND_STYLE[event.kind])}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5">
                  <span className="text-foreground">{event.text}</span>
                  <span className="shrink-0 text-[11.5px] text-muted-foreground">
                    {formatWaitingTime(minutesSince(event.occurredAt))} ago
                  </span>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </SettleCard>
  );
}
