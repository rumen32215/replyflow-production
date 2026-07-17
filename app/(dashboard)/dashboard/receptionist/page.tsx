import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReceptionistPlayground } from "@/components/dashboard/receptionist/receptionist-playground";
import type { Tone } from "@/lib/receptionist";

export const metadata: Metadata = { title: "Receptionist — ReplyFlow" };

/**
 * The heart of ReplyFlow — the teaching playground (Receptionist
 * Experience V2). Onboarding ends here (?welcome=1): the owner meets
 * their new employee the moment they've hired them.
 */
export default async function ReceptionistPage({
  searchParams,
}: {
  searchParams: { welcome?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, business_name, offers_emergency_callouts, charges_callout_fee, callout_fee_amount, greeting_style")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/welcome");

  const { data: config } = await supabase
    .from("ai_configurations")
    .select("tone, system_prompt, business_rules, escalation_rules")
    .eq("business_id", business.id)
    .maybeSingle();

  const tone = (config?.tone ?? business.greeting_style ?? "friendly") as Tone;

  return (
    <ReceptionistPlayground
      businessId={business.id}
      businessName={business.business_name}
      offersEmergency={business.offers_emergency_callouts ?? true}
      chargesCalloutFee={business.charges_callout_fee ?? false}
      calloutFeeAmount={business.callout_fee_amount}
      initial={{
        tone,
        systemPrompt: config?.system_prompt ?? "",
        businessRules: config?.business_rules ?? "",
        escalationRules: config?.escalation_rules ?? "",
      }}
      justHired={searchParams.welcome === "1"}
    />
  );
}
