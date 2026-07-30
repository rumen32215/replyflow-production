import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import { describeConnectionHealth } from "@/lib/front-desk-signals";
import { describeSubscriptionGate, type SubscriptionStatus } from "@/lib/billing";
import { BusinessSearch, type AdminBusinessRow } from "@/components/admin/business-search";

export const metadata: Metadata = { title: "Admin — ReplyFlow" };
export const dynamic = "force-dynamic";

/**
 * Master Execution Plan 3.3 — "a support request can be investigated
 * without a raw database query." The one legitimate cross-tenant read
 * in the product: service-role client, gated entirely by
 * app/admin/layout.tsx before this ever runs. Search is a plain
 * client-side filter over the full (small, pre-launch-scale) business
 * list, matching the exact pattern components/dashboard/customers/
 * customer-list.tsx already established for the same shape of problem.
 */
export default async function AdminPage() {
  const service = createServiceClient();
  const now = new Date();

  const { data: businesses, error } = await service
    .from("businesses")
    .select("id, business_name, trade, whatsapp_connected, subscription_status, trial_ends_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load businesses: ${error.message}`);

  const { data: connections } = await service.from("whatsapp_connections").select("business_id, token_expires_at");
  const connectionByBusiness = new Map((connections ?? []).map((c) => [c.business_id, c.token_expires_at]));

  const rows: AdminBusinessRow[] = (businesses ?? []).map((b) => {
    const connectionHealth = describeConnectionHealth({
      connected: b.whatsapp_connected ?? false,
      tokenExpiresAt: connectionByBusiness.get(b.id) ?? null,
      now,
    });
    const subscriptionGate = describeSubscriptionGate({
      status: b.subscription_status as SubscriptionStatus,
      trialEndsAt: b.trial_ends_at,
      now,
    });
    return {
      id: b.id,
      businessName: b.business_name,
      trade: b.trade,
      createdAt: b.created_at,
      connectionStatus: connectionHealth.status,
      subscriptionStatus: b.subscription_status as SubscriptionStatus,
      subscriptionBlocked: subscriptionGate.blocked,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">Businesses</h1>
        <p className="mt-1 text-[13px] text-slate-400">{rows.length} total.</p>
      </div>
      <BusinessSearch businesses={rows} />
    </div>
  );
}
