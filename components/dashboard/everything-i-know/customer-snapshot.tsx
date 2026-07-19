import { Users } from "lucide-react";
import { SettleCard } from "@/components/shared/motion";

/**
 * "Your customers" — two real counts (Customer Memory already computes
 * these the same way for its own list; see lib/customer-memory-signals.ts).
 * No per-customer prose here — preferences and history aren't structured
 * data yet, so this stays to what's actually countable.
 */
export function CustomerSnapshot({
  totalCustomers,
  returningCustomers,
}: {
  totalCustomers: number;
  returningCustomers: number;
}) {
  if (totalCustomers === 0) {
    return (
      <SettleCard delay={0.18} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Your customers</h2>
        <div className="flex items-center gap-2.5 text-[13.5px] text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>No customers yet — I&apos;ll start remembering them here once your first enquiry arrives.</span>
        </div>
      </SettleCard>
    );
  }

  const parts: string[] = [`I'm remembering ${totalCustomers} ${totalCustomers === 1 ? "customer" : "customers"}.`];
  if (returningCustomers > 0) {
    parts.push(
      `${returningCustomers} ${returningCustomers === 1 ? "of them has" : "of them have"} come back for more than one job.`
    );
  }

  return (
    <SettleCard delay={0.18} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Your customers</h2>
      <p className="text-[13.5px] leading-relaxed">{parts.join(" ")}</p>
    </SettleCard>
  );
}
