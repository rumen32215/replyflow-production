import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BusinessMemory, type Faq } from "@/components/dashboard/business/business-memory";
import { parseKnowledge } from "@/lib/knowledge";

export const metadata: Metadata = { title: "Business — ReplyFlow" };

/**
 * Business memory — the living profile (Business Experience V2). The
 * structured columns businesses already has (name, description,
 * services, service_areas, call-out fee, emergency) stay the source of
 * truth for what they cover; business_knowledge holds the sections
 * that grow forever; FAQs stay in ai_configurations.faqs where the
 * conversation engine already reads them.
 */
const VALID_TOPICS = new Set([
  "identity",
  "services",
  "declined",
  "areas",
  "special",
  "payments",
  "guarantees",
  "emergency",
  "faqs",
  "access",
]);

export default async function BusinessPage({ searchParams }: { searchParams: { topic?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id, business_name, trade, phone, business_description, services, service_areas, offers_emergency_callouts, charges_callout_fee, callout_fee_amount, business_knowledge"
    )
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/welcome");

  const { data: config } = await supabase
    .from("ai_configurations")
    .select("faqs")
    .eq("business_id", business.id)
    .maybeSingle();

  const faqs: Faq[] = Array.isArray(config?.faqs)
    ? (config!.faqs as unknown[])
        .filter(
          (f): f is Faq =>
            typeof f === "object" &&
            f !== null &&
            typeof (f as Faq).question === "string" &&
            typeof (f as Faq).answer === "string"
        )
        .map((f) => ({ question: f.question, answer: f.answer }))
    : [];

  const initialTopic = VALID_TOPICS.has(searchParams.topic ?? "") ? (searchParams.topic as string) : null;

  return (
    <BusinessMemory
      businessId={business.id}
      trade={business.trade}
      initialTopic={initialTopic}
      initial={{
        businessName: business.business_name ?? "",
        phone: business.phone ?? "",
        description: business.business_description ?? "",
        services: business.services ?? [],
        serviceAreas: business.service_areas ?? [],
        offersEmergency: business.offers_emergency_callouts ?? true,
        chargesCalloutFee: business.charges_callout_fee ?? false,
        calloutFeeAmount: business.callout_fee_amount ?? "",
        knowledge: parseKnowledge(business.business_knowledge),
        faqs,
      }}
    />
  );
}
