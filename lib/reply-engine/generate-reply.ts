import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getBrainContext } from "@/lib/brain";
import { classifyMessage, resolveContextNeeds, EMPTY_CONVERSATION_STATE, toConversationState } from "./understanding";
import { assembleContext } from "./context/assemble";
import { generateReplyDraft } from "./prompt/generate";
import { evaluateSafety } from "./safety/evaluate";
import { sendReplyToCustomer } from "./send";
import { recordErrorEvent } from "@/lib/error-events";
import { buildAttachmentAcknowledgmentDraft } from "./attachment-acknowledgment";
import { handleCustomerPhoto } from "./media-intake";
import type { PhotoAnalysisContext } from "./context/types";
import { resolveEpisodeForMessage, closeEpisode, createEpisode, updateEpisodeState } from "./episode";

const STATE_HISTORY_WINDOW = 4;

/**
 * ReplyFlow V4 fix — factored out so every branch that can create a
 * reply_drafts row calls it immediately before doing so, not just the
 * main classify/generate path. Three early-return branches (a
 * non-text/non-image message, an image with no mediaId, an image
 * whose analysis failed) used to build their attachment-acknowledgment
 * draft without ever reaching the one supersede call that used to live
 * deep in the main pipeline — a run of such messages left several
 * "pending" drafts stacked in the same episode, and the Conversations
 * UI (newest-pending-first) surfaced whichever fallback happened to be
 * last, burying a real draft underneath. Always called before this
 * message's own draft is inserted, so it can never supersede itself.
 */
