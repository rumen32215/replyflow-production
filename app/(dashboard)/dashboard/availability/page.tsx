import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityDiary } from "@/components/dashboard/availability/availability-diary";
import { parseAvailability } from "@/lib/availability";

export const metadata: Metadata = { title: "Availability — ReplyFlow" };

/**
 * The receptionist's diary (Availability V1). The owner isn't managing
 * a calendar — they're telling their receptionist "these are the times
 * I'm available." parseAvailability merges whatever is stored (possibly
 * {}) over sensible defaults, so the diary always renders complete and
 * pre-migration businesses keep their original opening/closing times.
 */
export default async function AvailabilityPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, availability, opening_time, closing_time")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/welcome");

  return (
    <AvailabilityDiary
      businessId={business.id}
      initial={parseAvailability(business.availability, business.opening_time, business.closing_time)}
    />
  );
}
