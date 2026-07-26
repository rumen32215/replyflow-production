import "server-only";
import { classifyMessage, resolveContextNeeds, EMPTY_CONVERSATION_STATE } from "./understanding";
import { generateReplyDraft } from "./prompt/generate";
import { evaluateSafety } from "./safety/evaluate";
import type { ReplyContext, BusinessProfileContext, DiaryContext } from "./context/types";

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
}

export async function generateLiveReply(
  scenarioMessage: string,
  teaching: LiveReplyTeaching,
  facts: LiveReplyFacts
): Promise<LiveReplyResult> {
  const understanding = await classifyMessage(scenarioMessage, EMPTY_CONVERSATION_STATE, []);
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
    conversationHistory: null,
    customerJobs: null,
    currentBooking: null,
    newMessage: { body: scenarioMessage, customerName: null, customerPhone: "" },
  };

  const { generation, facts: usedFacts } = await generateReplyDraft(context, understanding, { isFirstMessage: true });
  const safety = evaluateSafety({ understanding, generation, facts: usedFacts });

  return {
    replyText: generation.draftReply,
    confidence: generation.confidence,
    requiresEscalation: safety.requiresEscalation,
    escalationReason: safety.escalationReason,
    intent: understanding.primaryIntent,
    factsUsed: generation.factsUsed,
    noReplyNeeded: generation.noReplyNeeded,
  };
}
