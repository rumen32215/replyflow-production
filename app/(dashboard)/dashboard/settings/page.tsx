import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsPasswordForm } from "@/components/dashboard/settings-password-form";
import { SettingsNotifications } from "@/components/dashboard/settings-notifications";
import { SettingsDangerZone } from "@/components/dashboard/settings-danger-zone";

export const metadata: Metadata = { title: "Settings — ReplyFlow" };

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, business_name, notify_new_enquiry, notify_daily_summary")
    .eq("owner_id", user.id)
    .maybeSingle();
if (!business) {
  redirect("/welcome");
}
  
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Account, security, and notification preferences.</p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-[15px] font-bold">Account</h2>
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
          <span className="text-[13.5px] text-muted-foreground">Email</span>
          <span className="text-[13.5px] font-semibold">{user.email}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 text-[15px] font-bold">Password</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">Update the password you use to log in.</p>
        <SettingsPasswordForm />
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 text-[15px] font-bold">Notifications</h2>
        <p className="mb-2 text-[13px] text-muted-foreground">Choose what ReplyFlow keeps you posted on.</p>
        <SettingsNotifications
          businessId={business.id}
          initialNewEnquiry={business.notify_new_enquiry}
          initialDailySummary={business.notify_daily_summary}
        />
      </section>

      <SettingsDangerZone businessName={business.business_name} />
    </div>
  );
}
