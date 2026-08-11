import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { parseKnowledge } from "@/lib/knowledge";
import { parseAvailability, describeBookingReply, nextAvailableSlot } from "@/lib/availability";
import { buildRelationshipSummary, relationshipStrengthFor, type CustomerJob } from "@/lib/customer-memory-signals";
import type { ContextNeeds } from "../understanding/types";
import type { PhotoAnalysisContext, ReplyContext } from "./types";

type ServiceClient = ReturnType<typeof createServiceClient>;

const CONVERSATION_HISTORY_WINDOW = 12;

export interface AssembleContextInput {
  supabase: ServiceClient;
  businessId: string;
  conversationId: string;
  /** ReplyFlow V4 (Conversation Episodes) — scopes the message thread
   * and "current job" facts below to this job alone. Deliberately NOT
   * used for jobRowsPromise — the customer's full job history is
   * still real, still relevant lifetime context, just a separate
   * concern from what's currently active (Contract §G). */
  episodeId: string;
  customerPhone: string;
  customerName: string | null;
  conversationStartedAt: string;
  needs: ContextNeeds;
  messageBody: string;
  /** Phase B — set only when this message's photo was already
   * downloaded and analysed (lib/reply-engine/media-intake.ts) before
   * assembleContext was called. */
  photoAnalysis?: PhotoAnalysisContext | null;
}

/**
 * Context Assembly (Sprint 9 §4-§5, refined by Sprint 9.1 §7) — pure
 * data-fetching, gated entirely by `needs`. A category not requested by
 * the Understanding Engine is simply never queried, not fetched-then-
 * discarded — "Only retrieve the information actually required for the
 * detected intent" (Sprint 10A).
 */
