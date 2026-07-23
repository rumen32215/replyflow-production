import Link from "next/link";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { SettleCard, Reveal } from "@/components/shared/motion";
import { describeWorkCardState, type WorkCardStateTone } from "@/lib/work-card-state";
import { cn } from "@/lib/utils";

/**
 * Today's Work (Owner Experience 01) — every Work Card scheduled
 * today, each one telling the owner what it actually needs from them
 * (or that it needs nothing at all) instead of a bare status word.
 * "Mission Control should revolve around Work Cards" — this is that,
 * replacing both Front Desk's old "Right Now / Up Next" single-item
 * view and Mission Control's flat status-badge list.
 */
export interface TodaysWorkItem {
  id: string;
  conversationId: string | null;
  customerName: string;
  issue: string;
  scheduledFor: string | null;
  status: string;
  addressConfirmed: boolean;
  conversationGroup: "waiting" | "active" | "booked" | "done" | null;
  isEmergency: boolean;
}

const TONE_STYLE: Record<WorkCardStateTone, string> = {
  emergency: "bg-destructive/10 text-destructive",
  attention: "bg-attention/10 text-attention",
  warning: "bg-amber-100 text-amber-700",
  success: "bg-success/10 text-success",
  active: "bg-accent text-primary",
  neutral: "bg-muted text-muted-foreground",
};

function timeLabel(iso: string | null): string {
  if (!iso) return "No time set";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
}

export function TodaysWork({ items }: { items: TodaysWorkItem[] }) {
  return (
    <SettleCard delay={0.12} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Today&apos;s work</h2>
      {items.length === 0 ? (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[14px] font-semibold">Nothing booked in for today.</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">I&apos;ll show it here the moment something is.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, i) => {
            const state = describeWorkCardState({
              status: item.status,
              addressConfirmed: item.addressConfirmed,
              conversationGroup: item.conversationGroup,
              isEmergency: item.isEmergency,
            });
            const href = item.conversationId ? `/dashboard/conversations/${item.conversationId}` : "/dashboard/conversations";
            return (
              <Reveal key={item.id} index={Math.min(i, 6)}>
                <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40">
                  <span className="w-[58px] shrink-0 text-[12px] font-semibold text-muted-foreground">
                    {timeLabel(item.scheduledFor)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">{item.issue}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{item.customerName}</p>
                  </div>
                  <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold", TONE_STYLE[state.tone])}>
                    {state.tone === "emergency" && <AlertTriangle className="h-2.5 w-2.5" />}
                    {state.label}
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}
    </SettleCard>
  );
}
