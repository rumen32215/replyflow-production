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
