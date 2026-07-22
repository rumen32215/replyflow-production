import "server-only";
import { getCompletion } from "../llm/client";
import { extractPatternEntities } from "./entities";
import { INTENTS, type Intent, type MeaningEntities, type SafetyTag, type UnderstandingConfidence, type UnderstandingResult } from "./types";
import { EMPTY_CONVERSATION_STATE, toConversationState, type ConversationState } from "./state";

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
    "conversation_state",
  ],
} as const;

const SYSTEM_PROMPT = `You do two jobs for one inbound WhatsApp message to a UK trade/service business (e.g. plumber, electrician, heating engineer):

1) CLASSIFY the message:
- primary_intent: the single best-fitting category for what THIS message actually says, judged on its own — never biased toward "whatever we were already doing" just because PREVIOUS STATE shows a stage in progress. A customer can ask a genuinely new question (e.g. the call-out fee) in the middle of an in-progress booking — that message is PRICING_INQUIRY even though the conversation is mid-collect, not BOOKING_REQUEST just because that's the thread's current stage. PREVIOUS STATE is for updating conversation_state below, not for classifying this message.
- secondary_intents: any other categories genuinely also present (compound messages are real, e.g. "Thanks for yesterday, what's your call-out fee?" = SOCIAL + PRICING_INQUIRY). Empty array if none.
- confidence: how sure you are about primary_intent. Use "low" whenever the message is ambiguous, off-topic, or you are genuinely unsure — never guess to appear confident.
- urgency, implied_job_type, sentiment: read only from what the message actually says. implied_job_type is null unless a specific kind of job is clearly implied.
- safety_tag: set only when the message is spam, abusive, a scam/phishing attempt, a medical question, a legal question, or a request genuinely outside what this kind of business could ever help with. NEVER set it when primary_intent is EMERGENCY or COMPLAINT — a gas leak, a safety emergency, or a customer complaint is always something this business needs to handle, never "unsupported," regardless of exactly what's being asked. Otherwise null.

2) UPDATE the conversation state. You are given the PREVIOUS state (where this conversation already was) — your job is to move it forward, not to re-derive it from nothing:
- stage: understand (first contact, nothing established yet) -> diagnose (working out what the problem/need actually is) -> collect (gathering the specific details still needed: location, timing, etc.) -> quote_or_book (enough is known to offer a price or a visit) -> confirm (a booking has been proposed/made) -> waiting (confirmed, nothing further needed until the job happens) -> completed (the job has happened) -> closed (the conversation ended without becoming a job, or is genuinely finished). Never advance to quote_or_book or confirm while slots.issue is still null — a booking needs to know what the job actually is before it can be offered, even if timing/location came up first. NEVER move backwards from the previous stage unless the customer has clearly started a brand new, unrelated request in the same thread — in that case treat it as a fresh conversation and restart from "understand".
- slots: carry forward every slot value from the previous state unchanged unless this message adds or corrects one. issue = the problem/job in a few words. location = postcode/area if given. preferred_time = whatever day/time the customer has proposed, in their own words (e.g. "tomorrow morning", "around 4pm") — if the customer gives a new time, replace the old one; if they haven't mentioned timing yet, keep it null.
- open_question: your best guess at what will still be outstanding after this turn, in a few words (e.g. "preferred time", "postcode"), or null if you expect nothing to be outstanding. This is a provisional estimate — the actual reply-writing step may ask something different and will correct this afterward, so don't overthink it.
- greeting_given: true if a greeting has already happened anywhere in this thread (including the previous state already being true) — once true, it stays true.
- last_topic: a short label for what the live exchange is actually about right now (e.g. "radiator repair booking", "call-out fee question", "casual chat") — replace it when the topic genuinely changes, keep it when it doesn't.

3) TRACK the goal and commitments — a layer above stage. Stage answers "where are we in the goal." Goal answers "what is the customer actually trying to achieve," and doesn't change just because they ask a quick side-question.
- goal.type: what the customer is fundamentally here for (book_appointment, change_booking, cancel_booking, get_pricing, get_information, make_payment, report_problem, make_complaint, handle_emergency, general_chat). Carry the previous goal forward unchanged UNLESS this message represents a genuinely different underlying request, not just a side-question within the current one — a call-out-fee question asked mid-booking does NOT change the goal (still book_appointment; just answer the price question and continue), but "actually, forget that, I want to cancel my Tuesday booking instead" DOES change it. When the goal genuinely changes, also reset stage to "understand" for the new goal — but do not clear commitments, past facts may still be relevant.
- goal.status: in_progress by default; completed once the goal is genuinely achieved (booking confirmed, question answered, payment resolved); escalated if it's been handed to the owner (complaint, emergency, anything requiring_escalation); abandoned only if the customer explicitly said they no longer want to proceed.
- commitments: the running ledger of facts and questions that don't fit the four fixed slots — carry every item from the previous state forward, updating status where this message resolves one, and appending new ones. Never delete an item, only change its status or add to the list. Three kinds: "customer_fact" (something the customer told you unprompted, e.g. "niece will be home", "I'm at work until 5") — always status "resolved" the moment it's stated, since a stated fact isn't waiting on anything. "customer_question" (something the customer asked you) — "outstanding" until your reply actually answers it, then "resolved". "receptionist_question" (something you asked the customer) — "outstanding" until the customer's message actually answers it, then "resolved". Before marking anything resolved, check this message actually resolves it — don't mark it resolved just because time has passed. An item that stays "outstanding" across multiple turns means exactly that: still waiting, not forgotten, and never something to silently re-ask as if it were new — the reply should acknowledge it's still open, not repeat the question fresh as though this were the first time.

Never invent facts. You are classifying and tracking state, not drafting a reply.`;

