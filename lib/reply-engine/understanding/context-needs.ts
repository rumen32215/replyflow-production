import type { ContextCategory, ContextNeeds, Intent, UnderstandingResult } from "./types";

/**
 * The deterministic intent × context-category lookup table (Sprint 9.1
 * §3) — a plain data structure an engineer can read and know exactly
 * why a category was fetched for a given message, not another AI
 * judgment call. Shared Brain / Everything I Know deliberately do NOT
 * appear as rows: `readyToActAlone` already gates whether an
 * autonomous attempt happens at all, before this table is consulted.
 */
const CONTEXT_NEEDS_TABLE: Record<Intent, ContextNeeds> = {
  BOOKING_REQUEST: {
    businessProfile: true,
    receptionistRules: true,
    diary: true,
    customerMemory: true,
    conversationHistory: true,
    customerJobs: false,
  },
  BOOKING_CHANGE: {
    businessProfile: true,
    receptionistRules: true,
    diary: true,
    customerMemory: true,
    conversationHistory: true,
    customerJobs: true,
  },
  BOOKING_CANCELLATION: {
    businessProfile: true,
    receptionistRules: true,
    diary: false,
    customerMemory: true,
    conversationHistory: true,
    customerJobs: true,
  },
  BUSINESS_INFORMATION: {
    businessProfile: true,
    receptionistRules: false,
    // Widened after production testing (Stability Sprint): "business
    // information" genuinely includes questions like "how much notice
    // do you need" / "are you open weekends" — real diary facts, not
    // just static profile fields. Without this, the model had no
    // grounded fact to answer with and gave a vague, hedging reply
    // instead of the specific answer it should have been able to give.
    diary: true,
    customerMemory: false,
    conversationHistory: true,
    customerJobs: false,
  },
  PRICING_INQUIRY: {
    businessProfile: true,
    receptionistRules: true,
    diary: false,
    customerMemory: false,
    conversationHistory: true,
    customerJobs: false,
  },
  RETURNING_PROBLEM: {
    businessProfile: true,
    receptionistRules: true,
    diary: false,
    customerMemory: true,
    conversationHistory: true,
    customerJobs: true,
  },
  EMERGENCY: {
    businessProfile: true,
    receptionistRules: true,
    diary: true,
    customerMemory: false,
    conversationHistory: true,
    customerJobs: false,
  },
  COMPLAINT: {
    businessProfile: true,
    receptionistRules: true,
    diary: false,
    customerMemory: true,
    conversationHistory: true,
    customerJobs: true,
  },
  STATUS_CHECK: {
    businessProfile: false,
    receptionistRules: false,
    diary: false,
    customerMemory: true,
    conversationHistory: true,
    customerJobs: true,
  },
  PAYMENT_QUERY: {
    businessProfile: true,
    receptionistRules: false,
    diary: false,
    customerMemory: false,
    conversationHistory: true,
    customerJobs: true,
  },
  SOCIAL: {
    businessProfile: false,
    receptionistRules: false,
    diary: false,
    customerMemory: false,
    conversationHistory: true,
    customerJobs: false,
  },
  // Low/unclassifiable falls back to fetching everything bounded
  // (Sprint 9.1 §4 and §1: "widening context, never narrowing it").
  UNCLEAR: {
    businessProfile: true,
    receptionistRules: true,
    diary: true,
    customerMemory: true,
    conversationHistory: true,
    customerJobs: true,
  },
};

const EMPTY_NEEDS: ContextNeeds = {
  businessProfile: false,
  receptionistRules: false,
  diary: false,
  customerMemory: false,
  conversationHistory: false,
  customerJobs: false,
};

/**
 * Combines the table rows for every intent this message carries
 * (primary plus secondaries) — combining only ever adds, never removes
 * (§3). Medium confidence widens to the union of the top candidates the
 * same way; low/unknown confidence already resolves to UNCLEAR's
 * fetch-everything row via the caller passing it as the only intent.
 */
export function resolveContextNeeds(understanding: UnderstandingResult): ContextNeeds {
  const intents = [understanding.primaryIntent, ...understanding.secondaryIntents];
  const needs: ContextNeeds = { ...EMPTY_NEEDS };

  for (const intent of intents) {
    const row = CONTEXT_NEEDS_TABLE[intent];
    for (const key of Object.keys(needs) as ContextCategory[]) {
      needs[key] = needs[key] || row[key];
    }
  }

  // Low/unknown understanding-confidence widens to the safe fallback
  // regardless of what was classified, per §4.
  if (understanding.confidence === "low" || understanding.confidence === "unknown") {
    for (const key of Object.keys(needs) as ContextCategory[]) {
      needs[key] = needs[key] || CONTEXT_NEEDS_TABLE.UNCLEAR[key];
    }
  }

  return needs;
}
