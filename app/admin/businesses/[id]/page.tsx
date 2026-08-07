import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { describeConnectionHealth } from "@/lib/front-desk-signals";
import { describeSubscriptionGate, type SubscriptionStatus } from "@/lib/billing";
import { formatDateTime } from "@/lib/work-card-format";

export const metadata: Metadata = { title: "Business — ReplyFlow Admin" };
export const dynamic = "force-dynamic";

/**
 * Master Execution Plan 3.3 — everything a support request needs about
 * one business in one place: connection and subscription status
 * (reusing the exact same pure logic the owner's own dashboard uses),
 * conversation list (linking to the read-only reasoning-trace view),
 * and recent error/product events for this business — all without a
 * raw database query.
 */
export default async function AdminBusinessPage({ params }: { params: { id: string } }) {
  const service = createServiceClient();
  const now = new Date();

  const { data: business } = await service
    .from("businesses")
    .select("id, business_name, trade, whatsapp_connected, subscription_status, trial_ends_at, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!business) notFound();

  const [{ data: connection }, { data: conversations }, { data: errors }, { data: events }] = await Promise.all([
    service.from("whatsapp_connections").select("token_expires_at, revoked_at").eq("business_id", params.id).maybeSingle(),
    service
      .from("conversations")
      .select("id, customer_name, customer_phone, status, last_message_at, last_message_preview")
      .eq("business_id", params.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50),
    service
      .from("error_events")
      .select("severity, source, message, created_at")
      .eq("business_id", params.id)
      .order("created_at", { ascending: false })
      .limit(20),
    service
      .from("product_events")
      .select("event_type, created_at")
      .eq("business_id", params.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const connectionHealth = describeConnectionHealth({
    connected: business.whatsapp_connected ?? false,
    tokenExpiresAt: connection?.token_expires_at ?? null,
    revokedAt: connection?.revoked_at ?? null,
    now,
  });
  const subscriptionGate = describeSubscriptionGate({
    status: business.subscription_status as SubscriptionStatus,
    trialEndsAt: business.trial_ends_at,
    now,
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-[12.5px] text-slate-400 hover:text-slate-200">
          ← All businesses
        </Link>
        <h1 className="mt-1 text-[22px] font-bold tracking-tight">{business.business_name}</h1>
        <p className="text-[13px] text-slate-400">{business.trade}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-[12px] font-semibold text-slate-400">WhatsApp connection</p>
          <p className="mt-1 text-[14px] font-semibold">{connectionHealth.status.replace("_", " ")}</p>
          {connectionHealth.message && <p className="mt-1 text-[12.5px] text-slate-400">{connectionHealth.message}</p>}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-[12px] font-semibold text-slate-400">Subscription</p>
          <p className="mt-1 text-[14px] font-semibold">{business.subscription_status}</p>
          {subscriptionGate.message && <p className="mt-1 text-[12.5px] text-slate-400">{subscriptionGate.message}</p>}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-[15px] font-bold">Conversations ({conversations?.length ?? 0})</h2>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Last message</th>
                <th className="px-4 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(conversations ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-slate-900/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/conversations/${c.id}`} className="font-semibold text-slate-100 hover:underline">
                      {c.customer_name || c.customer_phone}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{c.status}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-slate-400">{c.last_message_preview}</td>
                  <td className="px-4 py-2.5 text-slate-400">{formatDateTime(c.last_message_at)}</td>
                </tr>
              ))}
              {(conversations ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No conversations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-[15px] font-bold">Recent errors</h2>
          <ul className="space-y-2">
            {(errors ?? []).map((e, i) => (
              <li key={i} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-[12.5px]">
                <span className="font-semibold text-slate-200">{e.severity}</span>{" "}
                <span className="text-slate-500">· {e.source}</span>
                <p className="mt-0.5 text-slate-400">{e.message}</p>
                <p className="mt-0.5 text-slate-600">{formatDateTime(e.created_at)}</p>
              </li>
            ))}
            {(errors ?? []).length === 0 && <p className="text-[12.5px] text-slate-500">None in recent history.</p>}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-[15px] font-bold">Recent activity</h2>
          <ul className="space-y-1.5">
            {(events ?? []).map((e, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-[12.5px]">
                <span className="text-slate-200">{e.event_type}</span>
                <span className="text-slate-500">{formatDateTime(e.created_at)}</span>
              </li>
            ))}
            {(events ?? []).length === 0 && <p className="text-[12.5px] text-slate-500">None in recent history.</p>}
          </ul>
        </div>
      </section>
    </div>
  );
}
