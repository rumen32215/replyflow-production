import { Calendar, Check, MessageCircle, X, type LucideIcon } from "lucide-react";
import { SettleCard, Reveal } from "@/components/shared/motion";
import type { TimelineEvent } from "@/lib/customer-memory-signals";
import { cn } from "@/lib/utils";

/**
 * Chronological relationship history (Feature 12 UI: "Relationship
 * Timeline... everything important appears naturally"). Same
 * connected-dot timeline visual already established for Front Desk's
 * Recent Learning (components/dashboard/home/whats-on-my-mind.tsx) —
 * reused rather than reinvented, per Sprint 7's motion constraint.
 * Every event here traces back to a real, already-stored timestamp.
 */
const KIND_ICON: Record<TimelineEvent["kind"], LucideIcon> = {
  enquiry: MessageCircle,
  scheduled: Calendar,
  completed: Check,
  cancelled: X,
};

const KIND_STYLE: Record<TimelineEvent["kind"], string> = {
  enquiry: "bg-attention/10 text-attention",
  scheduled: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  cancelled: "bg-muted text-muted-foreground",
};

export function RelationshipTimeline({ events }: { events: readonly TimelineEvent[] }) {
  if (events.length === 0) return null;
  const newestFirst = [...events].reverse();

  return (
    <SettleCard delay={0.13} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[13px] font-bold">Relationship timeline</h2>
      <div className="space-y-4">
        {newestFirst.map((event, i) => {
          const Icon = KIND_ICON[event.kind];
          const isLast = i === newestFirst.length - 1;
          return (
            <Reveal key={event.id} index={i}>
              <div className="flex gap-3">
                <div className="relative flex flex-col items-center">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", KIND_STYLE[event.kind])}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {!isLast && <span aria-hidden className="mt-1 w-px flex-1 bg-border" />}
                </div>
                <div className="min-w-0 flex-1 pb-4">
                  <p className="text-[13.5px] font-medium text-foreground">{event.label}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {new Date(event.occurredAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </SettleCard>
  );
}
