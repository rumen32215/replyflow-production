import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { parseKnowledge } from "@/lib/knowledge";
import { parseAvailability, describeBookingReply, nextAvailableSlot } from "@/lib/availability";
import { buildRelationshipSummary, relationshipStrengthFor, type CustomerJob } from "@/lib/customer-memory-signals";
import type { ContextNeeds } from "../understanding/types";
import type { ReplyContext } from "./types";

type ServiceClient = ReturnType<typeof createServiceClient>;

const CONVERSATION_HISTORY_WINDOW = 12;

export interface AssembleContextInput {
  supabase: ServiceClient;
  businessId: string;
  conversationId: string;
  customerPhone: string;
  customerName: string | null;
  conversationStartedAt: string;
  needs: ContextNeeds;
  messageBody: string;
}

/**
 * Context Assembly (Sprint 9 §4-§5, refined by Sprint 9.1 §7) — pure
 * data-fetching, gated entirely by `needs`. A category not requested by
 * the Understanding Engine is simply never queried, not fetched-then-
 * discarded — "Only retrieve the information actually required for the
 * detected intent" (Sprint 10A).
 */
export async function assembleContext(input: AssembleContextInput): Promise<ReplyContext> {
  const { supabase, businessId, conversationId, customerPhone, customerName, conversationStartedAt, needs } = input;

  const displayName = customerName || customerPhone;

  // customerMemory and customerJobs both derive from the same real
  // `jobs` rows — fetched once and shared, never queried twice.
  const needsJobRows = needs.customerMemory || needs.customerJobs;
  const jobRowsPromise = needsJobRows
    ? supabase
        .from("jobs")
        .select("id, job_title, status, scheduled_for, completed_at, notes, created_at")
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

  const historyPromise = needs.conversationHistory
    ? supabase
        .from("messages")
        .select("direction, body, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(CONVERSATION_HISTORY_WINDOW)
    : Promise.resolve({ data: null });

  const [{ data: jobRows }, { data: businessRow }, { data: aiConfig }, { data: historyRows }] = await Promise.all([
    jobRowsPromise,
    businessRowPromise,
    aiConfigPromise,
    historyPromise,
  ]);

  const jobs: CustomerJob[] = (jobRows ?? []).map((j) => ({
    id: j.id,
    jobTitle: j.job_title,
    status: j.status,
    scheduledFor: j.scheduled_for,
    completedAt: j.completed_at,
    notes: j.notes,
    createdAt: j.created_at,
  }));

  const context: ReplyContext = {
    businessProfile: null,
    receptionist: null,
    diary: null,
    customerMemory: null,
    conversationHistory: null,
    customerJobs: null,
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
