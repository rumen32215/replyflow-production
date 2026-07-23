import type { BusinessKnowledge } from "@/lib/knowledge";

/**
 * Meet Your Receptionist (Trust Track, DOCS/CONSTITUTION/03 §2) — the
 * recap she opens with is built entirely by this pure, deterministic
 * function, never an LLM call. Nothing here can invent a fact: every
 * line is either a direct restatement of a real column/value, or an
 * honest, pre-written acknowledgment that something hasn't been taught
 * yet. This is the same discipline the reply engine's fact-grounding
 * applies to a customer message, applied instead to the very first
 * thing she ever says to the owner — the one moment in the product
 * where "never invent" matters more than anywhere else.
 */

export interface HandoverInput {
  businessName: string;
  trade: string;
  receptionistName: string | null;
  services: string[];
  serviceAreas: string[];
  openingTime: string;
  closingTime: string;
  offersEmergencyCallouts: boolean;
  chargesCalloutFee: boolean;
  calloutFeeAmount: string | null;
  businessRules: string;
  escalationRules: string;
  faqCount: number;
  knowledge: BusinessKnowledge;
}

export type HandoverReadiness = "empty" | "partial" | "ready";

export interface HandoverRecap {
  readiness: HandoverReadiness;
  /** Facts she's confident about — every line traceable to a real
   * value the owner actually entered. */
  understood: string[];
  /** Honest gaps — stated plainly, never silently skipped, never
   * papered over with a guess. */
  gaps: string[];
}

function listJoin(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function buildHandoverRecap(input: HandoverInput): HandoverRecap {
  const understood: string[] = [];
  const gaps: string[] = [];

  if (input.services.length > 0) {
    understood.push(`You do ${listJoin(input.services)}.`);
  } else {
    gaps.push("I don't have your services listed yet.");
  }

  if (input.serviceAreas.length > 0) {
    understood.push(`You cover ${listJoin(input.serviceAreas)}.`);
  } else {
    gaps.push("I don't know which areas you cover yet.");
  }

  understood.push(`You're open ${input.openingTime}–${input.closingTime}.`);

  if (input.offersEmergencyCallouts) {
    understood.push("You take on emergency call-outs.");
  } else {
    understood.push("You don't take on emergency call-outs.");
  }

  if (input.chargesCalloutFee) {
    if (input.calloutFeeAmount && input.calloutFeeAmount.trim()) {
      understood.push(`You charge a call-out fee of ${input.calloutFeeAmount.trim()}.`);
    } else {
      understood.push("You charge a call-out fee.");
      gaps.push("I know you charge a call-out fee, but I don't have the amount yet — I won't guess at it.");
    }
  } else {
    understood.push("You don't charge a call-out fee.");
  }

  if (input.knowledge.jobsDeclined.length > 0) {
    understood.push(`You don't take on: ${listJoin(input.knowledge.jobsDeclined)}.`);
  }

  if (input.knowledge.guarantees.length > 0) {
    understood.push(`You guarantee: ${listJoin(input.knowledge.guarantees)}.`);
  }

  if (input.knowledge.paymentMethods.length > 0) {
    understood.push(`You take payment by ${listJoin(input.knowledge.paymentMethods)}.`);
  }

  if (input.knowledge.parkingAccess.trim()) {
    understood.push(`On parking: ${input.knowledge.parkingAccess.trim()}`);
  }

  if (input.businessRules.trim()) {
    understood.push(`You've told me: "${input.businessRules.trim()}"`);
  } else {
    gaps.push("You haven't given me any house rules yet — I'll stay cautious until you do.");
  }

  if (input.escalationRules.trim()) {
    understood.push(`You want me to bring you in when: ${input.escalationRules.trim()}`);
  } else {
    gaps.push("You haven't told me when to bring you in yet, so for now I'll play it safe and ask more often than I might need to.");
  }

  if (input.faqCount > 0) {
    understood.push(`You've given me ${input.faqCount} question${input.faqCount === 1 ? "" : "s"} customers usually ask, with your answers.`);
  }

  const readiness: HandoverReadiness =
    input.services.length > 0 && input.serviceAreas.length > 0 ? "ready" : input.services.length > 0 || input.serviceAreas.length > 0 ? "partial" : "empty";

  return { readiness, understood, gaps };
}

/** The Promise (DOCS/CONSTITUTION/03 §3) — fixed wording, never
 * generated, never varied per business. It's a behavioural commitment,
 * not a fact about this business, so it doesn't belong in the
 * deterministic recap above. */
export const THE_PROMISE = [
  "I'll never pretend to know something you haven't taught me.",
  "I'll never guess when your reputation is on the line.",
  "When I'm not sure, I'll bring you in.",
] as const;
