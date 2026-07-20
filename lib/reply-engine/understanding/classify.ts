import "server-only";
import { getCompletion } from "../llm/client";
import { extractPatternEntities } from "./entities";
import { INTENTS, type Intent, type MeaningEntities, type SafetyTag, type UnderstandingConfidence, type UnderstandingResult } from "./types";

/**
 * The Understanding Engine's one model call (Sprint 9.1 §2, §7): small,
 * cheap, fast — returns intent + meaning-shaped entities + confidence
 * together, not as separate calls. Pattern-shaped entities never touch
 * the model at all (see entities.ts) — they're merged in afterwards.
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
  },
  required: [
    "primary_intent",
    "secondary_intents",
    "confidence",
    "urgency",
    "implied_job_type",
    "sentiment",
    "safety_tag",
  ],
} as const;

const SYSTEM_PROMPT = `You classify one inbound WhatsApp message to a UK trade/service business (e.g. plumber, electrician). Decide:
- primary_intent: the single best-fitting category for what the customer wants.
- secondary_intents: any other categories genuinely also present (compound messages are real, e.g. "Thanks for yesterday, what's your call-out fee?" = SOCIAL + PRICING_INQUIRY). Empty array if none.
- confidence: how sure you are about primary_intent. Use "low" whenever the message is ambiguous, off-topic, or you are genuinely unsure — never guess to appear confident.
- urgency, implied_job_type, sentiment: read only from what the message actually says. implied_job_type is null unless a specific kind of job is clearly implied.
- safety_tag: set only when the message is spam, abusive, a scam/phishing attempt, a medical question, a legal question, or a request genuinely outside what this kind of business could ever help with. Otherwise null.
Never invent facts. Classify only — you are not drafting a reply.`;

interface RawClassification {
  primary_intent: Intent;
  secondary_intents: Intent[];
  confidence: UnderstandingConfidence;
  urgency: MeaningEntities["urgency"];
  implied_job_type: string | null;
  sentiment: MeaningEntities["sentiment"];
  safety_tag: SafetyTag;
}

function isIntent(value: unknown): value is Intent {
  return typeof value === "string" && (INTENTS as readonly string[]).includes(value);
}

/** Defensive parsing — the model's output is never trusted blindly.
 * Anything that doesn't validate falls back to the safe, wide UNCLEAR
 * classification rather than propagating a malformed value downstream. */
function toUnderstandingResult(raw: unknown, messageText: string): UnderstandingResult {
  const patternEntities = extractPatternEntities(messageText);
  const fallback: UnderstandingResult = {
    primaryIntent: "UNCLEAR",
    secondaryIntents: [],
    confidence: "unknown",
    patternEntities,
    meaningEntities: { urgency: "none", impliedJobType: null, sentiment: "neutral" },
    safetyTag: null,
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
  };
}

export async function classifyMessage(messageText: string): Promise<UnderstandingResult> {
  try {
    const result = await getCompletion({
      tier: "small",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: messageText },
      ],
      jsonSchema: { name: "understanding_classification", schema: RESPONSE_SCHEMA },
      maxOutputTokens: 300,
    });
    return toUnderstandingResult(result.data, messageText);
  } catch (err) {
    // A classification failure must never block the pipeline outright —
    // it degrades to the safe, wide fallback (fetch everything bounded,
    // let the Safety Layer hold the draft on low confidence) rather than
    // throwing and losing the message entirely.
    console.error("[reply-engine] classification failed:", err);
    return {
      primaryIntent: "UNCLEAR",
      secondaryIntents: [],
      confidence: "unknown",
      patternEntities: extractPatternEntities(messageText),
      meaningEntities: { urgency: "none", impliedJobType: null, sentiment: "neutral" },
      safetyTag: null,
    };
  }
}
