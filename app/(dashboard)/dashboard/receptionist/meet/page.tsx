import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseKnowledge } from "@/lib/knowledge";
import { buildHandoverRecap } from "@/lib/receptionist-handover";
import { MeetYourReceptionist } from "@/components/dashboard/receptionist/meet-your-receptionist";

export const metadata: Metadata = { title: "Meet Your Receptionist — ReplyFlow" };

/**
 * Handover (Trust Track A1, DOCS/CONSTITUTION/03 §2 and
 * DOCS/SPECS/Trust-Track-Implementation-Plan.md). Real business data,
 * real receptionist configuration, zero mock content — the recap is
 * built by the deterministic `buildHandoverRecap`, never an LLM call,
 * so nothing here can invent a fact about the business.
 */
export default async function MeetYourReceptionistPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select(
      "id, business_name, trade, services, service_areas, opening_time, closing_time, offers_emergency_callouts, charges_callout_fee, callout_fee_amount, receptionist_name, business_knowledge"
    )
    .eq("owner_id", user.id)
    .maybeSingle();
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);
  if (!business) redirect("/welcome");

  const { data: config } = await supabase
    .from("ai_configurations")
    .select("business_rules, escalation_rules, faqs")
    .eq("business_id", business.id)
    .maybeSingle();

  const recap = buildHandoverRecap({
    businessName: business.business_name,
    trade: business.trade,
    receptionistName: business.receptionist_name,
    services: business.services ?? [],
    serviceAreas: business.service_areas ?? [],
    openingTime: business.opening_time,
    closingTime: business.closing_time,
    offersEmergencyCallouts: business.offers_emergency_callouts,
    chargesCalloutFee: business.charges_callout_fee,
    calloutFeeAmount: business.callout_fee_amount,
    businessRules: config?.business_rules ?? "",
    escalationRules: config?.escalation_rules ?? "",
    faqCount: Array.isArray(config?.faqs) ? config.faqs.length : 0,
    knowledge: parseKnowledge(business.business_knowledge),
  });

  return (
    <MeetYourReceptionist
      businessName={business.business_name}
      receptionistName={business.receptionist_name}
      recap={recap}
      correctBackHref="/dashboard/receptionist"
    />
  );
}
