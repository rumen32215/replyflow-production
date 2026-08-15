import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/app/(dashboard)/sidebar";
import { Topbar } from "@/app/(dashboard)/topbar";
import { BottomNav } from "@/app/(dashboard)/bottom-nav";
import { SubscriptionGate } from "@/components/dashboard/billing/subscription-gate";
import { SubscriptionBanner } from "@/components/dashboard/billing/subscription-banner";
import { describeSubscriptionGate, type SubscriptionStatus } from "@/lib/billing";
import { countAttentionItems } from "@/lib/attention-count";

/**
 * Guards the whole (dashboard) route group server-side: no session ->
 * /login, onboarding not finished -> back into the wizard. Mobile-first
 * shell (Implementation Pack): bottom tab bar on phones, sidebar on
 * desktop — the same five destinations, desktop simply gains space.
 */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, business_name, logo_url, onboarding_completed, subscription_status, trial_ends_at")
    .eq("owner_id", user.id)
    .maybeSingle();
  // A real query error is not "onboarding incomplete" — this guards
  // every dashboard page, so conflating the two here would silently
  // bounce the whole app into the onboarding wizard on any transient
  // failure. See the identical fix in dashboard/receptionist/page.tsx.
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);
  if (!business?.onboarding_completed) redirect("/onboarding/preparing");

  const approvalsCount = await countAttentionItems(supabase, business.id);

  // Master Execution Plan 3.1 — gated gracefully: Settings always stays
  // reachable (that's where billing actually gets fixed), everything
  // else in the product is replaced by SubscriptionGate once genuinely
  // blocked (an expired trial or a cancelled subscription — trialing
  // with time left and past_due never block, only warn via the banner
  // below). See middleware.ts for why the current path is readable here.
  const pathname = headers().get("x-pathname") ?? "";
  const isSettingsPath = pathname.startsWith("/dashboard/settings");
  const gate = describeSubscriptionGate({
    status: business.subscription_status as SubscriptionStatus,
    trialEndsAt: business.trial_ends_at,
    now: new Date(),
  });
  const blocked = gate.blocked && !isSettingsPath;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar approvalsCount={approvalsCount} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar businessName={business.business_name} logoUrl={business.logo_url} />
        {/* pb-24 keeps content clear of the mobile tab bar */}
        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-6 md:px-8 md:pb-8 md:pt-8">
          {!isSettingsPath && <SubscriptionBanner message={!gate.blocked ? gate.message : null} />}
          {blocked ? <SubscriptionGate message={gate.message} /> : children}
        </main>
      </div>
      <BottomNav approvalsCount={approvalsCount} />
    </div>
  );
}
