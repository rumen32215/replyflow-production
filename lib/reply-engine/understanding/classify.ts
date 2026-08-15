import "server-only";
import { getCompletion } from "../llm/client";
import { formatNowLondon, resolvePreferredDateTime } from "@/lib/datetime";
import { extractPatternEntities, withPostcodeBackstop } from "./entities";
import {
  INTENTS,
  type BookingAcceptance,
  type Intent,
  type MeaningEntities,
  type SafetyTag,
  type UnderstandingConfidence,
  type UnderstandingResult,
} from "./types";
import { EMPTY_CONVERSATION_STATE, mergeUrgency, toConversationState, type ConversationState } from "./state";
import { recordErrorEvent } from "@/lib/error-events";

/**
 * The Understanding Engine's one model call (Sprint 9.1 §2, §7): small,
 * cheap, fast — returns intent + meaning-shaped entities + confidence
 * together, not as separate calls. Pattern-shaped entities never touch
 * the model at all (see entities.ts) — they're merged in afterwards.
 *
 * Conversation Intelligence Sprint: this call now also updates
 * Conversation State (state.ts) — given where the conversation already
 * was (`priorState`, carried forward, never re-derived) and what just
 * came in, decide where it is now. Doc 07 §5's own recommendation:
 * extend the call that already exists rather than add a new one.
 */

const SAFETY_TAGS: readonly NonNullable<SafetyTag>[] = ["spam", "abuse", "scam", "medical", "legal", "unsupported"];

const BOOKING_ACCEPTANCE_VALUES: readonly BookingAcceptance[] = [
  "none",
  "asking_availability",
  "expressing_preference",
  "proposing_time",
  "explicit_accept",
];

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    primary_intent: { type: "string", enum: INTENTS },
    secondary_intents: { type: "array", items: { type: "string", enum: INTENTS } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    urgency: { type: "string", enum: ["none", "soon", "urgent"] },
    implied_job_type: { type: ["string", "null"] },
    sentiment: { type: "string", enum: ["neutral", "positive", "negative"] },
    safety_tag: { type: ["string", "null"], enum: [...SAFETY_TAGS, null] },
    episode_continuity: { type: "string", enum: ["same_job", "new_job"] },
    booking_acceptance: { type: "string", enum: BOOKING_ACCEPTANCE_VALUES },
    conversation_state: {
      type: "object",
      additionalProperties: false,
      properties: {
        stage: {
          type: "string",
          enum: ["understand", "diagnose", "collect", "quote_or_book", "confirm", "waiting", "completed", "closed"],
        },
        slots: {
          type: "object",
          additionalProperties: false,
          properties: {
            issue: { type: ["string", "null"] },
            location: { type: ["string", "null"] },
            preferred_time: { type: ["string", "null"] },
            customer_name: { type: ["string", "null"] },
          },
          required: ["issue", "location", "preferred_time", "customer_name"],
        },
        open_question: { type: ["string", "null"] },
        greeting_given: { type: "boolean" },
        last_topic: { type: ["string", "null"] },
        goal: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: {
              type: "string",
              enum: [
                "book_appointment",
                "change_booking",
                "cancel_booking",
                "get_pricing",
                "get_information",
                "make_payment",
                "report_problem",
                "make_complaint",
                "handle_emergency",
                "general_chat",
              ],
            },
            status: { type: "string", enum: ["in_progress", "completed", "escalated", "abandoned"] },
          },
          required: ["type", "status"],
        },
        commitments: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string" },
              kind: { type: "string", enum: ["customer_fact", "customer_question", "receptionist_question"] },
              status: { type: "string", enum: ["outstanding", "resolved"] },
            },
            required: ["text", "kind", "status"],
          },
        },
      },
      required: ["stage", "slots", "open_question", "greeting_given", "last_topic", "goal", "commitments"],
    },
  },
  required: [
    "primary_intent",
    "secondary_intents",
    "confidence",
    "urgency",
    "implied_job_type",
    "sentiment",
    "safety_tag",
    "episode_continuity",
    "booking_acceptance",
    "conversation_state",
  ],
} as const;

