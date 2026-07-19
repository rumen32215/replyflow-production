import { Briefcase, Check, MessagesSquare, Clock, Sparkles } from "lucide-react";
import { SettleCard } from "@/components/shared/motion";

/**
 * Opening snapshot — "what does the business look like right now,"
 * answered in four real numbers before anything else. Deliberately
 * only four: the original Feature 02 spec names six (adding Revenue
 * and Customer Satisfaction), but neither exists as real data yet —
 * see Sprint 5's report for why those two are intentionally absent
 * rather than shown as a fabricated "£0" or invented score.
 *
 * Sprint 7.5: a brand-new business used to see four tiles reading
 * "0 0 0 0" — technically honest, but it read as "everything is
 * broken," not "everything is under control." When every metric is
 * genuinely zero, one calm reassurance replaces the grid instead —
 * same real fact (nothing has happened yet), different feeling. This
 * never invents data; it only stops presenting the total absence of
 * data as four separate failures.
 */
export interface OperationalOverviewMetrics {
  waitingCount: number;
  jobsToday: number;
  completedToday: number;
  openConversations: number;
}

/** Shared with the page itself (Sprint 7.6) so the "nothing in progress /
 * nothing scheduled" sections below know not to repeat this same
 * reassurance a second time when the whole day is genuinely quiet. */
export function isOperationallyEmpty({ waitingCount, jobsToday, completedToday, openConversations }: OperationalOverviewMetrics): boolean {
  return waitingCount === 0 && jobsToday === 0 && completedToday === 0 && openConversations === 0;
}

export function OperationalOverview(metrics: OperationalOverviewMetrics) {
  const { waitingCount, jobsToday, completedToday, openConversations } = metrics;
  const isEmpty = isOperationallyEmpty(metrics);

  if (isEmpty) {
    return (
      <SettleCard className="rounded-2xl border border-success/25 bg-success/5 p-6 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[14px] font-semibold leading-snug">Everything&apos;s under control.</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Nothing&apos;s happened yet today — as soon as it does, I&apos;ll show it here.
            </p>
          </div>
        </div>
      </SettleCard>
    );
  }

  const cards = [
    { icon: Clock, label: "Waiting on you", value: waitingCount },
    { icon: Briefcase, label: "Today's jobs", value: jobsToday },
    { icon: Check, label: "Completed today", value: completedToday },
    { icon: MessagesSquare, label: "Open conversations", value: openConversations },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card, i) => (
        <SettleCard
          key={card.label}
          delay={0.02 * i}
          className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm sm:p-6"
        >
          <card.icon className="mx-auto h-4 w-4 text-muted-foreground" />
          <p className="mt-2.5 text-[26px] font-extrabold tracking-tight">{card.value}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{card.label}</p>
        </SettleCard>
      ))}
    </div>
  );
}
