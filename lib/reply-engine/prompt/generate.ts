import "server-only";
import { getCompletion } from "../llm/client";
import type { UnderstandingResult } from "../understanding/types";
import type { ReplyContext } from "../context/types";
import { buildPrompt } from "./build";
import type { Fact } from "./facts";
import type { GenerationResult, ReplyConfidence } from "./types";

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

function toGenerationResult(raw: unknown): GenerationResult {
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
    escalationReason: typeof r.escalation_reason === "string" ? r.escalation_reason : null,
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
  context: ReplyContext,
  understanding: UnderstandingResult,
  options: { isFirstMessage: boolean } = { isFirstMessage: false }
): Promise<GeneratedReply> {
  const { messages, jsonSchema, facts } = buildPrompt(context, understanding, options);

  try {
    const result = await getCompletion({ tier: "large", messages, jsonSchema, maxOutputTokens: 500 });
    return { generation: toGenerationResult(result.data), facts };
  } catch (err) {
    console.error("[reply-engine] generation failed:", err);
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
