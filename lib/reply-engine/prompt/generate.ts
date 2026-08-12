import "server-only";
import { getCompletion } from "../llm/client";
import type { UnderstandingResult } from "../understanding/types";
import type { ReplyContext } from "../context/types";
import { buildPrompt } from "./build";
import type { Fact } from "./facts";
import type { GenerationResult, ReplyConfidence } from "./types";
import { recordErrorEvent } from "@/lib/error-events";

interface RawGeneration {
  draft_reply: string;
  confidence: ReplyConfidence;
  requires_escalation: boolean;
  escalation_reason: string | null;
  facts_used: string[];
  no_reply_needed: boolean;
  asks_question: string | null;
  resolves_commitments: string[];
}

/**
 * Live testing found gpt-4o-mini emitting the literal string "null"
 * (sometimes with surrounding whitespace, sometimes "NULL") for
 * escalation_reason instead of using the schema's actual null option
 * (build.ts already declares it type: ["string", "null"]) — a real
 * small-model structured-output quirk. Left unnormalized, this string
 * is truthy, so evaluate.ts's `generation.escalationReason ?? reasons[0]`
 * fallback picks it over a real deterministic backstop reason (deposit,
 * reschedule, payment), and the owner sees the literal word "null" in
 * the escalation banner instead of an explanation. A genuinely empty/
 * whitespace-only reason is the same failure shape. Everything else
 * passes through completely unchanged — this only ever narrows null-
 * like placeholders, never rewrites a real reason.
 */
function normalizeEscalationReason(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null") return null;
  return raw;
}

/** Exported for direct testing — pure, no I/O (unlike generateReplyDraft
 * below, which makes a real LLM call). */
export function toGenerationResult(raw: unknown): GenerationResult {
  const fallback: GenerationResult = {
    draftReply: "",
    confidence: "unknown",
    requiresEscalation: true,
    escalationReason: "The reply could not be generated safely — please handle this one yourself.",
    factsUsed: [],
    noReplyNeeded: false,
    asksQuestion: null,
    resolvesCommitments: [],
  };

  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Partial<RawGeneration>;

  const noReplyNeeded = Boolean(r.no_reply_needed);
  // An empty draft_reply is only ever valid when the model explicitly
  // chose silence — otherwise it's the same "couldn't generate safely"
  // failure this fallback has always represented (Voice doc 07 §2:
  // silence must be a deliberate choice, never a default for "nothing
  // came back").
  if (typeof r.draft_reply !== "string" || (!r.draft_reply.trim() && !noReplyNeeded)) return fallback;

  const confidence: ReplyConfidence =
    r.confidence === "low" || r.confidence === "medium" || r.confidence === "high" || r.confidence === "verified"
      ? r.confidence
      : "unknown";

  return {
    draftReply: r.draft_reply.trim(),
    confidence,
    requiresEscalation: Boolean(r.requires_escalation),
    escalationReason: normalizeEscalationReason(r.escalation_reason),
    factsUsed: Array.isArray(r.facts_used) ? r.facts_used.filter((f): f is string => typeof f === "string") : [],
    noReplyNeeded,
    asksQuestion: typeof r.asks_question === "string" && r.asks_question.trim() ? r.asks_question.trim() : null,
    resolvesCommitments: Array.isArray(r.resolves_commitments)
      ? r.resolves_commitments.filter((t): t is string => typeof t === "string")
      : [],
  };
}

export interface GeneratedReply {
  generation: GenerationResult;
  facts: Fact[];
}

/**
 * Reply generation — the Reply Engine's own, larger LLM call (Sprint 9
 * §5), unchanged in shape by the Understanding Engine (Sprint 9.1 §7).
 * A failure here degrades to a fallback that always requires
 * escalation, never a thrown error that would lose the message.
 */
export async function generateReplyDraft(
  businessId: string,
  context: ReplyContext,
  understanding: UnderstandingResult,
  options: { isFirstMessage: boolean } = { isFirstMessage: false }
): Promise<GeneratedReply> {
  const { messages, jsonSchema, facts } = buildPrompt(context, understanding, options);

  try {
    const result = await getCompletion({
      tier: "large",
      messages,
      jsonSchema,
      maxOutputTokens: 500,
      businessId,
      callSite: "prompt.generate",
    });
    return { generation: toGenerationResult(result.data), facts };
  } catch (err) {
    console.error("[reply-engine] generation failed:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "reply-engine.generate_failed",
      businessId,
      message: "generateReplyDraft's completion call failed — degraded to a forced-escalation fallback, message was not lost.",
      error: err,
    });
    return {
      generation: {
        draftReply: "",
        confidence: "unknown",
        requiresEscalation: true,
        escalationReason: "The reply could not be generated — please handle this one yourself.",
        factsUsed: [],
        noReplyNeeded: false,
        asksQuestion: null,
        resolvesCommitments: [],
      },
      facts,
    };
  }
}