async function supersedePendingDrafts(supabase: ReturnType<typeof createServiceClient>, episodeId: string) {
  await supabase.from("reply_drafts").update({ status: "superseded" }).eq("episode_id", episodeId).eq("status", "pending");
}

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
  /** Meta's message type ("text", "image", "video", "document", ...).
   * Optional and defaults to "text" so the other two real callers
   * (Test Conversations, the live-reply preview) — which only ever
   * send real typed text — need no changes. */
  messageType?: string;
  /** Present only when messageType === "image" (Phase B) — the Graph
   * API media id needed to actually download the photo. */
  mediaId?: string | null;
  mediaCaption?: string | null;
}): Promise<void> {
  const { businessId, conversationId, customerMessageId, messageBody, messageType = "text", mediaId = null, mediaCaption = null } = params;
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
    if (!conversation) {
      // Real, unexplained silent-drop shape (SLI doc §3, 2026-08-01
      // correction): a `return` here is not a thrown exception, so it
      // never reached reply-engine.pipeline_failure below — a genuine
      // gap in the SLI's own instrumentation, not just in this code
      // path. The webhook always creates this exact conversation row
      // moments before calling here, so this "should" never be null;
      // recording it rather than assuming makes the next real
      // occurrence diagnosable instead of invisible.
      await recordErrorEvent({
        severity: "critical",
        source: "reply-engine.conversation_not_found",
        businessId,
        message: "generateReplyForMessage could not find its own conversation row — this customer message has no reply_drafts row.",
        context: { conversationId, customerMessageId },
      });
      return;
    }

    // ReplyFlow V4 — Conversation Episodes (Implementation Contract
    // §B). Every processed message gets filed into the right job
    // before anything else happens — episode membership is a data-
    // organisation fact, not an outcome of the pipeline below. When an
    // in-progress episode already exists, this is provisional (the
    // message is tentatively filed under it); if Understanding later
    // decides this message actually starts a new, unrelated job, both
    // the message and any photo already analysed against it are
    // re-filed under the new episode — see the "new_job" branch below.
    let episode = await resolveEpisodeForMessage(supabase, { conversationId, businessId });
    let episodeId = episode.id;
    await supabase.from("messages").update({ episode_id: episodeId }).eq("id", customerMessageId);

    // Non-text, non-image messages never reach Understanding/Generation
    // — see attachment-acknowledgment.ts for why, and for what gets
    // written instead of the silence this used to produce. Images get
    // their own real path (Phase B) below, once the conversation row
    // this needs is available. These never trigger an episode-continuity
    // check (no Understanding call happens for them at all) — they stay
    // filed under whichever episode was already resolved above.
    if (messageType !== "text" && messageType !== "image") {
      await supersedePendingDrafts(supabase, episodeId);
      await supabase
        .from("reply_drafts")
        .upsert(buildAttachmentAcknowledgmentDraft({ businessId, conversationId, episodeId, customerMessageId }), {
          onConflict: "customer_message_id",
        });
      return;
    }

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
    if (!brain.thoughts.readyToActAlone) {
      // Production hardening (2026-08-14) — this used to be a bare
      // `return`, the one place in this entire pipeline that could drop
      // a real customer message with zero trace: no draft, no
      // error_events row, nothing indistinguishable from the message
      // never having arrived at all. Traced live to a burst of messages
      // (two photos and a later text reply) that vanished this way in
      // the same conversation. Not a failure — the business genuinely
      // hasn't finished teaching its receptionist yet — but
      // "intentionally not actionable" still has to be an observable,
      // queryable fact, not silence. Never a customer-facing draft: a
      // fabricated "I can't help with that yet" here would be inventing
      // an answer just to look like something happened.
      await recordErrorEvent({
        severity: "warning",
        source: "reply-engine.not_ready_to_act_alone",
        businessId,
        message:
          "No AI draft was attempted — this business hasn't finished teaching its receptionist yet (Shared Brain readiness gate).",
        context: { conversationId, customerMessageId },
      });
      return;
    }

    // Photo intake (Phase B — the differentiating loop). Runs before
    // Understanding so a successful analysis can be threaded into
    // Context Assembly as ordinary, citable facts (prompt/facts.ts) —
    // classification/generation downstream never know this message
    // started life as an image, only that photo.* facts exist.
    let photoAnalysis: PhotoAnalysisContext | null = null;
    let effectiveMessageBody = messageBody;
    if (messageType === "image") {
      if (!mediaId) {
        // Meta sent an image-type message with no media id at all —
        // genuinely shouldn't happen, but falling back to the same
        // honest stopgap is safer than pretending to understand it.
        await supersedePendingDrafts(supabase, episodeId);
        await supabase
          .from("reply_drafts")
          .upsert(buildAttachmentAcknowledgmentDraft({ businessId, conversationId, episodeId, customerMessageId }), { onConflict: "customer_message_id" });
        return;
      }
      const { data: businessRow } = await supabase.from("businesses").select("trade").eq("id", businessId).maybeSingle();
      const analysis = await handleCustomerPhoto(supabase, {
        businessId,
        conversationId,
        episodeId,
        customerMessageId,
        mediaId,
        caption: mediaCaption,
        trade: businessRow?.trade ?? "general",
      });
      if (!analysis) {
        // Download, storage, or analysis failed somewhere — the photo
        // may or may not be stored, but there's nothing safe to draft
        // from. Same honest fallback as every other unsupported case.
        await supersedePendingDrafts(supabase, episodeId);
        await supabase
          .from("reply_drafts")
          .upsert(buildAttachmentAcknowledgmentDraft({ businessId, conversationId, episodeId, customerMessageId }), { onConflict: "customer_message_id" });
        return;
      }
      photoAnalysis = { visible: analysis.visible, possible: analysis.possible, unknown: analysis.unknown };
      // Real production bug: classifyMessage() below only ever sees
      // effectiveMessageBody, never photoAnalysis directly (that's
      // fed to generation via assembleContext/facts.ts instead) — a
      // batch of photos with no caption all looked identical to the
      // classifier ("[Customer sent a photo]" repeated with no other
      // signal), which drifted the primary intent to SOCIAL on a
      // genuine photo of a leaking toilet. The analysis is already
      // hedged/safety-checked (it's the exact same object stored to
      // conversation_photos and shown as Photo Intelligence) — folding
      // its visible-content line in here just gives classification the
      // same real signal generation already had, nothing new invented.
      const photoTag = mediaCaption ? `[Customer sent a photo: "${mediaCaption}"]` : "[Customer sent a photo]";
      effectiveMessageBody = `${photoTag} Photo shows: ${analysis.visible}`;
    }

    // Prior Conversation State — comes from the episode already
    // resolved above, scoped to this one job, never the customer's
    // lifetime history (ReplyFlow V4, Conversation Episodes §G — the
    // direct fix for a new job inheriting a previous one's stale
    // slots/goal/commitments).
    const priorState = episode.priorState;

    const { data: recentRows } = await supabase
      .from("messages")
      .select("direction, body, created_at")
      .eq("episode_id", episodeId)
      .order("created_at", { ascending: false })
      .limit(STATE_HISTORY_WINDOW);
    const recentHistory = (recentRows ?? [])
      .slice()
      .reverse()
      .map((m) => ({ direction: m.direction as "inbound" | "outbound", body: m.body ?? "" }));

    // recentHistory already includes this new inbound message (the
    // webhook inserts it before calling here) — length <= 1 means
    // nothing preceded it in this episode, i.e. this is genuinely the
    // opening message of a brand new job. Live testing found "Hi, just
    // checking in" as an opening message getting silenced, which is
    // wrong — an opening message always deserves a reply, however vague.
    const isFirstMessage = recentHistory.length <= 1;

    let understanding = await classifyMessage(businessId, effectiveMessageBody, priorState, recentHistory);

    // ReplyFlow V4 — Conversation Episodes (Implementation Contract
    // §B). A real, structured decision the orchestrator acts on, not a
    // prompt instruction alone. Only meaningful when this message was
    // provisionally filed under an already-in-progress OR a
    // recently-booked episode (episode.isNew === false) — a brand new
    // episode has nothing to compare continuity against, and the
    // classifier is told exactly that (see classify.ts's own prompt).
    if (!episode.isNew && understanding.episodeContinuity === "new_job") {
      // Product Reset Blueprint D.1 — a booked episode that turns out
      // not to be what this message is about is still a real, valid
      // future appointment, not something that ever happened and then
      // got superseded. Only a genuinely in-progress episode (one that
      // never became a real booking) gets marked abandoned here.
      if (!episode.wasBookedCandidate) {
        await closeEpisode(supabase, episodeId, "abandoned");
      }
      const fresh = await createEpisode(supabase, { conversationId, businessId });
      episodeId = fresh.id;
      episode = { id: fresh.id, priorState: EMPTY_CONVERSATION_STATE, isNew: true, wasBookedCandidate: false };

      // Re-file the message — and its photo, if one was already
      // analysed above — under the new episode. Both were only ever
      // provisionally stamped under the old one, before this verdict
      // was known.
      await supabase.from("messages").update({ episode_id: episodeId }).eq("id", customerMessageId);
      if (photoAnalysis) {
        await supabase.from("conversation_photos").update({ episode_id: episodeId }).eq("message_id", customerMessageId);
      }

      // Re-classify from a genuinely clean slate — the first call's
      // conversationState was computed against the OLD episode's own
      // slots/goal/commitments and must never leak into the new job,
      // regardless of how well the model itself tried to reset it in
      // its own answer. Same message/photo context, fresh understanding.
      understanding = await classifyMessage(businessId, effectiveMessageBody, EMPTY_CONVERSATION_STATE, recentHistory.slice(-1));
    }

    // Persist the updated state immediately, regardless of what happens
    // downstream (escalation, silence, auto-send, pending draft) — the
    // state describes this episode's understanding, not the outcome of
    // any one reply.
    await updateEpisodeState(supabase, episodeId, understanding.conversationState);

    // ReplyFlow V4 — Conversation Episodes (Implementation Contract
    // §H). Whatever this message resolves to below, any OTHER draft
    // still "pending" in this same episode is now stale — superseded
    // here, once, so every branch below (safety tag, silence,
    // auto-send, or a fresh pending draft) starts from a clean slate.
    // This is what makes an old, never-actioned draft structurally
    // unable to resurface as "the" suggested reply for a later message
    // in the same job.
    await supersedePendingDrafts(supabase, episodeId);

    // Understanding-level safety pre-check (Sprint 9.1 §6) — some
    // messages must never reach the generation call at all.
    //
    // Deterministic safety net: a safety_tag must never override a real
    // EMERGENCY or COMPLAINT classification. Live testing caught the
    // classification call setting BOTH primary_intent: "EMERGENCY" AND
    // safety_tag: "unsupported" on a genuine gas-leak message — the tag
    // alone would have sent "that's not something we can help with"
    // with no escalation at all, on a real safety issue. Those two
    // categories already force escalation deterministically via the
    // Decision Categories table (never automatic, always escalate) —
    // routing through the normal path is strictly safer than a
    // safety_tag template that doesn't escalate.
    const tagConflictsWithRealIntent =
      understanding.primaryIntent === "EMERGENCY" || understanding.primaryIntent === "COMPLAINT";
    if (understanding.safetyTag && !tagConflictsWithRealIntent) {
      await handleSafetyTag(supabase, { businessId, conversationId, episodeId, customerMessageId, understanding });
      return;
    }

    const needs = resolveContextNeeds(understanding);
    const context = await assembleContext({
      supabase,
      businessId,
      conversationId,
      episodeId,
      customerPhone: conversation.customer_phone,
      customerName: conversation.customer_name,
      conversationStartedAt: conversation.created_at,
      needs,
      messageBody: effectiveMessageBody,
      photoAnalysis,
    });

    const { generation, facts } = await generateReplyDraft(businessId, context, understanding, { isFirstMessage });
    const safety = evaluateSafety({ understanding, generation, facts });

    // Correct open_question with what the reply actually asks, now that
    // it's been written — the pre-generation guess in `understanding`
    // can't know the exact wording generation lands on, and the two
    // disagreeing (state says nothing outstanding, reply asks a
    // question anyway, or vice versa) is what caused generic, dodging
    // replies in production testing. The generation call is the one
    // true source for "what does THIS reply ask," since it wrote it.
    // Same correction for the commitments ledger (Sprint B) — the
    // pre-generation classify call can only guess whether an outstanding
    // commitment gets resolved this turn, since it runs before the reply
    // exists. Without this, an item answered in turn 2 stayed marked
    // "outstanding" forever afterward, causing the model to keep
    // re-stating an answer it had already given (confirmed in testing).
    const resolvedTexts = new Set(generation.resolvesCommitments);
    const correctedCommitments = understanding.conversationState.commitments.map((c) =>
      resolvedTexts.has(c.text) ? { ...c, status: "resolved" as const } : c
    );

    await updateEpisodeState(supabase, episodeId, {
      ...understanding.conversationState,
      openQuestion: generation.asksQuestion,
      commitments: correctedCommitments,
    });

    // Silence (Voice doc 07 §2, Judgement doc 08 "deliberately do
    // nothing") — honoured only within the same narrow, already-safe
    // category auto-send uses, and only when nothing else flagged a
    // problem. Never lets the model's own claim of "no reply needed"
    // override a real escalation or a grounding failure — and never
    // lets it override a message that's literally a question. Live
    // testing found the model going silent on a genuine "could someone
    // come today instead?" once it judged the answer was "already
    // covered" — a real question always deserves an explicit answer,
    // even a one-word one, never silence on the model's own judgment.
    const messageIsAQuestion = effectiveMessageBody.includes("?");

    // Deterministic backstop for exact-match acknowledgements — live
    // adversarial testing found the model inconsistently applying its
    // own silence instruction to a bare "ok" even with genuinely nothing
    // outstanding (priorState.openQuestion null), while "cool" and
    // "thanks so much" in the identical position correctly went silent.
    // Rather than chase this with more prompt wording against inherent
    // LLM run-to-run variance, force it for the narrow, unambiguous case
    // this rule can be applied with total confidence: an exact-match
    // acknowledgement with nothing left open from before this message.
    const EXACT_ACKNOWLEDGEMENTS = new Set([
      "ok",
      "okay",
      "k",
      "kk",
      "cool",
      "nice",
      "great",
      "perfect",
      "sounds good",
      "thanks",
      "thank you",
      "thanks so much",
      "cheers",
      "ta",
      "👍",
      "👍🏻",
    ]);
    const isForcedSilence =
      EXACT_ACKNOWLEDGEMENTS.has(effectiveMessageBody.trim().toLowerCase()) && priorState.openQuestion === null && !isFirstMessage;

    // The category==="general" gate exists to keep AUTO-SEND narrow (a
    // real send carries risk depending on category). It doesn't apply
    // the same way to isForcedSilence: sending nothing at all carries no
    // such risk regardless of what category the surrounding conversation
    // is in — a bare "ok" mid-booking is exactly as safely silenceable
    // as one during general chat. Live testing found this gate blocking
    // the deterministic override for exactly that reason ("ok" mid-
    // booking classifies as booking, not general) — only the
    // model-judgment path (generation.noReplyNeeded) still needs the
    // narrower category restriction. A photo is never silenceable
    // (Phase B) — it deserves at least an acknowledgement, regardless
    // of what the model judges, every time.
    const canSkipReply =
      !photoAnalysis &&
      !messageIsAQuestion &&
      !isFirstMessage &&
      !safety.requiresEscalation &&
      !safety.groundingFailed &&
      (isForcedSilence || (generation.noReplyNeeded && safety.category === "general"));

    if (canSkipReply) {
      await supabase.from("reply_drafts").upsert(
        {
          business_id: businessId,
          conversation_id: conversationId,
          episode_id: episodeId,
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
    // reviewable after the fact, never silent. Photo-derived drafts
    // (Phase B) are never eligible for auto-send, full stop, regardless
    // of category or confidence — a "possible" cause read from a photo
    // always needs a human to actually hit send, at least until this
    // path has real evidence behind it, the same "earns its place"
    // discipline every other widening of auto-send in this codebase
    // already follows.
    const canAutoSend =
      !photoAnalysis && Boolean(aiConfig?.auto_reply_general_enabled) && safety.category === "general" && safety.wouldAutoSend;

    if (canAutoSend) {
      const sendResult = await sendReplyToCustomer({ supabase, businessId, conversationId, text: draftText });
      await supabase.from("reply_drafts").upsert(
        {
          business_id: businessId,
          conversation_id: conversationId,
          episode_id: episodeId,
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
        episode_id: episodeId,
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
    // Critical: a real customer message hit a totally unhandled
    // pipeline failure — this is precisely the "silent drop" gap 0.3's
    // SLI investigation found happening by a different (non-throwing)
    // mechanism. This is the throwing half of that same failure mode.
    await recordErrorEvent({
      severity: "critical",
      source: "reply-engine.pipeline_failure",
      businessId,
      message: "generateReplyForMessage threw an unhandled error — this customer message has no reply_drafts row.",
      error: err,
      context: { conversationId, customerMessageId },
    });
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
    episodeId: string;
    customerMessageId: string;
    understanding: Awaited<ReturnType<typeof classifyMessage>>;
  }
) {
  const { businessId, conversationId, episodeId, customerMessageId, understanding } = params;
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
      episode_id: episodeId,
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
