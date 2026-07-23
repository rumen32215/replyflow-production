import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { SettleCard, Reveal } from "@/components/shared/motion";

/**
 * Waiting For Customer (Owner Experience 01) — bookings already
 * confirmed, sitting calmly ahead on the diary. Nothing here needs
 * the owner; it exists so "what's coming up" doesn't require opening
 * the Diary separately.
 */
export interface WaitingForCustomerItem {
  id: string;
  conversationId: string | null;
  customerName: string;
  issue: string;
  scheduledFor: string;
}

function dateTimeLabel(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}`;
}

export function WaitingForCustomer({ items }: { items: WaitingForCustomerItem[] }) {
  if (items.length === 0) return null;

  return (
    <SettleCard delay={0.15} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Waiting for customer</h2>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <Reveal key={item.id} index={Math.min(i, 6)}>
            <Link
              href={item.conversationId ? `/dashboard/conversations/${item.conversationId}` : "/dashboard/conversations"}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">{item.issue}</p>
                <p className="truncate text-[12px] text-muted-foreground">{item.customerName}</p>
              </div>
              <span className="shrink-0 text-[12px] text-muted-foreground">{dateTimeLabel(item.scheduledFor)}</span>
            </Link>
          </Reveal>
        ))}
      </div>
    </SettleCard>
  );
}
