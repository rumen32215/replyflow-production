/**
 * Understanding Engine — public types (Sprint 9.1 architecture,
 * §1-§4). Sits between the Readiness Gate and Context Assembly: given
 * one raw inbound message, decides what the customer wants, what real
 * facts it mentions, and how much of the business's context is worth
 * fetching before the Reply Engine drafts anything.
 */

/**
 * The 12-category taxonomy from Sprint 9.1 §1 — grounded in the
 * trade/service domain, not generic chatbot intents. PRICING_INQUIRY
 * is kept separate from BUSINESS_INFORMATION specifically because
 * pricing has its own "owner-only, never automatic" rule in the
 * Reply Engine's safety layer (Sprint 9 §6).
 */
export type Intent =
  | "BOOKING_REQUEST"
  | "BOOKING_CHANGE"
  | "BOOKING_CANCELLATION"
  | "BUSINESS_INFORMATION"
  | "PRICING_INQUIRY"
  | "RETURNING_PROBLEM"
  | "EMERGENCY"
  | "COMPLAINT"
  | "STATUS_CHECK"
  | "PAYMENT_QUERY"
  | "SOCIAL"
  | "UNCLEAR";

export const INTENTS: readonly Intent[] = [
  "BOOKING_REQUEST",
  "BOOKING_CHANGE",
  "BOOKING_CANCELLATION",
  "BUSINESS_INFORMATION",
  "PRICING_INQUIRY",
  "RETURNING_PROBLEM",
  "EMERGENCY",
  "COMPLAINT",
  "STATUS_CHECK",
  "PAYMENT_QUERY",
  "SOCIAL",
  "UNCLEAR",
];

/** Understanding-confidence — how sure the classification is. Kept
 * deliberately distinct from the Reply Engine's own "reply confidence"
 * (Sprint 9.1 §4: "two signals that must never be conflated"). */
export type UnderstandingConfidence = "unknown" | "low" | "medium" | "high";

/** Pattern-shaped entities — deterministic regex/format parsing only,
 * no model involved (Sprint 9.1 §2). */
export interface PatternEntities {
  phoneNumbers: string[];
  postcodes: string[];
  emails: string[];
  explicitDates: string[]; // e.g. "12/08", "12 August" — raw text, not resolved
}

/** Meaning-shaped entities — returned by the same small classification
 * call that returns intent (Sprint 9.1 §2: "one extra field, not a
 * third pipeline step"). */
export interface MeaningEntities {
  urgency: "none" | "soon" | "urgent";
  impliedJobType: string | null;
  sentiment: "neutral" | "positive" | "negative";
}

/** Messages that must never reach the Reply Engine's generation call
 * at all (Sprint 9.1 §6) — the Understanding Engine's role here is
 * tagging, not deciding; the safety layer already knows how to act on
 * a flag. */
export type SafetyTag = "spam" | "abuse" | "scam" | "medical" | "legal" | "unsupported" | null;

export interface UnderstandingResult {
  primaryIntent: Intent;
  secondaryIntents: Intent[];
  confidence: UnderstandingConfidence;
  patternEntities: PatternEntities;
  meaningEntities: MeaningEntities;
  safetyTag: SafetyTag;
}

/** The six context categories the deterministic lookup table (§3)
 * decides between — Shared Brain / Everything I Know deliberately do
 * NOT appear here (readyToActAlone already gates whether this engine
 * runs at all, before context selection happens). */
export type ContextCategory =
  | "businessProfile"
  | "receptionistRules"
  | "diary"
  | "customerMemory"
  | "conversationHistory"
  | "customerJobs";

export type ContextNeeds = Record<ContextCategory, boolean>;