const SYSTEM_PROMPT = `You do two jobs for one inbound WhatsApp message to a UK trade/service business (e.g. plumber, electrician, heating engineer):

The literal text "[image message]" is a placeholder this application inserts when a customer sends a photo with no caption — it is not something the customer typed. Never treat it as real wording: it must never become part of issue, last_topic, a commitment's text, or any other slot or summary field. A message that is only this placeholder carries no new textual information at all — judge intent/urgency/etc. from the actual conversation context instead, and leave every slot exactly as PREVIOUS STATE had it.

1) CLASSIFY the message:
- primary_intent: the single best-fitting category for what THIS message actually says, judged on its own — never biased toward "whatever we were already doing" just because PREVIOUS STATE shows a stage in progress. A customer can ask a genuinely new question (e.g. the call-out fee) in the middle of an in-progress booking — that message is PRICING_INQUIRY even though the conversation is mid-collect, not BOOKING_REQUEST just because that's the thread's current stage. PREVIOUS STATE is for updating conversation_state below, not for classifying this message. Watch for sarcasm: positive-sounding words describing a negative situation ("great, three days without water, really impressed") is a COMPLAINT, not SOCIAL — judge the actual situation being described, not just the surface words used to describe it.
- secondary_intents: any other categories genuinely also present (compound messages are real, e.g. "Thanks for yesterday, what's your call-out fee?" = SOCIAL + PRICING_INQUIRY). Empty array if none. Long or rambling messages are real too, and a genuine complaint (something already went wrong, a previous visit that failed) buried in the middle of a longer message about something else entirely — a new booking, a pricing question — is still a real complaint: always include COMPLAINT in secondary_intents when one is present anywhere in the message, however minor the language or however much other content surrounds it. Never let the most prominent or most recent request in a long message crowd out a genuine complaint earlier in the same message.
- confidence: how sure you are about primary_intent. Use "low" whenever the message is ambiguous, off-topic, or you are genuinely unsure — never guess to appear confident.
- urgency, implied_job_type, sentiment: read only from what the message actually says, but read the real meaning, not just the surface words — sarcastic praise about a bad situation is negative sentiment, not positive. implied_job_type is null unless a specific kind of job is clearly implied.
- safety_tag: set only when the message is spam, abusive, a scam/phishing attempt, a medical question, a legal question, or a request genuinely outside what this kind of business could ever help with. NEVER set it when primary_intent is EMERGENCY or COMPLAINT — a gas leak, a safety emergency, or a customer complaint is always something this business needs to handle, never "unsupported," regardless of exactly what's being asked. Otherwise null.

2) UPDATE the conversation state. You are given the PREVIOUS state (where this conversation already was) — your job is to move it forward, not to re-derive it from nothing:
- stage: understand (first contact, nothing established yet) -> diagnose (working out what the problem/need actually is) -> collect (gathering the specific details still needed: location, timing, etc.) -> quote_or_book (enough is known to offer a price or a visit) -> confirm (a booking has been proposed/made) -> waiting (confirmed, nothing further needed until the job happens) -> completed (the job has happened) -> closed (the conversation ended without becoming a job, or is genuinely finished). Never advance to quote_or_book or confirm while slots.issue is still null — a booking needs to know what the job actually is before it can be offered, even if timing/location came up first. You do not need to decide whether the previous state's stage still applies if the customer has started a brand new, unrelated request — that decision is handled separately by episode_continuity below; just answer the stage question honestly for the request PREVIOUS STATE actually describes.
- slots: carry forward every slot value from the previous state unchanged unless this message adds or corrects one. issue = the problem/job in a few words. location = postcode/area if given. preferred_time = whatever day/time the customer has proposed, in their own words, exactly as they said it (e.g. "tomorrow morning", "around 4pm", "next Monday afternoon") — if the customer gives a new time, replace the old one; if they haven't mentioned timing yet, keep it null. Never resolve this into a calendar date yourself — the application does that deterministically from your literal wording, not from your own arithmetic.
- open_question: your best guess at what will still be outstanding after this turn, in a few words (e.g. "preferred time", "postcode"), or null if you expect nothing to be outstanding. This is a provisional estimate — the actual reply-writing step may ask something different and will correct this afterward, so don't overthink it.
- greeting_given: true if a greeting has already happened anywhere in this thread (including the previous state already being true) — once true, it stays true.
- last_topic: a short label for what the live exchange is actually about right now (e.g. "radiator repair booking", "call-out fee question", "casual chat") — replace it when the topic genuinely changes, keep it when it doesn't.

3) TRACK the goal and commitments — a layer above stage. Stage answers "where are we in the goal." Goal answers "what is the customer actually trying to achieve," and doesn't change just because they ask a quick side-question.
- goal.type: what the customer is fundamentally here for (book_appointment, change_booking, cancel_booking, get_pricing, get_information, make_payment, report_problem, make_complaint, handle_emergency, general_chat). IMPORTANT: "general_chat" is only ever correct for actual small talk with no real request in it — it is NOT a safe default and it is NOT something to preserve just because the previous state happened to have it (a brand new conversation always starts with goal.type = general_chat as a placeholder, meaning no real goal has been set yet, not that general_chat IS the goal). The moment the customer describes any real need — a problem, a booking, a question — classify the actual goal immediately, even on message one. Once a real goal is set, carry it forward unchanged UNLESS this message represents a genuinely different underlying request, not just a side-question within the current one — a call-out-fee question asked mid-booking does NOT change the goal (still book_appointment; just answer the price question and continue), but "actually, forget that, I want to cancel my Tuesday booking instead" DOES change it. When the goal genuinely changes, also reset stage to "understand" for the new goal — but do not clear commitments, past facts may still be relevant.
- goal.status: in_progress by default; completed once the goal is genuinely achieved (booking confirmed, question answered, payment resolved); escalated if it's been handed to the owner (complaint, emergency, anything requiring_escalation); abandoned only if the customer explicitly said they no longer want to proceed.
- commitments: the running ledger of facts and questions that don't fit the four fixed slots — carry every item from the previous state forward, updating status where this message resolves one, and appending new ones. Never delete an item, only change its status or add to the list. Three kinds: "customer_fact" (something the customer told you unprompted, e.g. "niece will be home", "I'm at work until 5") — always status "resolved" the moment it's stated, since a stated fact isn't waiting on anything. "customer_question" (something the customer asked you) — "outstanding" until your reply actually answers it, then "resolved". "receptionist_question" (something you asked the customer) — "outstanding" until the customer's message actually answers it, then "resolved". Before marking anything resolved, check this message actually resolves it — don't mark it resolved just because time has passed. An item that stays "outstanding" across multiple turns means exactly that: still waiting, not forgotten, and never something to silently re-ask as if it were new — the reply should acknowledge it's still open, not repeat the question fresh as though this were the first time.

4) DECIDE episode_continuity — a separate, structural question from everything above, used by the application (not by you) to decide whether this message belongs to the job PREVIOUS STATE already describes, or a different one:
- "same_job": this message is part of the same job/request PREVIOUS STATE already describes — including any side-question, a related follow-up, or simply more detail about the same problem. This is the default whenever you are genuinely unsure — an ambiguous message should never be treated as a new job.
- "new_job": only when the customer has clearly, unambiguously started describing a different problem or request that has nothing to do with what PREVIOUS STATE was about (e.g. PREVIOUS STATE is about a boiler repair and this message is "hi, my toilet's now leaking too" — a different fault, not a continuation). A vague or short message ("hi", "quick question") is NOT on its own evidence of a new job — judge the actual content, not the length.
- If PREVIOUS STATE is empty (a genuinely fresh conversation, nothing collected yet), always answer "same_job" — there is nothing to compare against, and the application does not use this field in that case.

5) DECIDE booking_acceptance — a separate, structural question, used by the application (not you) to decide whether a booking may ever be auto-confirmed. Judge only THIS message, using PREVIOUS STATE and the recent messages for context about what was actually offered:
- "none": this message has nothing to do with booking timing at all.
- "asking_availability": the customer is asking WHETHER/WHEN something is possible ("can you come tomorrow?", "do you have anything this week?") — a question, not a commitment to any specific time.
- "expressing_preference": the customer states a general preference or constraint without accepting a specific offered slot ("mornings are better for me", "I'm free most of next week").
- "proposing_time": the customer proposes a specific time THEMSELVES, one the business has not yet confirmed as available ("could you do 3pm Thursday?") — a proposal, not an acceptance, even though it names a specific time.
- "explicit_accept": ONLY when the business has already offered one or more specific slots earlier in this thread (check the recent messages) AND this message clearly, unambiguously accepts one of those specific slots ("10am works", "yes let's do Tuesday at 2", "book me in for that one"). A vague "sounds good" with no specific slot on the table is NOT explicit_accept — use "expressing_preference" instead. Never infer acceptance from ambiguous language; when genuinely unsure, use a weaker category, never explicit_accept.

Never invent facts. You are classifying and tracking state, not drafting a reply.`;