interface RawClassification {
  primary_intent: Intent;
  secondary_intents: Intent[];
  confidence: UnderstandingConfidence;
  urgency: MeaningEntities["urgency"];
  implied_job_type: string | null;
  sentiment: MeaningEntities["sentiment"];
  safety_tag: SafetyTag;
  conversation_state: unknown;
}

function isIntent(value: unknown): value is Intent {
  return typeof value === "string" && (INTENTS as readonly string[]).includes(value);
}

/** Defensive parsing — the model's output is never trusted blindly.
 * Anything that doesn't validate falls back to the safe, wide UNCLEAR
 * classification rather than propagating a malformed value downstream. */
function toUnderstandingResult(raw: unknown, messageText: string, priorState: ConversationState): UnderstandingResult {
  const patternEntities = extractPatternEntities(messageText);
  const fallback: UnderstandingResult = {
    primaryIntent: "UNCLEAR",
    secondaryIntents: [],
    confidence: "unknown",
    patternEntities,
    meaningEntities: { urgency: "none", impliedJobType: null, sentiment: "neutral" },
    safetyTag: null,
    conversationState: priorState,
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
    conversationState: toConversationState(r.conversation_state),
  };
}

export async function classifyMessage(
  messageText: string,
  priorState: ConversationState = EMPTY_CONVERSATION_STATE,
  recentHistory: { direction: "inbound" | "outbound"; body: string }[] = []
): Promise<UnderstandingResult> {
  try {
    const historyBlock =
      recentHistory.length > 0
        ? `\n\nMost recent messages in this thread, oldest first (for context only — trust PREVIOUS STATE over this for anything it already covers):\n${recentHistory
            .map((m) => `${m.direction === "inbound" ? "Customer" : "Receptionist"}: ${m.body}`)
            .join("\n")}`
        : "";

    const userContent = `PREVIOUS STATE: ${JSON.stringify(priorState)}${historyBlock}\n\nNEW MESSAGE from the customer: "${messageText}"`;

    const result = await getCompletion({
      tier: "small",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      jsonSchema: { name: "understanding_classification", schema: RESPONSE_SCHEMA },
      maxOutputTokens: 500,
    });
    return toUnderstandingResult(result.data, messageText, priorState);
  } catch (err) {
    // A classification failure must never block the pipeline outright —
    // it degrades to the safe, wide fallback (fetch everything bounded,
    // let the Safety Layer hold the draft on low confidence) rather than
    // throwing and losing the message entirely. State is carried forward
    // unchanged rather than reset, since we genuinely don't know it changed.
    console.error("[reply-engine] classification failed:", err);
    return {
      primaryIntent: "UNCLEAR",
      secondaryIntents: [],
      confidence: "unknown",
      patternEntities: extractPatternEntities(messageText),
      meaningEntities: { urgency: "none", impliedJobType: null, sentiment: "neutral" },
      safetyTag: null,
      conversationState: priorState,
    };
  }
}
