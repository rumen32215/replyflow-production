"use client";

import { useState } from "react";
import { Loader2, ShieldOff } from "lucide-react";

/**
 * Master Execution Plan 3.1 — the blocking half of "gated gracefully":
 * shown in place of the dashboard's own content once a trial has
 * genuinely ended or a subscription is cancelled (never for trialing
 * with time left, and never for past_due — see lib/billing.ts). Still
 * inside the normal dashboard shell (Sidebar/Topbar/BottomNav keep
 * rendering) so Settings — where this actually gets fixed — always
 * stays one tap away, never a dead end.
 */
export function SubscriptionGate({ message }: { message: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-attention/15 text-attention">
        <ShieldOff className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-[19px] font-bold tracking-tight">Your receptionist is paused</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{message}</p>
      </div>
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Subscribe now
      </button>
      {error && <p className="text-[12.5px] text-destructive">{error}</p>}
      <p className="text-[12px] text-muted-foreground">
        Your data is safe and nothing is lost — everything picks back up the moment you subscribe.
      </p>
    </div>
  );
}