interface RawClassification {
  primary_intent: Intent;
  secondary_intents: Intent[];
  confidence: UnderstandingConfidence;
  urgency: MeaningEntities["urgency"];
  implied_job_type: string | null;
  sentiment: MeaningEntities["sentiment"];
  safety_tag: SafetyTag;
  episode_continuity: "same_job" | "new_job";
  booking_acceptance: BookingAcceptance;
  conversation_state: unknown;
}

function isEpisodeContinuity(value: unknown): value is "same_job" | "new_job" {
  return value === "same_job" || value === "new_job";
}

function isBookingAcceptance(value: unknown): value is BookingAcceptance {
  return typeof value === "string" && (BOOKING_ACCEPTANCE_VALUES as readonly string[]).includes(value);
}

function isIntent(value: unknown): value is Intent {
  return typeof value === "string" && (INTENTS as readonly string[]).includes(value);
}

/**
 * Production hardening — replaces what used to be the model's own
 * mental date arithmetic for preferred_time_resolved. The model is
 * still asked for preferred_time (the customer's literal wording,
 * genuinely a classification/extraction task); resolving that wording
 * into a real calendar date and time is deterministic calendar math,
 * not something a language model should be asked to compute and grade
 * its own confidence on — lib/datetime.ts's resolvePreferredDateTime
 * (chrono-node, DST-aware) does it the same way for every call, with
 * no risk of picking the wrong Tuesday or getting BST/GMT wrong.
 * `referenceNow` is the moment this message is actually being
 * classified — the same "CURRENT DATE/TIME" instant already given to
 * the model in the prompt above, so "tomorrow" means the same day to
 * both.
 */
