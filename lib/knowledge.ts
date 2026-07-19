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

export function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

// Business Knowledge's own conversation-preview scenarios/reply-builder
// (KNOWLEDGE_PREVIEW_SCENARIOS / buildKnowledgeReply) were removed in
// Sprint 8.7: Business Knowledge no longer shows a live WhatsApp demo —
// that's Receptionist's job, where tone and reply style are actually
// being shaped. See components/dashboard/business/business-memory.tsx.

// The "how well do I understand this business" scoring that used to
// live here (understandingScore) is now part of the shared reasoning
// model — see lib/intelligence.ts's buildBrain(), which every caller
// (Front Desk, Conversations, Business Knowledge) reads from instead.
