import { Briefcase, Check, MessageCircle } from "lucide-react";
import { SettleCard } from "@/components/shared/motion";

/**
 * Section 7 — Business Health. Spec calls for five compact metrics
 * (workload, satisfaction, response speed, outstanding quotes, repeat
 * customers) — only three are backed by real data today (there's no
 * quote/invoice model or satisfaction tracking yet), so only those
 * three appear. Never fabricated to hit a round number; "avoid vanity
 * metrics, use meaningful information only" applies to the count of
 * metrics as much as their content.
 */
export interface BusinessHealthMetrics {
  jobsToday: number;
  completedToday: number;
  waitingCount: number;
}

export function BusinessHealth({ jobsToday, completedToday, waitingCount }: BusinessHealthMetrics) {
  if (jobsToday === 0 && completedToday === 0 && waitingCount === 0) return null;

  const metrics = [
    { icon: Briefcase, label: "Today's workload", value: `${jobsToday} ${jobsToday === 1 ? "job" : "jobs"}` },
    { icon: Check, label: "Completed", value: `${completedToday}` },
    { icon: MessageCircle, label: "Waiting on you", value: `${waitingCount}` },
  ];

  return (
    <SettleCard delay={0.2} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Business health</h2>
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl bg-muted/30 p-3.5 text-center">
            <m.icon className="mx-auto h-4 w-4 text-muted-foreground" />
            <p className="mt-2 text-[18px] font-extrabold tracking-tight">{m.value}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>
    </SettleCard>
  );
}
