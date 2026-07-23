import { Check } from "lucide-react";
import { SettleCard, Reveal } from "@/components/shared/motion";
import { minutesSince, formatWaitingTime } from "@/lib/dashboard-signals";

/**
 * Recently Completed (Owner Experience 01) — proof of work done, not
 * just work outstanding. A quiet but real confidence signal: the
 * business is actually moving, not just accumulating a queue.
 */
export interface RecentlyCompletedItem {
  id: string;
  customerName: string;
  issue: string;
  completedAt: string;
}

export function RecentlyCompleted({ items }: { items: RecentlyCompletedItem[] }) {
  if (items.length === 0) return null;

  return (
    <SettleCard delay={0.17} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Recently completed</h2>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <Reveal key={item.id} index={Math.min(i, 6)}>
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                <Check className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">{item.issue}</p>
                <p className="truncate text-[12px] text-muted-foreground">{item.customerName}</p>
              </div>
              <span className="shrink-0 text-[12px] text-muted-foreground">
                {formatWaitingTime(minutesSince(item.completedAt))} ago
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </SettleCard>
  );
}
