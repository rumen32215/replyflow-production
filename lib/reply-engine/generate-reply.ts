import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getBrainContext } from "@/lib/brain";
import { classifyMessage, resolveContextNeeds, EMPTY_CONVERSATION_STATE, toConversationState } from "./understanding";
import { assembleContext } from "./context/assemble";
import { generateReplyDraft } from "./prompt/generate";
import { evaluateSafety } from "./safety/evaluate";
import { sendReplyToCustomer } from "./send";

const STATE_HISTORY_WINDOW = 4;

/**
 * The Reply Engine orchestrator — the one entry point that wires
 * Understanding -> Context Assembly -> Prompt -> LLM -> Safety Layer ->
 * Draft, exactly the pipeline agreed in Sprint 9 §3 and refined by
 * Sprint 9.1 §7. Called from the webhook via `waitUntil` so it never
 * blocks Meta's fast ACK (Sprint 9 §3: "processing must never block
 * the webhook").
 *
 * Every exit path is a no-throw: this runs with no caller left to
 * catch an error by the time it executes, so every failure is logged
 * and swallowed rather than lost.
 */
export async function generateReplyForMessage(params: {
  businessId: string;
  conversationId: string;
  customerMessageId: string;
  messageBody: string;
}): Promise<void> {
  const { businessId, conversationId, customerMessageId, messageBody } = params;
  const supabase = createServiceClient();

  try {
    // Idempotency guard — a webhook retry (or any re-processing of the
    // same inbound message) must never produce a second draft.
    const { data: existingDraft } = await supabase
      .from("reply_drafts")
      .select("id")
      .eq("customer_message_id", customerMessageId)
      .maybeSingle();
    if (existingDraft) return;

    const { data: conversation } = await supabase
      .from("conversations")
      .select("customer_phone, customer_name, created_at")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conversation) return;

    const { data: aiConfig } = await supabase
      .from("ai_configurations")
      .select("system_prompt, business_rules, escalation_rules, auto_reply_general_enabled")
      .eq("business_id", businessId)
      .maybeSingle();

    // Readiness Gate (Sprint 9 §3) — reuses the exact same Shared Brain
    // signal Front Desk already shows the owner (`readyToActAlone`),
    // never a parallel readiness check. A business that hasn't taught
    // its Receptionist yet gets no AI-drafted replies at all — the
    // message still lands normally in Conversations for the owner.
    const brain = getBrainContext({
      businessId,
      receptionist: {
        behavioursTaught: Boolean(aiConfig?.system_prompt?.trim()),
        rulesTaught: Boolean(aiConfig?.business_rules?.trim()),
        escalationTaught: Boolean(aiConfig?.escalation_rules?.trim()),
      },
      activity: {
        whatsappConnected: true, // this code path only runs for a message that arrived via a connected number
        waitingCount: 0,
        oldestWaitingName: null,
        oldestWaitingMinutes: null,
        completedToday: 0,
        bookedToday: 0,
      },
    });
    if (!brain.thoughts.readyToActAlone) return;

    // Prior Conversation State (Conversation Intelligence Sprint) —
    // fetched as its own defensive, separate query rather than folded
    // into the `conversations` select above: a PostgREST select fails
    // its *entire* query if any one requested column doesn't exist, and
    // the ai_state column depends on a migration that may not have run
    // yet in every environment. Isolating it means a missing column
    // degrades to "no state yet" instead of breaking message processing
    // outright — the exact failure mode the tone_notes migration gap
    // caused once already.
    let priorState = EMPTY_CONVERSATION_STATE;
    try {
      const { data: stateRow } = await supabase
        .from("conversations")
        .select("ai_state")
        .eq("id", conversationId)
        .maybeSingle();
      if (stateRow?.ai_state) priorState = toConversationState(stateRow.ai_state);
    } catch (err) {
      console.error("[reply-engine] could not read prior conversation state (migration 0012 may not be applied yet):", err);
    }

    const { data: recentRows } = await supabase
      .from("messages")
      .select("direction, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(STATE_HISTORY_WINDOW);
    const recentHistory = (recentRows ?? [])
      .slice()
      .reverse()
      .map((m) => ({ direction: m.direction as "inbound" | "outbound", body: m.body ?? "" }));

    const understanding = await classifyMessage(messageBody, priorState, recentHistory);

    // Persist the updated state immediately, regardless of what happens
    // downstream (escalation, silence, auto-send, pending draft) — the
    // state describes the conversation's understanding, not the outcome
    // of any one reply. Best-effort: a failure here (e.g. migration
    // 0012 not applied yet) must never block drafting a reply.
    try {
      await supabase.from("conversations").update({ ai_state: understanding.conversationState }).eq("id", conversationId);
    } catch (err) {
      console.error("[reply-engine] could not persist conversation state:", err);
    }

    // Understanding-level safety pre-check (Sprint 9.1 §6) — some
    // messages must never reach the generation call at all.
    if (understanding.safetyTag) {
      await handleSafetyTag(supabase, { businessId, conversationId, customerMessageId, understanding });
      return;
    }

    const needs = resolveContextNeeds(understanding);
    const context = await assembleContext({
      supabase,
      businessId,
      conversationId,
      customerPhone: conversation.customer_phone,
      customerName: conversation.customer_name,
      conversationStartedAt: conversation.created_at,
      needs,
      messageBody,
    });

    const { generation, facts } = await generateReplyDraft(context, understanding);
    const safety = evaluateSafety({ understanding, generation, facts });

    // Silence (Voice doc 07 §2, Judgement doc 08 "deliberately do
    // nothing") — honoured only within the same narrow, already-safe
    // category auto-send uses, and only when nothing else flagged a
    // problem. Never lets the model's own claim of "no reply needed"
    // override a real escalation or a grounding failure.
    const canSkipReply = generation.noReplyNeeded && safety.category === "general" && !safety.requiresEscalation && !safety.groundingFailed;

    if (canSkipReply) {
      await supabase.from("reply_drafts").upsert(
        {
          business_id: businessId,
          conversation_id: conversationId,
          customer_message_id: customerMessageId,
          draft_text: "",
          intent: understanding.primaryIntent,
          understanding_confidence: understanding.confidence,
          confidence: generation.confidence,
          category: safety.category,
          requires_escalation: false,
          escalation_reason: null,
          facts_used: generation.factsUsed,
          would_auto_send: false,
          safety_reasons: [...safety.reasons, "Receptionist judged no reply was needed — silence was the correct response."],
          status: "no_reply_needed",
          resolved_at: new Date().toISOString(),
        },
        { onConflict: "customer_message_id" }
      );
      return;
    }

    const draftText = generation.draftReply || "I'm not confident enough to draft this one — please reply yourself.";

    // Auto-send — a narrow, deliberate, opt-in exception to "every
    // reply requires approval" (Sprint 10A's own rule). Scoped to the
    // single lowest-risk category the safety layer already recognises
    // (plain greetings / business-information questions / status
    // checks — never booking, pricing, cancellation, complaints, or
    // emergencies, which always fail `safety.category === "general"`
    // regardless of this toggle), and only when the owner has
    // explicitly turned it on *and* every existing safety check
    // (confidence gate, fact-grounding, escalation) already passed.
    // Still writes a full reply_drafts row either way — auditable,
    // reviewable after the fact, never silent.
    const canAutoSend =
      Boolean(aiConfig?.auto_reply_general_enabled) && safety.category === "general" && safety.wouldAutoSend;

    if (canAutoSend) {
      const sendResult = await sendReplyToCustomer({ supabase, businessId, conversationId, text: draftText });
      await supabase.from("reply_drafts").upsert(
        {
          business_id: businessId,
          conversation_id: conversationId,
          customer_message_id: customerMessageId,
          draft_text: draftText,
          intent: understanding.primaryIntent,
          understanding_confidence: understanding.confidence,
          confidence: generation.confidence,
          category: safety.category,
          requires_escalation: false,
          escalation_reason: null,
          facts_used: generation.factsUsed,
          would_auto_send: true,
          safety_reasons: safety.reasons,
          status: sendResult.ok ? "sent" : "failed",
          error_message: sendResult.ok ? null : sendResult.error,
          resolved_at: sendResult.ok ? new Date().toISOString() : null,
        },
        { onConflict: "customer_message_id" }
      );
      return;
    }

    await supabase.from("reply_drafts").upsert(
      {
        business_id: businessId,
        conversation_id: conversationId,
        customer_message_id: customerMessageId,
        draft_text: draftText,
        intent: understanding.primaryIntent,
        understanding_confidence: understanding.confidence,
        confidence: generation.confidence,
        category: safety.category,
        requires_escalation: safety.requiresEscalation,
        escalation_reason: safety.escalationReason,
        facts_used: generation.factsUsed,
        would_auto_send: safety.wouldAutoSend,
        safety_reasons: safety.reasons,
        status: "pending",
      },
      { onConflict: "customer_message_id" }
    );
  } catch (err) {
    console.error("[reply-engine] generateReplyForMessage failed:", err);
  }
}

