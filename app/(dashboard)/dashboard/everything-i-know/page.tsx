import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettleCard } from "@/components/shared/motion";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import { KnownTopics } from "@/components/dashboard/everything-i-know/known-topics";
import { LearningTopics } from "@/components/dashboard/everything-i-know/learning-topics";
import { RecentChanges } from "@/components/dashboard/everything-i-know/recent-changes";
import { CustomerSnapshot } from "@/components/dashboard/everything-i-know/customer-snapshot";
import { formatRecentChange } from "@/lib/everything-i-know-signals";
import { parseAvailability } from "@/lib/availability";
import { parseKnowledge } from "@/lib/knowledge";
import { getBrainContext } from "@/lib/brain";

export const metadata: Metadata = { title: "Everything I Know — ReplyFlow" };

/**
 * Everything I Know (Sprint 8 / Feature 11) — the transparency layer
 * for the Shared Brain. Reached the same way Mission Control and
 * Customers are (a topbar icon, not a sixth primary destination — see
 * Dashboard Map's "four primary destinations" decision). Every section
 * reads real Shared Brain / real row data; nothing here is invented,
 * no sentiment or intent detection, no LLM — see the Sprint 8 planning
 * report for why Feature 11 was scoped this way while Features 10/13
 * (which assume real NLP) were not attempted.
 */
export default async function EverythingIKnowPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select(
      "id, business_description, services, service_areas, business_knowledge, availability, opening_time, closing_time, created_at, updated_at"
    )
    .eq("owner_id", user.id)
    .maybeSingle();
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);
  if (!business) redirect("/welcome");

  const businessId = business.id;

  const [{ data: config }, { data: conversations }, { data: jobs }] = await Promise.all([
    supabase
      .from("ai_configurations")
      .select("system_prompt, business_rules, escalation_rules, faqs, created_at, updated_at")
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase.from("conversations").select("id").eq("business_id", businessId),
    supabase.from("work_cards").select("conversation_id, status").eq("business_id", businessId),
  ]);

  const availability = parseAvailability(business.availability, business.opening_time, business.closing_time);

  const brain = getBrainContext({
    businessId,
    knowledge: {
      businessDescription: business.business_description,
      services: business.services ?? [],
      serviceAreas: business.service_areas ?? [],
      knowledge: parseKnowledge(business.business_knowledge),
      faqCount: Array.isArray(config?.faqs) ? (config.faqs as unknown[]).length : 0,
    },
    receptionist: {
      behavioursTaught: Boolean(config?.system_prompt?.trim()),
      rulesTaught: Boolean(config?.business_rules?.trim()),
      escalationTaught: Boolean(config?.escalation_rules?.trim()),
    },
    diary: { rules: availability.rules },
  });

  const knownTopics = brain.topics.filter((t) => t.done);
  const percentByDomain = {
    knowledge: brain.percentFor("knowledge"),
    receptionist: brain.percentFor("receptionist"),
    diary: brain.percentFor("diary"),
  };

  const completedConversationIds = new Set(
    (jobs ?? []).filter((j) => j.status === "completed" && j.conversation_id).map((j) => j.conversation_id as string)
  );
  const totalCustomers = conversations?.length ?? 0;
  const returningCustomers = completedConversationIds.size;

  const recentChanges = [
    business.updated_at && business.created_at
      ? formatRecentChange("Business & diary details", business.updated_at, business.created_at)
      : null,
    config?.updated_at && config?.created_at
      ? formatRecentChange("Receptionist teaching", config.updated_at, config.created_at)
      : null,
  ].filter((c): c is string => c !== null);

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <SettleCard className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-[24px] font-extrabold tracking-tight">Everything I know</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          A transparent look at what I currently understand about your business — and what I&apos;m still learning.
        </p>
        <div className="mt-5">
          <ConfidenceBar title="Overall understanding" percent={brain.percent} />
        </div>
        <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">
          Everything below comes directly from what you&apos;ve taught me. Nothing here is guessed.
        </p>
      </SettleCard>

      <KnownTopics topics={knownTopics} />
      <LearningTopics gaps={brain.gaps} percentByDomain={percentByDomain} />
      <RecentChanges changes={recentChanges} />
      <CustomerSnapshot totalCustomers={totalCustomers} returningCustomers={returningCustomers} />
    </div>
  );
}
