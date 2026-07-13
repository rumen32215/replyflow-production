"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

export function SettingsNotifications({
  businessId,
  initialNewEnquiry,
  initialDailySummary,
}: {
  businessId: string;
  initialNewEnquiry: boolean;
  initialDailySummary: boolean;
}) {
  const supabase = createClient();
  const [newEnquiry, setNewEnquiry] = useState(initialNewEnquiry);
  const [dailySummary, setDailySummary] = useState(initialDailySummary);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function update(column: "notify_new_enquiry" | "notify_daily_summary", value: boolean) {
    setSavingKey(column);
    const { error } = await supabase.from("businesses").update({ [column]: value }).eq("id", businessId);
    setSavingKey(null);

    if (error) {
      toast({ variant: "destructive", title: "Couldn't save preference", description: error.message });
      // revert on failure
      if (column === "notify_new_enquiry") setNewEnquiry(!value);
      else setDailySummary(!value);
    }
  }

  return (
    <div className="divide-y divide-border">
      <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
        <div>
          <p className="text-[13.5px] font-semibold">New enquiry alerts</p>
          <p className="text-xs text-muted-foreground">Get notified the moment a customer messages you.</p>
        </div>
        <Switch
          checked={newEnquiry}
          disabled={savingKey === "notify_new_enquiry"}
          onCheckedChange={(v) => {
            setNewEnquiry(v);
            update("notify_new_enquiry", v);
          }}
        />
      </div>
      <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
        <div>
          <p className="text-[13.5px] font-semibold">Daily summary</p>
          <p className="text-xs text-muted-foreground">A morning recap of yesterday&apos;s enquiries.</p>
        </div>
        <Switch
          checked={dailySummary}
          disabled={savingKey === "notify_daily_summary"}
          onCheckedChange={(v) => {
            setDailySummary(v);
            update("notify_daily_summary", v);
          }}
        />
      </div>
    </div>
  );
}
