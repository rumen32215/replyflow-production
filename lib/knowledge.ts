/**
 * Business memory — pure types and helpers for the living profile
 * (Business Experience V2). The structured columns that already exist
 * on `businesses` (name, description, services, service_areas,
 * call-out fee, emergency) stay the source of truth for what they
 * cover; this document holds the sections that grow forever.
 */

export interface BusinessKnowledge {
  personality: string[]; // "Family business", "Fully insured"...
  jobsDeclined: string[];
  guarantees: string[];
  paymentMethods: string[];
  certifications: string[];
  parkingAccess: string;
  emergencyNotes: string;
}

export function parseKnowledge(stored: unknown): BusinessKnowledge {
  const base: BusinessKnowledge = {
    personality: [],
    jobsDeclined: [],
    guarantees: [],
    paymentMethods: [],
    certifications: [],
    parkingAccess: "",
    emergencyNotes: "",
  };
  if (!stored || typeof stored !== "object") return base;
  const s = stored as Partial<BusinessKnowledge>;
  return {
    personality: Array.isArray(s.personality) ? s.personality : [],
    jobsDeclined: Array.isArray(s.jobsDeclined) ? s.jobsDeclined : [],
    guarantees: Array.isArray(s.guarantees) ? s.guarantees : [],
    paymentMethods: Array.isArray(s.paymentMethods) ? s.paymentMethods : [],
    certifications: Array.isArray(s.certifications) ? s.certifications : [],
    parkingAccess: typeof s.parkingAccess === "string" ? s.parkingAccess : "",
    emergencyNotes: typeof s.emergencyNotes === "string" ? s.emergencyNotes : "",
  };
}

export const PERSONALITY_SUGGESTIONS = [
  "Family business",
  "Same-day service",
  "Fully insured",
  "Free quotes",
  "20+ years experience",
  "Emergency call-outs",
] as const;

export const PAYMENT_SUGGESTIONS = ["Cash", "Card", "Bank transfer", "Invoice"] as const;

export const GUARANTEE_SUGGESTIONS = [
  "12-month workmanship guarantee",
  "No fix, no fee",
  "Manufacturer warranties honoured",
] as const;

/** What customers usually ask — suggested before the owner has to
 * think of their own (Business Profile V1's own example list). */
export const FAQ_SUGGESTIONS = [
  "Do you charge a call-out fee?",
  "Do you offer free quotes?",
  "Do you work weekends?",
  "How quickly can someone attend?",
  "Do you offer emergency call-outs?",
] as const;

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export interface KnowledgePreviewFacts {
  paymentMethods: string[];
  chargesCalloutFee: boolean;
  calloutFeeAmount: string;
  guarantees: string[];
  serviceAreas: string[];
  offersEmergency: boolean;
  emergencyNotes: string;
  parkingAccess: string;
}

export interface KnowledgeScenario {
  id: string;
  label: string;
  customerMessage: string;
}

/** Real customer questions about the business itself — a different
 * axis from the Receptionist's tone/behaviour scenarios, but the same
 * "watch it change live" proof (Receptionist V1: never guess — every
 * branch below only fires when the underlying fact is actually known). */
export const KNOWLEDGE_PREVIEW_SCENARIOS: readonly KnowledgeScenario[] = [
  { id: "payment", label: "How to pay", customerMessage: "How can I pay you?" },
  { id: "callout-fee", label: "Call-out fee", customerMessage: "Do you charge a call-out fee?" },
  { id: "guarantee", label: "Guarantee", customerMessage: "Do you guarantee your work?" },
  { id: "areas", label: "Areas covered", customerMessage: "What areas do you cover?" },
  { id: "access", label: "Before arrival", customerMessage: "Is there anything I need to do before you arrive?" },
  { id: "emergency", label: "Emergency call-out", customerMessage: "Do you do emergency call-outs?" },
] as const;

export function buildKnowledgeReply(scenarioId: string, f: KnowledgePreviewFacts): string {
  switch (scenarioId) {
    case "payment":
      return f.paymentMethods.length > 0
        ? `You can pay by ${joinList(f.paymentMethods).toLowerCase()}.`
        : "I'll check with the team and confirm the best way for you to pay.";

    case "callout-fee":
      if (!f.chargesCalloutFee) return "No call-out fee for this — you'll only pay for the work itself.";
      return f.calloutFeeAmount.trim()
        ? `Yes, there's a call-out fee of ${f.calloutFeeAmount.trim()}, which we'll always mention upfront.`
        : "Yes, there is a call-out fee, which we'll always mention upfront.";

    case "guarantee":
      return f.guarantees.length > 0
        ? `Yes — ${joinList(f.guarantees).toLowerCase()}.`
        : "The team will confirm exactly what's covered before starting.";

    case "areas":
      return f.serviceAreas.length > 0
        ? `We cover ${joinList(f.serviceAreas)}.`
        : "I'll double check with the team whether we cover your area.";

    case "access":
      return f.parkingAccess.trim()
        ? f.parkingAccess.trim()
        : "Nothing in particular — just let us know if there's anything we should be aware of.";

    case "emergency":
      if (!f.offersEmergency) return "We don't currently offer emergency call-outs, but the team can advise on next steps.";
      return f.emergencyNotes.trim()
        ? `Yes, we do emergency call-outs. ${f.emergencyNotes.trim()}`
        : "Yes, we do offer emergency call-outs.";

    default:
      return "I'll check with the team and get back to you on that.";
  }
}

/**
 * The Business Understanding score — not a game, simply a gentle
 * signal that a more complete memory means better conversations.
 * Counts the pieces of knowledge that exist, out of what could exist.
 */
export function understandingScore(input: {
  businessDescription: string | null;
  services: string[];
  serviceAreas: string[];
  knowledge: BusinessKnowledge;
  faqCount: number;
}): { percent: number; missing: string[] } {
  const checks: { done: boolean; missing: string }[] = [
    { done: Boolean(input.businessDescription?.trim()), missing: "a short introduction" },
    { done: input.services.length > 0, missing: "the services you offer" },
    { done: input.serviceAreas.length > 0, missing: "the areas you cover" },
    { done: input.knowledge.personality.length > 0, missing: "what makes you special" },
    { done: input.knowledge.jobsDeclined.length > 0, missing: "jobs you don't take" },
    { done: input.knowledge.paymentMethods.length > 0, missing: "how customers can pay" },
    { done: input.knowledge.guarantees.length > 0, missing: "your guarantees" },
    { done: input.faqCount > 0, missing: "answers to common questions" },
  ];
  const done = checks.filter((c) => c.done).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    missing: checks.filter((c) => !c.done).map((c) => c.missing),
  };
}
