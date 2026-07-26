import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReceptionistPlayground } from "@/components/dashboard/receptionist/receptionist-playground";
import { BusinessMemory, type Faq } from "@/components/dashboard/business/business-memory";
import { parseKnowledge } from "@/lib/knowledge";
import type { Tone } from "@/lib/receptionist";

export const metadata: Metadata = { title: "Teach your receptionist — ReplyFlow" };

/**
 * "Teach your receptionist" — the merged Teach surface (V1 First-Run
 * redesign, DOCS/SPECS/ReplyFlow-V1-First-Run-Proposal.md). Business
 * Profile, Behaviour, and Everything I Know stop being three separate
 * destinations: from here, they're one page, one scroll, one nav item.
 * Internally, ReceptionistPlayground and BusinessMemory remain the two
 * components they always were — each with its own already-correct,
 * already-tested save logic and data-loss defence — composed together
 * here rather than reachable as separate routes. Whether they remain
 * separate internally is exactly the kind of implementation detail the
 * owner should never have to think about.
 *
 * ReceptionistPlayground renders first: its "Good afternoon" header and
 * live, real coaching phone are the one shared arrival moment for the
 * whole page, and the most exciting thing to see first, having just
 * met her moments ago in onboarding. Business Knowledge's sections
 * (services, areas, personality, payments, guarantees, FAQs) continue
 * the same teaching conversation directly below, no header of its own.
 */
const VALID_RECEPTIONIST_TOPICS = new Set(["behaviours", "rules", "escalation"]);
const VALID_BUSINESS_TOPICS = new Set([
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

export default async function TeachYourReceptionistPage({
  searchParams,
}: {
  searchParams: { topic?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select(
      "id, business_name, trade, phone, business_description, services, service_areas, offers_emergency_callouts, charges_callout_fee, callout_fee_amount, business_knowledge, logo_url, greeting_style, receptionist_name"
    )
    .eq("owner_id", user.id)
    .maybeSingle();
  // A real query error (e.g. a stale PostgREST schema cache right
  // after a migration) is not "onboarding incomplete" — redirecting
  // to /welcome would silently bounce an existing owner in a loop.
  // Surface it instead of guessing.
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);
  if (!business) redirect("/welcome");

  const { data: config } = await supabase
    .from("ai_configurations")
    .select("tone, tone_notes, system_prompt, business_rules, escalation_rules, auto_reply_general_enabled, faqs")
    .eq("business_id", business.id)
    .maybeSingle();

  const tone = (config?.tone ?? business.greeting_style ?? "friendly") as Tone;

  const faqs: Faq[] = Array.isArray(config?.faqs)
    ? (config!.faqs as unknown[])
        .filter(
          (f): f is Faq =>
            typeof f === "object" && f !== null && typeof (f as Faq).question === "string" && typeof (f as Faq).answer === "string"
        )
        .map((f) => ({ question: f.question, answer: f.answer }))
    : [];

  const topic = searchParams.topic ?? "";
  const receptionistTopic = VALID_RECEPTIONIST_TOPICS.has(topic) ? topic : null;
  const businessTopic = VALID_BUSINESS_TOPICS.has(topic) ? topic : null;

  return (
    <div className="space-y-8">
      <ReceptionistPlayground
        businessId={business.id}
        businessName={business.business_name}
        trade={business.trade}
        offersEmergency={business.offers_emergency_callouts}
        receptionistName={business.receptionist_name}
        initial={{
          tone,
          toneNotes: config?.tone_notes ?? "",
          systemPrompt: config?.system_prompt ?? "",
          businessRules: config?.business_rules ?? "",
          escalationRules: config?.escalation_rules ?? "",
          autoReplyGeneralEnabled: config?.auto_reply_general_enabled ?? false,
        }}
        initialTopic={receptionistTopic}
      />
      {/* Product Guarantee 1: no fallback coercion below — null means
       * genuinely unconfirmed and must stay that way, never silently
       * become a claimed fact. */}
      <BusinessMemory
        businessId={business.id}
        trade={business.trade}
        initialTopic={businessTopic}
        initial={{
          businessName: business.business_name ?? "",
          logoUrl: business.logo_url,
          phone: business.phone ?? "",
          description: business.business_description ?? "",
          services: business.services ?? [],
          serviceAreas: business.service_areas ?? [],
          offersEmergency: business.offers_emergency_callouts,
          chargesCalloutFee: business.charges_callout_fee,
          calloutFeeAmount: business.callout_fee_amount ?? "",
          knowledge: parseKnowledge(business.business_knowledge),
          faqs,
        }}
      />
    </div>
  );
}