function resolvePreferredTime(state: ConversationState, referenceNow: Date): ConversationState {
  const resolved = state.slots.preferredTime ? resolvePreferredDateTime(state.slots.preferredTime, referenceNow) : null;
  if (resolved === state.slots.preferredTimeResolved) return state;
  return { ...state, slots: { ...state.slots, preferredTimeResolved: resolved } };
}

/** Defensive parsing — the model's output is never trusted blindly.
 * Anything that doesn't validate falls back to the safe, wide UNCLEAR
 * classification rather than propagating a malformed value downstream. */
function toUnderstandingResult(raw: unknown, messageText: string, priorState: ConversationState, referenceNow: Date): UnderstandingResult {
  const patternEntities = extractPatternEntities(messageText);
  const fallback: UnderstandingResult = {
    primaryIntent: "UNCLEAR",
    secondaryIntents: [],
    confidence: "unknown",
    patternEntities,
    meaningEntities: { urgency: "none", impliedJobType: null, sentiment: "neutral" },
    safetyTag: null,
    conversationState: withPostcodeBackstop(priorState, patternEntities),
    // Safe default: an unparseable classification must never be
    // mistaken for a confident "this is a new job" — that would close
    // a real episode over a mere parsing failure.
    episodeContinuity: "same_job",
    // Safe default: a malformed/missing classification must never be
    // mistaken for explicit acceptance — that would risk auto-
    // confirming a booking on a parsing failure alone.
    bookingAcceptance: "none",
  };

  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Partial<RawClassification>;

  if (!isIntent(r.primary_intent)) return fallback;

  const secondaryIntents = Array.isArray(r.secondary_intents) ? r.secondary_intents.filter(isIntent) : [];
  const confidence: UnderstandingConfidence =
    r.confidence === "low" || r.confidence === "medium" || r.confidence === "high" ? r.confidence : "unknown";
  const urgency: MeaningEntities["urgency"] =
    r.urgency === "soon" || r.urgency === "urgent" ? r.urgency : "none";
  const sentiment: MeaningEntities["sentiment"] =
    r.sentiment === "positive" || r.sentiment === "negative" ? r.sentiment : "neutral";
  const safetyTag: SafetyTag = SAFETY_TAGS.includes(r.safety_tag as NonNullable<SafetyTag>)
    ? (r.safety_tag as SafetyTag)
    : null;

  return {
    primaryIntent: r.primary_intent,
    secondaryIntents,
    confidence,
    patternEntities,
    meaningEntities: {
      urgency,
      impliedJobType: typeof r.implied_job_type === "string" && r.implied_job_type.trim() ? r.implied_job_type.trim() : null,
      sentiment,
    },
    safetyTag,
    conversationState: {
      ...resolvePreferredTime(withPostcodeBackstop(toConversationState(r.conversation_state), patternEntities), referenceNow),
      // Carried forward mechanically, not by the model's own
      // conversation_state schema — see state.ts's own doc comment on
      // ConversationState.urgency.
      urgency: mergeUrgency(priorState.urgency, urgency),
    },
    episodeContinuity: isEpisodeContinuity(r.episode_continuity) ? r.episode_continuity : "same_job",
    // Same defensive default as the fallback above — anything not a
    // recognised value degrades to "none", never treated as acceptance.
    bookingAcceptance: isBookingAcceptance(r.booking_acceptance) ? r.booking_acceptance : "none",
  };
}

