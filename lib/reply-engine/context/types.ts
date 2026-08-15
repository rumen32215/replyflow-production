import type { BusinessKnowledge } from "@/lib/knowledge";
import type { Availability } from "@/lib/availability";
import type { RelationshipStrength } from "@/lib/customer-memory-signals";
import type { ExecutedTool } from "../tools/types";

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
  /** null = never confirmed either way (Product Guarantee 1 — must
   * never be presented as a known fact). */
  offersEmergencyCallouts: boolean | null;
  chargesCalloutFee: boolean | null;
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

/** Phase B — a photo's already-computed VISIBLE/POSSIBLE/UNKNOWN
 * analysis (lib/reply-engine/vision/analyze-photo.ts), threaded in as
 * ordinary context so it becomes citable facts (prompt/facts.ts)
 * rather than a parallel system with its own grounding rules. */
export interface PhotoAnalysisContext {
  visible: string;
  possible: string;
  unknown: string;
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
  photoAnalysis: PhotoAnalysisContext | null;
  /** Plumber Reset Phase 3 step 4 — real tool calls already executed
   * this turn (lib/reply-engine/tools/decide.ts), before generation
   * ever runs. Always present, empty when none were needed — turned
   * into citable facts by prompt/facts.ts, the same grounding
   * machinery every other context category already uses. */
  toolResults: ExecutedTool[];
  newMessage: { body: string; customerName: string | null; customerPhone: string };
}
