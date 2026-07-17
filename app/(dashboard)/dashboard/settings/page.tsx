import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bell, Lock, Sparkles, UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SettleCard } from "@/components/shared/motion";
import { SettingsPasswordForm } from "@/components/dashboard/settings-password-form";
import { SettingsNotifications } from "@/components/dashboard/settings-notifications";
import { SettingsIdentity } from "@/components/dashboard/settings-identity";
import { SettingsDangerZone } from "@/components/dashboard/settings-danger-zone";

export const metadata: Metadata = { title: "Settings — ReplyFlow" };

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, business_name, notify_new_enquiry, notify_daily_summary, logo_url, receptionist_name")
    .eq("owner_id", user.id)
    .maybeSingle();
  // A real query error is not "onboarding incomplete" — see the
  // identical fix and explanation in dashboard/receptionist/page.tsx.
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);
  if (!business) {
    redirect("/welcome");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SettleCard>
        <h1 className="text-[26px] font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Account, security, and notification preferences.</p>
      </SettleCard>

      <SettleCard delay={0.05} className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
            <UserCircle className="h-4 w-4" />
          </div>
          <h2 className="text-[15px] font-bold">Account</h2>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
          <span className="text-[13.5px] text-muted-foreground">Email</span>
          <span className="text-[13.5px] font-semibold">{user.email}</span>
        </div>
      </SettleCard>

      <SettleCard delay={0.07} className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-[15px] font-bold">Identity</h2>
        </div>
        <SettingsIdentity
          businessId={business.id}
          businessName={business.business_name}
          initialLogoUrl={business.logo_url}
          initialReceptionistName={business.receptionist_name}
        />
      </SettleCard>

      <SettleCard delay={0.09} className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
            <Lock className="h-4 w-4" />
          </div>
          <h2 className="text-[15px] font-bold">Password</h2>
        </div>
        <p className="mb-4 text-[13px] text-muted-foreground">Update the password you use to log in.</p>
        <SettingsPasswordForm />
      </SettleCard>

      <SettleCard delay={0.13} className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
            <Bell className="h-4 w-4" />
          </div>
          <h2 className="text-[15px] font-bold">Notifications</h2>
        </div>
        <p className="mb-2 text-[13px] text-muted-foreground">Choose what ReplyFlow keeps you posted on.</p>
        <SettingsNotifications
          businessId={business.id}
          initialNewEnquiry={business.notify_new_enquiry}
          initialDailySummary={business.notify_daily_summary}
        />
      </SettleCard>

      <SettleCard delay={0.17}>
        <SettingsDangerZone businessName={business.business_name} />
      </SettleCard>
    </div>
  );
}
