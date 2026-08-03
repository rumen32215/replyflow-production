"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Owner Attention Architecture (`DOCS/CONSTITUTION/14-...md`) V1 — "New
 * enquiry alerts" is now real: `businesses.notify_new_enquiry` (already
 * existed, unused, since migration 0004) is what
 * `app/api/cron/attention/route.ts` actually checks before emailing an
 * owner. Only rendered as a live toggle once a real channel exists
 * (`emailDeliveryConfigured`, computed server-side from
 * RESEND_API_KEY/ATTENTION_FROM_EMAIL) — otherwise this page would be
 * making the exact false promise the Release Polish pass originally
 * wrote this toggle's "Coming soon" label to avoid.
 *
 * "Daily summary" stays "Coming soon" — the Digest tier (doc 14 §3) is
 * deliberately deferred past this V1, so toggling it today still
 * wouldn't change anything real.
 */
export function SettingsNotifications({
  businessId,
  initialNotifyNewEnquiry,
  emailDeliveryConfigured,
}: {
  businessId: string;
  initialNotifyNewEnquiry: boolean;
  emailDeliveryConfigured: boolean;
}) {
  const supabase = createClient();
  const [checked, setChecked] = useState(initialNotifyNewEnquiry);
  const [saving, setSaving] = useState(false);

  async function onToggle(next: boolean) {
    setChecked(next);
    setSaving(true);
    const { error } = await supabase.from("businesses").update({ notify_new_enquiry: next }).eq("id", businessId);
    setSaving(false);

    if (error) {
      setChecked(!next); // the write didn't take — never leave the switch showing a state that isn't actually saved
      toast({ variant: "destructive", title: "Couldn't save that", description: "Please try again." });
      return;
    }
    toast({
      variant: "success",
      title: next ? "Email alerts turned on" : "Email alerts turned off",
      description: next ? "I'll email you when a reply's waiting for your OK." : undefined,
    });
  }

  return (
    <div className="divide-y divide-border">
      <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[13.5px] font-semibold">New enquiry alerts</p>
            {!emailDeliveryConfigured && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">
                Coming soon
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {emailDeliveryConfigured
              ? "An email when a reply needs your OK, or your connection needs attention — never more than a few an hour."
              : "Being notified outside ReplyFlow the moment a customer messages you — not built yet."}
          </p>
        </div>
        <Switch
          checked={emailDeliveryConfigured ? checked : false}
          disabled={!emailDeliveryConfigured || saving}
          onCheckedChange={onToggle}
        />
      </div>
      <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[13.5px] font-semibold">Daily summary</p>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">
              Coming soon
            </span>
          </div>
          <p className="text-xs text-muted-foreground">A morning recap of yesterday&apos;s enquiries — not built yet.</p>
        </div>
        <Switch checked={false} disabled />
      </div>
    </div>
  );
}
