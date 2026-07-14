import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BusinessProfileForm } from "@/components/dashboard/business-profile-form";
import type { OnboardingData } from "@/lib/validations/onboarding";

export const metadata: Metadata = { title: "Business Profile — ReplyFlow" };

export default async function BusinessProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id, business_name, phone, trade, opening_time, closing_time, offers_emergency_callouts, service_areas, greeting_style, business_description, services, charges_callout_fee, callout_fee_amount"
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business) {
  redirect("/welcome");
}

  const defaultValues: OnboardingData = {
    businessName: business.business_name,
    phone: business.phone,
    trade: "plumbing",
    openingTime: business.opening_time,
    closingTime: business.closing_time,
    offersEmergencyCallouts: business.offers_emergency_callouts,
    serviceAreas: business.service_areas ?? [],
    logoUrl: "",
    greetingStyle: business.greeting_style,
    businessDescription: business.business_description ?? "",
    services: business.services ?? [],
    chargesCalloutFee: business.charges_callout_fee,
    calloutFeeAmount: business.callout_fee_amount ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-[26px] font-extrabold tracking-tight">Business Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything ReplyFlow knows about your business — edit anytime, changes save immediately.
        </p>
      </div>

      <BusinessProfileForm businessId={business.id} defaultValues={defaultValues} />
    </div>
  );
}