export async function assembleContext(input: AssembleContextInput): Promise<ReplyContext> {
  const { supabase, businessId, conversationId, episodeId, customerPhone, customerName, conversationStartedAt, needs } = input;

  const displayName = customerName || customerPhone;

  // customerMemory and customerJobs both derive from the same real
  // `work_cards` rows — fetched once and shared, never queried twice.
  const needsJobRows = needs.customerMemory || needs.customerJobs;
  const jobRowsPromise = needsJobRows
    ? supabase
        .from("work_cards")
        .select("id, issue, status, scheduled_for, completed_at, notes, created_at, estimated_value")
        .eq("business_id", businessId)
        .eq("customer_name", displayName)
        .order("created_at", { ascending: true })
    : Promise.resolve({ data: null });

  const businessRowPromise = needs.businessProfile || needs.diary
    ? supabase
        .from("businesses")
        .select(
          "business_name, trade, business_description, services, service_areas, opening_time, closing_time, offers_emergency_callouts, charges_callout_fee, callout_fee_amount, receptionist_name, business_knowledge, availability"
        )
        .eq("id", businessId)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const aiConfigPromise = needs.receptionistRules
    ? supabase
        .from("ai_configurations")
        .select("tone, system_prompt, business_rules, escalation_rules, faqs")
        .eq("business_id", businessId)
        .maybeSingle()
    : Promise.resolve({ data: null });

  // ReplyFlow V4 — scoped to this episode, not the customer's lifetime
  // thread: the reply-generation prompt should reason about the
  // current job's own conversation, never a mix of every job this
  // customer has ever brought (Contract §G).
  const historyPromise = needs.conversationHistory
    ? supabase
        .from("messages")
        .select("direction, body, created_at")
        .eq("episode_id", episodeId)
        .order("created_at", { ascending: false })
        .limit(CONVERSATION_HISTORY_WINDOW)
    : Promise.resolve({ data: null });

  // Always fetched, regardless of needs — see CurrentBookingContext.
  // Scoped to this episode (ReplyFlow V4) — an older, unrelated job's
  // Work Card must never be reported as "the current booking" for a
  // brand new episode that hasn't created its own yet.
  const currentJobPromise = supabase
    .from("work_cards")
    .select("issue, status, scheduled_for")
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: jobRows }, { data: businessRow }, { data: aiConfig }, { data: historyRows }, { data: currentJobRow }] =
    await Promise.all([jobRowsPromise, businessRowPromise, aiConfigPromise, historyPromise, currentJobPromise]);

  const jobs: CustomerJob[] = (jobRows ?? []).map((j) => ({
    id: j.id,
    jobTitle: j.issue,
    status: j.status,
    scheduledFor: j.scheduled_for,
    completedAt: j.completed_at,
    notes: j.notes,
    createdAt: j.created_at,
    // Present on the shared type for the Customers page (2.3); facts.ts
    // deliberately never reads this field into the prompt — "price is
    // never her territory" (Work-Card-Object.md §3).
    estimatedValue: j.estimated_value,
  }));

  const context: ReplyContext = {
    businessProfile: null,
    receptionist: null,
    diary: null,
    customerMemory: null,
    conversationHistory: null,
    customerJobs: null,
    currentBooking: currentJobRow
      ? { jobTitle: currentJobRow.issue, status: currentJobRow.status, scheduledFor: currentJobRow.scheduled_for }
      : null,
    photoAnalysis: input.photoAnalysis ?? null,
    newMessage: { body: input.messageBody, customerName, customerPhone },
  };

  if (needs.businessProfile && businessRow) {
    context.businessProfile = {
      businessName: businessRow.business_name,
      trade: businessRow.trade,
      description: businessRow.business_description,
      services: businessRow.services ?? [],
      serviceAreas: businessRow.service_areas ?? [],
      openingTime: businessRow.opening_time,
      closingTime: businessRow.closing_time,
      offersEmergencyCallouts: businessRow.offers_emergency_callouts,
      chargesCalloutFee: businessRow.charges_callout_fee,
      calloutFeeAmount: businessRow.callout_fee_amount,
      receptionistName: businessRow.receptionist_name,
      knowledge: parseKnowledge(businessRow.business_knowledge),
    };
  }

  if (needs.receptionistRules && aiConfig) {
    context.receptionist = {
      tone: aiConfig.tone,
      behaviours: aiConfig.system_prompt,
      businessRules: aiConfig.business_rules,
      escalationRules: aiConfig.escalation_rules,
      faqs: Array.isArray(aiConfig.faqs) ? aiConfig.faqs : [],
    };
  }

  if (needs.diary && businessRow) {
    const availability = parseAvailability(businessRow.availability, businessRow.opening_time, businessRow.closing_time);
    const now = new Date();
    context.diary = {
      availability,
      todaysAvailabilityReply: describeBookingReply(availability, now),
      nextAvailable: nextAvailableSlot(availability, now),
    };
  }

  if (needs.customerMemory) {
    const completedJobs = jobs.filter((j) => j.status === "completed");
    const mostRecentJob = completedJobs.length > 0 ? completedJobs[completedJobs.length - 1]! : null;
    context.customerMemory = {
      name: displayName,
      relationshipStrength: relationshipStrengthFor(completedJobs.length),
      summary: buildRelationshipSummary({
        name: displayName,
        conversationStartedAt,
        completedJobCount: completedJobs.length,
        mostRecentJob,
        waitingMinutes: null,
      }),
      completedJobCount: completedJobs.length,
    };
  }

  if (needs.conversationHistory) {
    const rows = (historyRows ?? []).slice().reverse();
    context.conversationHistory = {
      messages: rows.map((m) => ({ direction: m.direction as "inbound" | "outbound", body: m.body ?? "", createdAt: m.created_at })),
    };
  }

  if (needs.customerJobs) {
    context.customerJobs = {
      jobs: jobs.map((j) => ({
        jobTitle: j.jobTitle,
        status: j.status,
        scheduledFor: j.scheduledFor,
        completedAt: j.completedAt,
      })),
    };
  }

  return context;
}
