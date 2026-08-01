/**
 * The fixed, honest acknowledgment for a non-text inbound message
 * (image, video, document, location, ...) — Sprint 9.1 §8's own,
 * deliberate scope limit means nothing in the pipeline can see or
 * reason about an attachment yet (real photo/attachment support is
 * Master Execution Plan Phase 5, correctly deferred pending real
 * customer demand). Until this existed, that meant complete silence —
 * real SLI investigation (2026-08) traced one of the documented
 * "silent drop" instances directly to exactly this case. This closes
 * that gap honestly: no claim of understanding the attachment, only
 * confirmation it arrived.
 *
 * Pure — no Supabase, no LLM — so the exact shape of what gets written
 * is directly testable, matching every other lib/*.ts convention here.
 * `generate-reply.ts` is the only caller; this file exists purely to
 * make that one insert's shape verifiable in isolation.
 */
export interface AttachmentAcknowledgmentInput {
  businessId: string;
  conversationId: string;
  customerMessageId: string;
}

export function buildAttachmentAcknowledgmentDraft(input: AttachmentAcknowledgmentInput) {
  return {
    business_id: input.businessId,
    conversation_id: input.conversationId,
    customer_message_id: input.customerMessageId,
    draft_text:
      "Thanks for sending that over — I'm not able to view attachments yet, but I've made sure the team can see it's here.",
    intent: "UNCLEAR" as const,
    understanding_confidence: "unknown" as const,
    confidence: "verified" as const,
    category: "general" as const,
    requires_escalation: false,
    escalation_reason: null,
    facts_used: [] as string[],
    would_auto_send: false,
    // Never auto-sent — widening what auto-sends is its own, separate,
    // pilot-evidence-gated decision (Phase 5), not something this fix
    // should quietly do on the side.
    safety_reasons: ["Non-text message — a fixed, honest acknowledgment; the pipeline doesn't understand attachments yet."],
    status: "pending" as const,
  };
}
