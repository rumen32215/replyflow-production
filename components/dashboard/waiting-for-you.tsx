import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatWaitingTime } from "@/lib/dashboard-signals";

export interface WaitingCustomer {
  conversationId: string;
  name: string;
  reason: string;
  minutes: number;
}

/** No empty state by design — "nobody's waiting" is good news that
 * doesn't need a card to announce it. page.tsx simply doesn't render
 * this component when the list is empty. */
export function WaitingForYou({ customers }: { customers: WaitingCustomer[] }) {
  if (customers.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-[13px] font-semibold text-muted-foreground">Waiting for you</h2>
      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {customers.map((customer) => (
          <Link
            key={customer.conversationId}
            href={`/dashboard/conversations/${customer.conversationId}`}
            className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-primary">
              {customer.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{customer.name}</p>
              <p className="truncate text-[12.5px] text-muted-foreground">{customer.reason}</p>
            </div>
            <span className="shrink-0 text-[12px] font-medium text-amber-600">
              {formatWaitingTime(customer.minutes)}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}
