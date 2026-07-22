import type { BusinessKnowledge } from "@/lib/knowledge";
import type { Availability } from "@/lib/availability";
import type { RelationshipStrength } from "@/lib/customer-memory-signals";

/** Bounded business facts — always sent in full when this category is
 * needed, never filtered (Sprint 9 §4: "realistically 10-30 facts
 * total... no filtering needed"). */
export interface BusinessProfileContext {
  businessName: string;
  trade: string;
  description: string | null;
  services: string[];
  serviceAreas: string[];
  openingTime: string;
  closingTime: string;
  offersEmergencyCallouts: boolean;
  chargesCalloutFee: boolean;
  calloutFeeAmount: string | null;
  receptionistName: string | null;
  knowledge: BusinessKnowledge;
}

export interface ReceptionistContext {
  tone: string;
  behaviours: string;
  businessRules: string;
  escalationRules: string;
  faqs: { question: string; answer: string }[];
}

export interface DiaryContext {
  availability: Availability;
  /** Deterministic, already-phrased answer to "are you free today" —
   * reused from lib/availability rather than re-derived (Sprint 9 §4). */
  todaysAvailabilityReply: string;
  nextAvailable: { label: string } | null;
}

/** The short customer digest (Sprint 9 §4), built from
 * buildRelationshipSummary — never the full unbounded history. */
export interface CustomerMemoryContext {
  name: string;
  relationshipStrength: RelationshipStrength;
  summary: string;
  completedJobCount: number;
}

/** Windowed, not the full unbounded history (Sprint 9 §4: "last ~10-15
 * messages"). Chronological order, oldest first. */
export interface ConversationHistoryContext {
  messages: { direction: "inbound" | "outbound"; body: string; createdAt: string }[];
}

export interface CustomerJobsContext {
  jobs: { jobTitle: string; status: string; scheduledFor: string | null; completedAt: string | null }[];
}

/** The single source of truth for "is this conversation's booking
 * actually real yet." Always fetched (one cheap indexed lookup on
 * conversation_id), regardless of ContextNeeds — overclaiming a
 * booking that doesn't exist is a safety issue for any intent, not
 * just booking-related ones (Conversation Design Sprint). */
export interface CurrentBookingContext {
  jobTitle: string;
  status: string;
  scheduledFor: string | null;
}

/** Everything Context Assembly gathered for one message — each field
 * is null when its category wasn't in ContextNeeds, never fetched
 * speculatively (Sprint 10A: "Only retrieve the information actually
 * required for the detected intent"). */
export interface ReplyContext {
  businessProfile: BusinessProfileContext | null;
  receptionist: ReceptionistContext | null;
  diary: DiaryContext | null;
  customerMemory: CustomerMemoryContext | null;
  conversationHistory: ConversationHistoryContext | null;
  customerJobs: CustomerJobsContext | null;
  currentBooking: CurrentBookingContext | null;
  newMessage: { body: string; customerName: string | null; customerPhone: string };
}
