"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubscriptionStatus } from "@/lib/billing";

const STATUS_LABEL: Record<SubscriptionStatus, { label: string; className: string }> = {
  trialing: { label: "Trial", className: "bg-attention/15 text-attention" },
  active: { label: "Active", className: "bg-success/15 text-success" },
  past_due: { label: "Payment failed", className: "bg-destructive/15 text-destructive" },
  canceled: { label: "Cancelled", className: "bg-destructive/15 text-destructive" },
};

/**
 * Master Execution Plan 3.1 — the one place an owner sees and acts on
 * their subscription. Never a custom card-entry form: "Subscribe"
 * hands off to Stripe Checkout, "Manage billing" hands off to Stripe's
 * own Customer Portal — both hosted, so ReplyFlow's own systems never
 * see a card number.
 */
export function SettingsBilling({
  status,
  daysLeftInTrial,
  hasStripeCustomer,
}: {
  status: SubscriptionStatus;
  daysLeftInTrial: number | null;
  hasStripeCustomer: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(path: "checkout" | "portal") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/${path}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  const statusInfo = STATUS_LABEL[status];
  const description =
    status === "trialing"
      ? daysLeftInTrial !== null
        ? `${daysLeftInTrial} day${daysLeftInTrial === 1 ? "" : "s"} left in your free trial.`
        : "Your free trial is active."
      : status === "active"
        ? "Your subscription is active — thanks for being a customer."
        : status === "past_due"
          ? "Your last payment didn't go through. Update your card to avoid any interruption."
          : "Your subscription has been cancelled.";

  // Stripe's Customer Portal manages a *live* subscription (update
  // card, cancel) — it's not the right surface to start a brand new
  // one. A cancelled subscription (even though a stripe_customer_id
  // still exists from before) needs real Checkout instead, same as
  // trialing. A business grandfathered active with no Stripe customer
  // at all (every pre-billing account) has nothing to do and no button
  // that could honestly do anything — Checkout would just reject it as
  // already active.
  const showManage = hasStripeCustomer && (status === "active" || status === "past_due");
  const showSubscribe = !showManage && (status === "trialing" || status === "canceled" || hasStripeCustomer);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
        <span className="text-[13.5px] text-muted-foreground">Plan</span>
        <span className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-bold", statusInfo.className)}>{statusInfo.label}</span>
      </div>
      <p className="text-[13px] text-muted-foreground">{description}</p>
      {(showManage || showSubscribe) && (
        <button
          type="button"
          onClick={() => go(showManage ? "portal" : "checkout")}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13.5px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {showManage ? "Manage billing" : "Subscribe now"}
        </button>
      )}
      {error && <p className="text-[12.5px] text-destructive">{error}</p>}
    </div>
  );
}
