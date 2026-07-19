import { Clock, Hourglass, Users } from "lucide-react";
import { SettleCard } from "@/components/shared/motion";
import { formatWaitStat, type WaitStats } from "@/lib/mission-control-signals";

/**
 * The aggregate view of who's waiting — Urgent Work already lists the
 * ranked queue of individual customers; this answers the original
 * Feature 02 spec's "Customers waiting, Average response time"
 * framing as a summary, not a second copy of the same list.
 */
export function WaitingCustomers({ stats }: { stats: WaitStats }) {
  if (stats.count === 0) return null;

  const metrics = [
    { icon: Users, label: "Waiting now", value: `${stats.count}` },
    { icon: Hourglass, label: "Longest wait", value: formatWaitStat(stats.longestMinutes) },
    { icon: Clock, label: "Average wait", value: formatWaitStat(stats.averageMinutes) },
  ];

  return (
    <SettleCard delay={0.15} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Waiting customers
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl bg-muted/30 p-3.5 text-center">
            <m.icon className="mx-auto h-4 w-4 text-attention" />
            <p className="mt-2 text-[18px] font-extrabold tracking-tight">{m.value}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>
    </SettleCard>
  );
}
