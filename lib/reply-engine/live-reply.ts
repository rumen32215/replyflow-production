import "server-only";
import { classifyMessage, resolveContextNeeds, EMPTY_CONVERSATION_STATE, type ConversationState } from "./understanding";
import { generateReplyDraft } from "./prompt/generate";
import { evaluateSafety } from "./safety/evaluate";
import type { ReplyContext, BusinessProfileContext, DiaryContext, ConversationHistoryContext } from "./context/types";

/**
 * One receptionist, one brain (Coaching Implementation Plan C1). This
 * is the same reasoning core production uses — classifyMessage() ->
 * generateReplyDraft() -> evaluateSafety(), the exact functions
 * generateReplyForMessage() orchestrates for a real webhook message —
 * called here without a real conversation, without persistence, and
 * without the Readiness Gate, so it can show a genuine example while
 * the owner is still mid-teaching, before "ready" is ever true.
 *
 * Deliberately NOT a faster or simplified version of the real pipeline:
 * both real model calls happen, every time. The only thing removed is
 * persistence — there is no second reasoning system here, only a
 * different way of invoking the one that already exists.
 */

export interface LiveReplyTeaching {
  tone: string;
  behaviours: string;
  businessRules: string;
  escalationRules: string;
}

export interface LiveReplyFacts {
  businessProfile: BusinessProfileContext;
  diary: DiaryContext;
  faqs: { question: string; answer: string }[];
}

export interface LiveReplyResult {
  replyText: string;
  confidence: string;
  requiresEscalation: boolean;
  escalationReason: string | null;
  intent: string;
  factsUsed: string[];
  noReplyNeeded: boolean;
  /** RC6 — the updated conversation state after this turn. Pass it back
   * in as `memory.priorState` on the next call to give a multi-turn
   * preview (onboarding's demo conversation) genuine turn-by-turn
   * memory, the same way a real conversation's ai_state is carried
   * forward turn by turn in production — not a second memory system,
   * the same one, called again. */
  conversationState: ConversationState;
}

/** Optional multi-turn memory. Omitted entirely (the default), this
 * function's behaviour is byte-for-byte what it always was — every
 * existing caller (Receptionist's live coaching preview, Test
 * Conversations) is unaffected. Only a caller that explicitly wants a
 * threaded conversation (onboarding's demo) passes this. */
export interface LiveReplyMemory {
  priorState?: ConversationState;
  recentHistory?: ConversationHistoryContext["messages"];
}

export async function generateLiveReply(
  businessId: string,
  scenarioMessage: string,
  teaching: LiveReplyTeaching,
  facts: LiveReplyFacts,
  memory: LiveReplyMemory = {}
): Promise<LiveReplyResult> {
  const priorState = memory.priorState ?? EMPTY_CONVERSATION_STATE;
  const recentHistory = memory.recentHistory ?? [];

  const understanding = await classifyMessage(
    businessId,
    scenarioMessage,
    priorState,
    recentHistory.map((m) => ({ direction: m.direction, body: m.body }))
  );
  const needs = resolveContextNeeds(understanding);

  const context: ReplyContext = {
    businessProfile: needs.businessProfile ? facts.businessProfile : null,
    receptionist: needs.receptionistRules
      ? {
          tone: teaching.tone,
          behaviours: teaching.behaviours,
          businessRules: teaching.businessRules,
          escalationRules: teaching.escalationRules,
          faqs: facts.faqs,
        }
      : null,
    diary: needs.diary ? facts.diary : null,
    customerMemory: null,
    conversationHistory: needs.conversationHistory && recentHistory.length > 0 ? { messages: recentHistory } : null,
    customerJobs: null,
    currentBooking: null,
    photoAnalysis: null,
    // Plumber Reset Phase 3 step 4 — this preview path never runs the
    // real tool-decision step (it's a scripted "try your receptionist"
    // scenario, not a live conversation), so there's never anything
    // real to report here.
    toolResults: [],
    newMessage: { body: scenarioMessage, customerName: null, customerPhone: "" },
  };

  const { generation, facts: usedFacts } = await generateReplyDraft(businessId, context, understanding, {
    isFirstMessage: recentHistory.length === 0,
  });
  const safety = evaluateSafety({ understanding, generation, facts: usedFacts });

  return {
    replyText: generation.draftReply,
    confidence: generation.confidence,
    requiresEscalation: safety.requiresEscalation,
    escalationReason: safety.escalationReason,
    intent: understanding.primaryIntent,
    factsUsed: generation.factsUsed,
    noReplyNeeded: generation.noReplyNeeded,
    conversationState: understanding.conversationState,
  };
}
