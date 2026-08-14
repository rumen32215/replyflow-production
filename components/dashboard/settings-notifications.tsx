"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Owner Attention Architecture (`DOCS/CONSTITUTION/14-...md`) V1 — "New
 * enquiry alerts" is real: `businesses.notify_new_enquiry` is what
 * `app/api/cron/attention/route.ts` actually checks before emailing an
 * owner. The parent page (settings/page.tsx) only renders this
 * component at all once a real channel exists (RESEND_API_KEY +
 * ATTENTION_FROM_EMAIL configured) — product cleanup pass (2026-08-14):
 * this used to render a permanently-disabled "Coming soon" toggle
 * otherwise, which is the exact false promise this architecture doc
 * warns against; hiding the whole section is the honest version.
 *
 * "Daily summary" was removed entirely in the same pass — the Digest
 * tier (doc 14 §3) has no backend at all yet (no cron, no consumer of
 * businesses.notify_daily_summary), so there was nothing behind it to
 * even gate on. It can come back once the Digest tier is real.
 */
export function SettingsNotifications({
  businessId,
  initialNotifyNewEnquiry,
}: {
  businessId: string;
  initialNotifyNewEnquiry: boolean;
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
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[13.5px] font-semibold">New enquiry alerts</p>
        <p className="text-xs text-muted-foreground">
          An email when a reply needs your OK, or your connection needs attention — never more than a few an hour.
        </p>
      </div>
      <Switch checked={checked} disabled={saving} onCheckedChange={onToggle} />
    </div>
  );
}