const SAFETY_TAG_TEMPLATES: Record<string, { text: string; escalate: boolean }> = {
  abuse: { text: "This message needs your personal attention — I haven't drafted a reply.", escalate: true },
  scam: { text: "This message looks suspicious — I haven't drafted a reply. Worth a look before responding.", escalate: true },
  medical: { text: "This is a medical question I'm not able to answer — please reply to this one yourself.", escalate: true },
  legal: { text: "This is a legal question I'm not able to answer — please reply to this one yourself.", escalate: true },
  unsupported: {
    text: "Thanks for reaching out — that's not something we're able to help with, but I'll make sure the team sees your message.",
    escalate: false,
  },
};

async function handleSafetyTag(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    businessId: string;
    conversationId: string;
    customerMessageId: string;
    understanding: Awaited<ReturnType<typeof classifyMessage>>;
  }
) {
  const { businessId, conversationId, customerMessageId, understanding } = params;
  const tag = understanding.safetyTag;

  // Spam gets no reply attempted and isn't surfaced at all (Sprint 9.1
  // §6) — genuinely nothing to do here.
  if (tag === "spam" || !tag) return;

  const template = SAFETY_TAG_TEMPLATES[tag];
  if (!template) return;

  await supabase.from("reply_drafts").upsert(
    {
      business_id: businessId,
      conversation_id: conversationId,
      customer_message_id: customerMessageId,
      draft_text: template.text,
      intent: understanding.primaryIntent,
      understanding_confidence: understanding.confidence,
      confidence: "verified",
      category: tag,
      requires_escalation: template.escalate,
      escalation_reason: template.escalate ? `Flagged by the Understanding Engine as: ${tag}.` : null,
      facts_used: [],
      would_auto_send: false,
      safety_reasons: [`Understanding Engine safety tag: ${tag}.`],
      status: "pending",
    },
    { onConflict: "customer_message_id" }
  );
}
