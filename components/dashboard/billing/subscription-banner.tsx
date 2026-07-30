import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { SettleCard } from "@/components/shared/motion";

/**
 * Master Execution Plan 3.1 — the non-blocking half of "gated
 * gracefully" (Operations Blueprint §6): trial-ending-soon and
 * past_due both keep the product fully working, but say so plainly
 * rather than surprising the owner with a sudden block later. Visual
 * language matches ConnectionAlert exactly — the product's existing
 * pattern for "something needs your attention, but nothing is broken
 * yet."
 */
export function SubscriptionBanner({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <SettleCard delay={0.02} className="mb-4">
      <Link href="/dashboard/settings" className="group block">
        <div className="flex items-center gap-3 rounded-2xl border-l-4 border-attention bg-attention/[0.06] p-4 pl-3.5 transition-shadow group-hover:shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-attention/15 text-attention">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold">Billing</p>
            <p className="text-[12.5px] text-muted-foreground">{message}</p>
          </div>
        </div>
      </Link>
    </SettleCard>
  );
}
