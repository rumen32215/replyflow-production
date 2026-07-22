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
      },
      required: ["stage", "slots", "open_question", "greeting_given", "last_topic"],
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
- primary_intent: the single best-fitting category for what the customer wants.
- secondary_intents: any other categories genuinely also present (compound messages are real, e.g. "Thanks for yesterday, what's your call-out fee?" = SOCIAL + PRICING_INQUIRY). Empty array if none.
- confidence: how sure you are about primary_intent. Use "low" whenever the message is ambiguous, off-topic, or you are genuinely unsure — never guess to appear confident.
- urgency, implied_job_type, sentiment: read only from what the message actually says. implied_job_type is null unless a specific kind of job is clearly implied.
- safety_tag: set only when the message is spam, abusive, a scam/phishing attempt, a medical question, a legal question, or a request genuinely outside what this kind of business could ever help with. Otherwise null.

2) UPDATE the conversation state. You are given the PREVIOUS state (where this conversation already was) — your job is to move it forward, not to re-derive it from nothing:
- stage: understand (first contact, nothing established yet) -> diagnose (working out what the problem/need actually is) -> collect (gathering the specific details still needed: location, timing, etc.) -> quote_or_book (enough is known to offer a price or a visit) -> confirm (a booking has been proposed/made) -> waiting (confirmed, nothing further needed until the job happens) -> completed (the job has happened) -> closed (the conversation ended without becoming a job, or is genuinely finished). NEVER move backwards from the previous stage unless the customer has clearly started a brand new, unrelated request in the same thread — in that case treat it as a fresh conversation and restart from "understand".
- slots: carry forward every slot value from the previous state unchanged unless this message adds or corrects one. issue = the problem/job in a few words. location = postcode/area if given. preferred_time = whatever day/time the customer has proposed, in their own words (e.g. "tomorrow morning", "around 4pm") — if the customer gives a new time, replace the old one; if they haven't mentioned timing yet, keep it null.
- open_question: exactly what you are currently waiting to hear back on, in a few words (e.g. "preferred time", "postcode"), or null if nothing is currently outstanding. If the previous open_question was just answered by this message, clear it to null (or set it to whatever you're now asking, if you're about to ask something new) — never leave a stale open_question sitting there once it's been answered.
- greeting_given: true if a greeting has already happened anywhere in this thread (including the previous state already being true) — once true, it stays true.
- last_topic: a short label for what the live exchange is actually about right now (e.g. "radiator repair booking", "call-out fee question", "casual chat") — replace it when the topic genuinely changes, keep it when it doesn't.

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
