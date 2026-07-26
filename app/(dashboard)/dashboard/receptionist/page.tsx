import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReceptionistPlayground } from "@/components/dashboard/receptionist/receptionist-playground";
import type { Tone } from "@/lib/receptionist";

export const metadata: Metadata = { title: "Receptionist — ReplyFlow" };

/**
 * The heart of ReplyFlow — the teaching playground (Receptionist
 * Experience V2). Reached from Front Desk's Setup Journey checklist
 * or primary nav, not as onboarding's landing page (ReplyFlow v1
 * Product Blueprint — onboarding now hands over to Front Desk).
 */
const VALID_TOPICS = new Set(["behaviours", "rules", "escalation"]);

export default async function ReceptionistPage({
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
    .select("id, business_name, trade, offers_emergency_callouts, greeting_style, receptionist_name")
    .eq("owner_id", user.id)
    .maybeSingle();
  // A real query error (e.g. a stale PostgREST schema cache right
  // after a migration) is not "onboarding incomplete" — redirecting
  // to /welcome would silently bounce an existing owner in a loop
  // back to Front Desk. Surface it instead of guessing.
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);
  if (!business) redirect("/welcome");

  const { data: config } = await supabase
    .from("ai_configurations")
    .select("tone, tone_notes, system_prompt, business_rules, escalation_rules, auto_reply_general_enabled")
    .eq("business_id", business.id)
    .maybeSingle();

  const tone = (config?.tone ?? business.greeting_style ?? "friendly") as Tone;

  // Product Guarantee 1: no fallback coercion below — null means
  // genuinely unconfirmed and must stay that way, never silently
  // become a claimed fact.
  return (
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
      initialTopic={VALID_TOPICS.has(searchParams.topic ?? "") ? (searchParams.topic as string) : null}
    />
  );
}
