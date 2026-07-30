"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/work-card-format";
import type { ConnectionHealthStatus } from "@/lib/front-desk-signals";
import type { SubscriptionStatus } from "@/lib/billing";

export interface AdminBusinessRow {
  id: string;
  businessName: string;
  trade: string;
  createdAt: string;
  connectionStatus: ConnectionHealthStatus;
  subscriptionStatus: SubscriptionStatus;
  subscriptionBlocked: boolean;
}

const CONNECTION_LABEL: Record<ConnectionHealthStatus, { label: string; className: string }> = {
  connected: { label: "Connected", className: "bg-emerald-500/15 text-emerald-400" },
  expiring_soon: { label: "Expiring soon", className: "bg-amber-500/15 text-amber-400" },
  expired: { label: "Expired", className: "bg-red-500/15 text-red-400" },
  not_connected: { label: "Not connected", className: "bg-slate-700 text-slate-400" },
};

const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Payment failed",
  canceled: "Cancelled",
};

/**
 * Master Execution Plan 3.3 — a plain, honest text filter over an
 * already-loaded array, same shape as
 * components/dashboard/customers/customer-list.tsx: no server
 * round-trip per keystroke, correct at the current pre-launch scale
 * this is built for.
 */
export function BusinessSearch({ businesses }: { businesses: AdminBusinessRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter((b) => b.businessName.toLowerCase().includes(q) || b.trade.toLowerCase().includes(q));
  }, [businesses, query]);

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by business name or trade…"
        className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-[13.5px] text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
      />
      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Business</th>
              <th className="px-4 py-2.5 font-medium">Trade</th>
              <th className="px-4 py-2.5 font-medium">WhatsApp</th>
              <th className="px-4 py-2.5 font-medium">Subscription</th>
              <th className="px-4 py-2.5 font-medium">Signed up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.map((b) => {
              const conn = CONNECTION_LABEL[b.connectionStatus];
              return (
                <tr key={b.id} className="hover:bg-slate-900/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/businesses/${b.id}`} className="font-semibold text-slate-100 hover:underline">
                      {b.businessName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{b.trade}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", conn.className)}>{conn.label}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        b.subscriptionBlocked ? "bg-red-500/15 text-red-400" : "bg-slate-700 text-slate-300"
                      )}
                    >
                      {SUBSCRIPTION_LABEL[b.subscriptionStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{formatDate(b.createdAt)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No businesses match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
