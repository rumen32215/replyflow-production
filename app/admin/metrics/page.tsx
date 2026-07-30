import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Metrics — ReplyFlow Admin" };
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

/**
 * Master Execution Plan 3.4 — "the founders need visibility into the
 * precursor signals to ever responsibly answer the Constitution's own
 * definition of success." The plan's own text allows starting as a
 * periodic report; a live page inside the admin surface Task 3.3 just
 * built costs almost nothing extra to add (auth already handled by
 * app/admin/layout.tsx) and satisfies "refreshed at least weekly" more
 * robustly than a script someone has to remember to run — always
 * current, not dependent on a human remembering a cron-less cadence.
 *
 * Every number here is a direct count/sum/ratio over real rows — never
 * a projection or an estimate dressed as a fact, matching the same
 * "only real system events" discipline as every other signal in this
 * product.
 */
export default async function AdminMetricsPage() {
  const service = createServiceClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: businesses } = await service
    .from("businesses")
    .select("id, business_name, subscription_status, trial_ends_at, stripe_customer_id");
  const all = businesses ?? [];

  const statusCounts = { trialing: 0, active: 0, past_due: 0, canceled: 0 } as Record<string, number>;
  for (const b of all) statusCounts[b.subscription_status] = (statusCounts[b.subscription_status] ?? 0) + 1;

  // Trial-to-paid conversion — only counts businesses that genuinely
  // went through the real trial (trial_ends_at set). Grandfathered
  // pre-billing businesses (trial_ends_at null) were never shown the
  // trial promise and never asked to convert, so including them would
  // understate the real rate, not just pad the sample.
  const realTrials = all.filter((b) => b.trial_ends_at !== null);
  const converted = realTrials.filter((b) => b.stripe_customer_id !== null);

  const { data: usage } = await service
    .from("ai_usage_events")
    .select("business_id, estimated_cost_usd")
    .gte("created_at", since);
  const costByBusiness = new Map<string, number>();
  for (const u of usage ?? []) costByBusiness.set(u.business_id, (costByBusiness.get(u.business_id) ?? 0) + Number(u.estimated_cost_usd ?? 0));
  const totalCost = [...costByBusiness.values()].reduce((a, b) => a + b, 0);
  const businessesWithUsage = costByBusiness.size;
  const topCost = [...costByBusiness.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const businessById = new Map(all.map((b) => [b.id, b]));

  const { data: drafts } = await service.from("reply_drafts").select("requires_escalation").gte("created_at", since);
  const totalDrafts = drafts?.length ?? 0;
  const escalated = (drafts ?? []).filter((d) => d.requires_escalation).length;

  const { data: errors } = await service.from("error_events").select("severity").gte("created_at", since);
  const errorCounts = { warning: 0, error: 0, critical: 0 } as Record<string, number>;
  for (const e of errors ?? []) errorCounts[e.severity] = (errorCounts[e.severity] ?? 0) + 1;

  // product_events (3.2) may not exist yet in every environment — same
  // defensive pattern already used for the ai_state column in
  // generate-reply.ts: degrade to "not available yet" rather than
  // breaking the whole page over one migration that hasn't landed.
  let approved = 0,
    edited = 0,
    rejected = 0,
    productEventsAvailable = true;
  try {
    const { data: events, error } = await service.from("product_events").select("event_type").gte("created_at", since);
    if (error) throw error;
    for (const e of events ?? []) {
      if (e.event_type === "draft.approved") approved++;
      else if (e.event_type === "draft.edited") edited++;
      else if (e.event_type === "draft.rejected") rejected++;
    }
  } catch {
    productEventsAvailable = false;
  }
  const resolvedActions = approved + edited + rejected;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin" className="text-[12.5px] text-slate-400 hover:text-slate-200">
          ← Businesses
        </Link>
        <h1 className="mt-1 text-[22px] font-bold tracking-tight">Metrics</h1>
        <p className="text-[13px] text-slate-400">Last {WINDOW_DAYS} days, except where noted as all-time.</p>
      </div>

      <section>
        <h2 className="mb-3 text-[15px] font-bold">Businesses (all-time snapshot)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["trialing", "active", "past_due", "canceled"] as const).map((status) => (
            <div key={status} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-[12px] text-slate-400">{status.replace("_", " ")}</p>
              <p className="mt-1 text-[22px] font-bold">{statusCounts[status] ?? 0}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-bold">Trial-to-paid conversion (all-time)</h2>
        {realTrials.length === 0 ? (
          <p className="text-[13px] text-slate-500">No business has completed a real trial yet — nothing to measure honestly.</p>
        ) : (
          <p className="text-[13px] text-slate-300">
            <span className="text-[22px] font-bold">{converted.length}</span> of {realTrials.length} businesses that went through a
            real trial converted to a paying customer ({((converted.length / realTrials.length) * 100).toFixed(0)}%). Grandfathered
            pre-billing businesses are excluded — they were never shown the trial promise.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-bold">Cost</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-[12px] text-slate-400">Total AI cost</p>
            <p className="mt-1 text-[22px] font-bold">${totalCost.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-[12px] text-slate-400">Businesses with usage</p>
            <p className="mt-1 text-[22px] font-bold">{businessesWithUsage}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-[12px] text-slate-400">Average per active business</p>
            <p className="mt-1 text-[22px] font-bold">${businessesWithUsage > 0 ? (totalCost / businessesWithUsage).toFixed(2) : "0.00"}</p>
          </div>
        </div>
        {topCost.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[12px] font-semibold text-slate-400">Top 5 by cost</p>
            {topCost.map(([businessId, cost]) => (
              <div key={businessId} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-[12.5px]">
                <Link href={`/admin/businesses/${businessId}`} className="text-slate-200 hover:underline">
                  {businessById.get(businessId)?.business_name ?? businessId}
                </Link>
                <span className="text-slate-400">${cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-[15px] font-bold">Escalation rate</h2>
          <p className="text-[13px] text-slate-300">
            <span className="text-[22px] font-bold">{totalDrafts > 0 ? ((escalated / totalDrafts) * 100).toFixed(1) : "0.0"}%</span>{" "}
            ({escalated} of {totalDrafts} drafts)
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-[15px] font-bold">Errors</h2>
          <p className="text-[13px] text-slate-300">
            {errorCounts.critical} critical · {errorCounts.error} error · {errorCounts.warning} warning
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-bold">Draft approve/edit/reject ratio</h2>
        {!productEventsAvailable ? (
          <p className="text-[13px] text-slate-500">Not available yet — the product_events migration (3.2) has not been applied in this environment.</p>
        ) : resolvedActions === 0 ? (
          <p className="text-[13px] text-slate-500">No owner actions recorded in this window yet.</p>
        ) : (
          <p className="text-[13px] text-slate-300">
            <span className="font-semibold text-emerald-400">{((approved / resolvedActions) * 100).toFixed(0)}% approved</span>
            {" · "}
            <span className="font-semibold text-amber-400">{((edited / resolvedActions) * 100).toFixed(0)}% edited</span>
            {" · "}
            <span className="font-semibold text-red-400">{((rejected / resolvedActions) * 100).toFixed(0)}% rejected</span>
            <span className="text-slate-500"> ({resolvedActions} total actions)</span>
          </p>
        )}
      </section>
    </div>
  );
}
