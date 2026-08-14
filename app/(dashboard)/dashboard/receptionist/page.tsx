import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReceptionistPlayground } from "@/components/dashboard/receptionist/receptionist-playground";
import { LearningProposalCard } from "@/components/dashboard/receptionist/learning-proposal-card";
import { BusinessMemory, type Faq } from "@/components/dashboard/business/business-memory";
import { parseKnowledge } from "@/lib/knowledge";
import type { Tone } from "@/lib/receptionist";
import {
  computeOwnerTrust,
  groupDecisionCategory,
  OWNER_TRUST_CATEGORIES,
  type OwnerTrustCategoryInput,
} from "@/lib/brain/trust";

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
  // to /onboarding/preparing would silently bounce an existing owner
  // in a loop. Surface it instead of guessing.
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);
  if (!business) redirect("/onboarding/preparing");

  const { data: config } = await supabase
    .from("ai_configurations")
    .select("tone, tone_notes, system_prompt, business_rules, escalation_rules, auto_reply_general_enabled, faqs")
    .eq("business_id", business.id)
    .maybeSingle();

  const tone = (config?.tone ?? business.greeting_style ?? "friendly") as Tone;

  // Owner Trust (Trust Ladder V1, DOCS/CONSTITUTION/11-ReplyFlow-Trust-Architecture.md)
  // — real, confirmed outcomes only. `draft.approved`/`draft.edited`
  // are only ever recorded on the owner's own approve/edit route
  // (app/api/reply-drafts/[id]/route.ts), never from auto-send, so an
  // auto-sent draft correctly never contributes here — this reports
  // what the owner did, not what the system handled on its own.
  const { data: recentDraftEvents } = await supabase
    .from("product_events")
    .select("event_type, context")
    .eq("business_id", business.id)
    .in("event_type", ["draft.approved", "draft.edited", "draft.rejected"])
    .order("created_at", { ascending: false })
    .limit(500);

  const draftOutcomeById = new Map<string, { approved: boolean; edited: boolean; rejected: boolean }>();
  for (const event of recentDraftEvents ?? []) {
    const draftId = (event.context as { draftId?: unknown } | null)?.draftId;
    if (typeof draftId !== "string") continue;
    const existing = draftOutcomeById.get(draftId) ?? { approved: false, edited: false, rejected: false };
    if (event.event_type === "draft.approved") existing.approved = true;
    if (event.event_type === "draft.edited") existing.edited = true;
    if (event.event_type === "draft.rejected") existing.rejected = true;
    draftOutcomeById.set(draftId, existing);
  }
  const resolvedDraftIds = Array.from(draftOutcomeById.entries())
    .filter(([, o]) => o.approved || o.rejected)
    .map(([id]) => id);

  const { data: resolvedDraftCategories } = resolvedDraftIds.length
    ? await supabase.from("reply_drafts").select("id, category").in("id", resolvedDraftIds)
    : { data: [] as { id: string; category: string }[] };

  const countsByGroup = new Map<string, { unchangedCount: number; editedCount: number; rejectedCount: number }>();
  for (const draft of resolvedDraftCategories ?? []) {
    const outcome = draftOutcomeById.get(draft.id);
    if (!outcome) continue;
    const group = groupDecisionCategory(draft.category);
    const counts = countsByGroup.get(group) ?? { unchangedCount: 0, editedCount: 0, rejectedCount: 0 };
    if (outcome.rejected) counts.rejectedCount += 1;
    else if (outcome.edited) counts.editedCount += 1;
    else counts.unchangedCount += 1;
    countsByGroup.set(group, counts);
  }

  const ownerTrustInputs: OwnerTrustCategoryInput[] = OWNER_TRUST_CATEGORIES.map(({ id, label }) => ({
    category: id,
    label,
    ...(countsByGroup.get(id) ?? { unchangedCount: 0, editedCount: 0, rejectedCount: 0 }),
  }));
  const ownerTrust = computeOwnerTrust(ownerTrustInputs);

  // Learning Memory V1 (doc 12) — the single top pending/deferred
  // proposal, oldest first (fairness — a proposal an owner already
  // deferred once shouldn't get bumped by a newer one). Never more than
  // one shown at a time, same "one thing at a time" discipline as
  // every other Observation on this page.
  const { data: learningProposal } = await supabase
    .from("learning_proposals")
    .select("id, proposed_lesson")
    .eq("business_id", business.id)
    .in("status", ["pending", "deferred"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

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
      {learningProposal && (
        <LearningProposalCard proposal={{ id: learningProposal.id, proposedLesson: learningProposal.proposed_lesson }} />
      )}
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
        ownerTrust={ownerTrust}
      />
      {/* Product cleanup pass (2026-08-14) — booking rules (notice
       * period, job limits, weekend emergencies, weekly hours) live on
       * the Hours page, not here; that split was invisible before this
       * link existed, and an owner reasonably expects "how I want my
       * business to operate" to be reachable from Receptionist. Kept as
       * a pointer rather than moved, so the working save logic on Hours
       * stays exactly as-is. */}
      <Link
        href="/dashboard/availability"
        className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/25 hover:bg-accent/40"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
          <CalendarClock className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-foreground">Booking rules &amp; hours</span>
          <span className="block text-[12px] text-muted-foreground">
            Notice period, job limits, weekend emergencies, and your weekly hours — over on Hours.
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
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
