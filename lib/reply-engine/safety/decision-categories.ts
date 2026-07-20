import type { Intent } from "../understanding/types";
import type { ReplyConfidence } from "../prompt/types";

/**
 * The Decision Categories table (Sprint 9 §6) — deterministic, not
 * another model judgment. Derived from the Understanding Engine's
 * already-validated `primaryIntent` rather than re-asked from the
 * generation LLM: a safety-critical mapping should have exactly one
 * source of truth an engineer can read, not two classifiers that could
 * disagree. Pricing and Emergency are hard-coded as never-automatic —
 * no confidence level ever clears them (Sprint 9 §6: "Pricing — never
 * automatic, owner only"; "Emergency — never automatic, escalate
 * immediately").
 */
export interface DecisionCategory {
  category: string;
  neverAutomatic: boolean;
  alwaysEscalate: boolean;
  /** The minimum reply-confidence that would clear the gate for
   * auto-send — computed for audit/transparency (`would_auto_send`)
   * even though Sprint 10A never acts on it. */
  minConfidence: ReplyConfidence;
}

const CONFIDENCE_RANK: Record<ReplyConfidence, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
  verified: 4,
};

export function meetsConfidence(actual: ReplyConfidence, required: ReplyConfidence): boolean {
  return CONFIDENCE_RANK[actual] >= CONFIDENCE_RANK[required];
}

const DECISION_CATEGORIES: Record<Intent, DecisionCategory> = {
  SOCIAL: { category: "general", neverAutomatic: false, alwaysEscalate: false, minConfidence: "medium" },
  BUSINESS_INFORMATION: { category: "general", neverAutomatic: false, alwaysEscalate: false, minConfidence: "medium" },
  STATUS_CHECK: { category: "general", neverAutomatic: false, alwaysEscalate: false, minConfidence: "medium" },
  BOOKING_REQUEST: { category: "booking", neverAutomatic: false, alwaysEscalate: false, minConfidence: "high" },
  BOOKING_CHANGE: { category: "change_booking", neverAutomatic: false, alwaysEscalate: false, minConfidence: "high" },
  BOOKING_CANCELLATION: { category: "cancellation", neverAutomatic: false, alwaysEscalate: false, minConfidence: "verified" },
  RETURNING_PROBLEM: { category: "returning_problem", neverAutomatic: false, alwaysEscalate: false, minConfidence: "high" },
  PAYMENT_QUERY: { category: "payment", neverAutomatic: false, alwaysEscalate: false, minConfidence: "high" },
  PRICING_INQUIRY: { category: "pricing", neverAutomatic: true, alwaysEscalate: false, minConfidence: "verified" },
  COMPLAINT: { category: "complaint", neverAutomatic: true, alwaysEscalate: true, minConfidence: "verified" },
  EMERGENCY: { category: "emergency", neverAutomatic: true, alwaysEscalate: true, minConfidence: "verified" },
  UNCLEAR: { category: "general", neverAutomatic: true, alwaysEscalate: false, minConfidence: "verified" },
};

export function decisionCategoryFor(intent: Intent): DecisionCategory {
  return DECISION_CATEGORIES[intent];
}