export async function classifyMessage(
  businessId: string,
  messageText: string,
  priorState: ConversationState = EMPTY_CONVERSATION_STATE,
  recentHistory: { direction: "inbound" | "outbound"; body: string }[] = []
): Promise<UnderstandingResult> {
  // Captured once — the model's prompt and the deterministic date/time
  // resolver below must reason about exactly the same "now", never two
  // instants a few hundred milliseconds apart.
  const referenceNow = new Date();
  try {
    const historyBlock =
      recentHistory.length > 0
        ? `\n\nMost recent messages in this thread, oldest first (for context only — trust PREVIOUS STATE over this for anything it already covers):\n${recentHistory
            .map((m) => `${m.direction === "inbound" ? "Customer" : "Receptionist"}: ${m.body}`)
            .join("\n")}`
        : "";

    const userContent = `CURRENT DATE/TIME (Europe/London): ${formatNowLondon(referenceNow)}\n\nPREVIOUS STATE: ${JSON.stringify(priorState)}${historyBlock}\n\nNEW MESSAGE from the customer: "${messageText}"`;

    const result = await getCompletion({
      tier: "small",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      jsonSchema: { name: "understanding_classification", schema: RESPONSE_SCHEMA },
      maxOutputTokens: 500,
      businessId,
      callSite: "understanding.classify",
    });
    return toUnderstandingResult(result.data, messageText, priorState, referenceNow);
  } catch (err) {
    // A classification failure must never block the pipeline outright —
    // it degrades to the safe, wide fallback (fetch everything bounded,
    // let the Safety Layer hold the draft on low confidence) rather than
    // throwing and losing the message entirely. State is carried forward
    // unchanged rather than reset, since we genuinely don't know it changed.
    console.error("[reply-engine] classification failed:", err);
    // Awaited, not fire-and-forget — matches recordAiUsage's own
    // discipline (0.1): some callers (the owner-facing live-reply
    // route) are a synchronous request/response, not wrapped in
    // waitUntil, so an un-awaited write here risks the serverless
    // function freezing before it actually completes.
    await recordErrorEvent({
      severity: "warning",
      source: "reply-engine.classify_failed",
      businessId,
      message: "classifyMessage's completion call failed — degraded to the safe UNCLEAR fallback, message was not lost.",
      error: err,
    });
    const patternEntities = extractPatternEntities(messageText);
    return {
      primaryIntent: "UNCLEAR",
      secondaryIntents: [],
      confidence: "unknown",
      patternEntities,
      meaningEntities: { urgency: "none", impliedJobType: null, sentiment: "neutral" },
      safetyTag: null,
      conversationState: withPostcodeBackstop(priorState, patternEntities),
      episodeContinuity: "same_job",
      bookingAcceptance: "none",
    };
  }
}
