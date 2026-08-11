import Link from "next/link";
import { Check, ClipboardCheck, Minus } from "lucide-react";
import { SettleCard, Reveal } from "@/components/shared/motion";
import type { JobReadinessItem } from "@/lib/work-card-state";
import { cn } from "@/lib/utils";

/**
 * Ready to Quote (ReplyFlow V2) — the payoff moment of "Job Capture &
 * Readiness": a Work Card the receptionist has finished gathering
 * everything useful for, surfaced separately from the rest of "Needs
 * Your Attention" so the owner can see, at a glance, which enquiries
 * are actually ready to be priced and booked versus still being
 * gathered. Every checklist item traces back to a real Work Card
 * field or the real, already-persisted Conversation State
 * (lib/work-card-state.ts's own `computeJobReadiness`) — nothing here
 * is a judgement the AI made about whether the job "feels" ready.
 */
export interface ReadyToQuoteItem {
  id: string;
  customerName: string;
  issue: string;
  checklist: JobReadinessItem[];
}

function ChecklistBadge({ item }: { item: JobReadinessItem }) {
  const done = item.status === "done";
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        done ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
      )}
    >
      {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : <Minus className="h-2.5 w-2.5" strokeWidth={3} />}
      {item.label}
    </span>
  );
}

export function ReadyToQuote({ items }: { items: ReadyToQuoteItem[] }) {
  if (items.length === 0) return null;

  return (
    <SettleCard delay={0.1} className="rounded-2xl border border-success/25 bg-success/[0.03] p-6 shadow-sm">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-success">Ready to quote</h2>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <Reveal key={item.id} index={Math.min(i, 6)}>
            <Link
              href={`/dashboard/work-cards/${item.id}`}
              className="block rounded-xl px-3 py-2.5 hover:bg-muted/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                  <ClipboardCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{item.issue}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{item.customerName}</p>
                </div>
              </div>
              <div className="ml-11 mt-2 flex flex-wrap gap-1.5">
                {item.checklist.map((c) => (
                  <ChecklistBadge key={c.key} item={c} />
                ))}
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </SettleCard>
  );
}
