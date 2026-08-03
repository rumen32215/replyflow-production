import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bell, CreditCard, LifeBuoy, Lock, UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SettleCard } from "@/components/shared/motion";
import { SettingsPasswordForm } from "@/components/dashboard/settings-password-form";
import { SettingsNotifications } from "@/components/dashboard/settings-notifications";
import { SettingsBilling } from "@/components/dashboard/settings-billing";
import { SettingsDangerZone } from "@/components/dashboard/settings-danger-zone";
import { describeSubscriptionGate, type SubscriptionStatus } from "@/lib/billing";

export const metadata: Metadata = { title: "Settings — ReplyFlow" };

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, business_name, subscription_status, trial_ends_at, stripe_customer_id, notify_new_enquiry")
    .eq("owner_id", user.id)
    .maybeSingle();
  // A real query error is not "onboarding incomplete" — see the
  // identical fix and explanation in dashboard/receptionist/page.tsx.
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);
  if (!business) {
    redirect("/welcome");
  }

  const supportEmail = process.env.SUPPORT_EMAIL || null;
  // Owner Attention Architecture (doc 14) — the toggle only ever
  // renders as live once a real channel actually exists, same
  // discipline as the "Get help" section just above it.
  const emailDeliveryConfigured = Boolean(process.env.RESEND_API_KEY && process.env.ATTENTION_FROM_EMAIL);
  const subscriptionGate = describeSubscriptionGate({
    status: business.subscription_status as SubscriptionStatus,
    trialEndsAt: business.trial_ends_at,
    now: new Date(),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SettleCard>
        <h1 className="text-[26px] font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account, your receptionist, and how I keep you posted.</p>
      </SettleCard>

      <SettleCard delay={0.05} className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserCircle className="h-4 w-4" />
          </div>
          <h2 className="text-[15px] font-bold">Account</h2>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
          <span className="text-[13.5px] text-muted-foreground">Email</span>
          <span className="text-[13.5px] font-semibold">{user.email}</span>
        </div>
      </SettleCard>

      <SettleCard delay={0.09} className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lock className="h-4 w-4" />
          </div>
          <h2 className="text-[15px] font-bold">Password</h2>
        </div>
        <p className="mb-4 text-[13px] text-muted-foreground">Update the password you use to log in.</p>
        <SettingsPasswordForm />
      </SettleCard>

      <SettleCard delay={0.13} className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="h-4 w-4" />
          </div>
          <h2 className="text-[15px] font-bold">Notifications</h2>
        </div>
        <p className="mb-2 text-[13px] text-muted-foreground">Choose what ReplyFlow keeps you posted on.</p>
        <SettingsNotifications
          businessId={business.id}
          initialNotifyNewEnquiry={business.notify_new_enquiry ?? true}
          emailDeliveryConfigured={emailDeliveryConfigured}
        />
      </SettleCard>

      <SettleCard delay={0.17} className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CreditCard className="h-4 w-4" />
          </div>
          <h2 className="text-[15px] font-bold">Billing</h2>
        </div>
        <p className="mb-4 text-[13px] text-muted-foreground">Manage your subscription.</p>
        <SettingsBilling
          status={business.subscription_status as SubscriptionStatus}
          daysLeftInTrial={subscriptionGate.daysLeftInTrial}
          hasStripeCustomer={Boolean(business.stripe_customer_id)}
        />
      </SettleCard>

      {/* Master Execution Plan 1.5 — only shown once a real inbox is
       * actually monitored (SUPPORT_EMAIL set). Never claim a support
       * channel exists before someone's genuinely watching it — that
       * would be the opposite of "the owner should always feel
       * supported," a claim with no backing. */}
      {supportEmail && (
        <SettleCard delay={0.21} className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-1 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LifeBuoy className="h-4 w-4" />
            </div>
            <h2 className="text-[15px] font-bold">Get help</h2>
          </div>
          <p className="mb-3 text-[13px] text-muted-foreground">
            Something wrong, or just unsure about anything — reach out directly. We reply within one business day, usually sooner.
          </p>
          <a
            href={`mailto:${supportEmail}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-[13.5px] font-semibold text-primary hover:bg-muted"
          >
            {supportEmail}
          </a>
        </SettleCard>
      )}

      <SettleCard delay={0.25}>
        <SettingsDangerZone businessName={business.business_name} />
      </SettleCard>
    </div>
  );
}
