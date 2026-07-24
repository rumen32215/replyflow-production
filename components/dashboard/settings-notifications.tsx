"use client";

import { Switch } from "@/components/ui/switch";

/**
 * Release polish (ReplyFlow v1 Polish Pass): these two switches used to
 * save a real preference to notify_new_enquiry/notify_daily_summary,
 * but nothing anywhere in the product ever reads either column to
 * actually send an email, SMS, or push notification — no delivery
 * channel exists yet at all. A toggle that looks live but silently does
 * nothing is a false promise (Principle 1: "trust is demonstrated,
 * never asserted"; Principle 5: a vague or misleading status is a
 * failure regardless of how the underlying data looks). Building real
 * delivery is a new feature, out of scope for polish — the honest fix
 * is disclosing plainly that this isn't live yet, not pretending it
 * works.
 */
export function SettingsNotifications() {
  return (
    <div className="divide-y divide-border">
      <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[13.5px] font-semibold">New enquiry alerts</p>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">
              Coming soon
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Being notified outside ReplyFlow the moment a customer messages you — not built yet.
          </p>
        </div>
        <Switch checked={false} disabled />
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
