import { SettleCard, Reveal } from "@/components/shared/motion";
import { EmptyState } from "@/components/shared/empty-state";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The full day's schedule — Front Desk only ever shows "right now" and
 * "up next"; Mission Control is the fuller operational view, so every
 * job scheduled today appears, not just the next one.
 */
export interface TodaysJobItem {
  id: string;
  customerName: string;
  jobTitle: string;
  status: string;
  scheduledFor: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-attention/10 text-attention",
  booked: "bg-accent text-primary",
  in_progress: "bg-accent text-primary",
  completed: "bg-success/10 text-success",
  cancelled: "bg-muted text-muted-foreground line-through",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  booked: "Booked",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function timeLabel(iso: string | null): string {
  if (!iso) return "No time set";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
}

export function TodaysJobs({ items }: { items: TodaysJobItem[] }) {
  return (
    <SettleCard delay={0.12} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Today&apos;s jobs</h2>
      {items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nothing scheduled for today."
          description="Jobs booked in for today will appear here as soon as they're on the diary."
        />
      ) : (
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <Reveal key={item.id} index={Math.min(i, 6)}>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40">
                <span className="w-[58px] shrink-0 text-[12px] font-semibold text-muted-foreground">
                  {timeLabel(item.scheduledFor)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{item.jobTitle}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{item.customerName}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    STATUS_STYLE[item.status] ?? "bg-muted text-muted-foreground"
                  )}
                >
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </SettleCard>
  );
}
