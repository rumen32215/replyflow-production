import type { UnderstandingResult } from "../understanding/types";
import type { GenerationResult } from "../prompt/types";
import type { Fact } from "../prompt/facts";
import { decisionCategoryFor, meetsConfidence } from "./decision-categories";

/**
 * The deterministic Safety Layer (Sprint 9 §6) — not AI. Three checks,
 * all must pass before a reply could ever be considered for auto-send:
 * confidence gate, fact-grounding, escalation category. Sprint 10A's
 * own scope: this evaluates the real logic and persists the result for
 * transparency, but the orchestrator always creates a draft requiring
 * approval regardless of the outcome — auto-send is not implemented
 * until a later sprint (Sprint 9 §14, build-order step 7).
 */
export interface SafetyEvaluation {
  category: string;
  requiresEscalation: boolean;
  escalationReason: string | null;
  groundingFailed: boolean;
  wouldAutoSend: boolean;
  reasons: string[];
}

export function evaluateSafety(input: {
  understanding: UnderstandingResult;
  generation: GenerationResult;
  facts: Fact[];
}): SafetyEvaluation {
  const { understanding, generation, facts } = input;
  const decision = decisionCategoryFor(understanding.primaryIntent);
  const reasons: string[] = [];

  // Check 1 — fact-grounding: every fact id the draft claims to rely on
  // must actually exist among the facts that were sent. A citation to a
  // fact id that was never provided means the draft is not grounded in
  // real data (Sprint 9 §6).
  const knownFactIds = new Set(facts.map((f) => f.id));
  const ungroundedCitations = generation.factsUsed.filter((id) => !knownFactIds.has(id));
  let groundingFailed = ungroundedCitations.length > 0;
  if (groundingFailed) {
    reasons.push(`Cited fact id(s) not present in what was sent: ${ungroundedCitations.join(", ")}.`);
  }

  // Sprint A (Grounded Facts) — this used to only add a reason string
  // without ever actually setting groundingFailed, so it never blocked
  // anything (a real bug: a price stated with zero cited facts still
  // cleared the gate). Widened beyond price/guarantee to catch invented
  // operational instructions too — live testing found the model telling
  // a customer to "ensure the stopcock is accessible" with zero facts
  // cited, nothing configured anywhere for this business. The rule the
  // brief asked for: "she should either know it or say she doesn't" —
  // any specific instruction with no citation behind it fails grounding,
  // not just prices.
  const hasUncitedPriceClaim =
    Boolean(generation.draftReply) && /£\s?\d|\bfree\b|\bguarantee/i.test(generation.draftReply) && generation.factsUsed.length === 0;
  const hasUncitedInstruction =
    Boolean(generation.draftReply) &&
    /\b(please ensure|make sure|kindly ensure|please have|you'll need to have|you will need to have|please arrange for|please clear|clear access)\b/i.test(
      generation.draftReply
    ) &&
    generation.factsUsed.length === 0;
  if (hasUncitedPriceClaim || hasUncitedInstruction) {
    groundingFailed = true;
    reasons.push(
      hasUncitedPriceClaim
        ? "Draft states a price, guarantee, or commitment without citing a supporting fact."
        : "Draft gives the customer a specific instruction or requirement without citing a supporting fact."
    );
  }

  // Check 2 — escalation category: the Understanding Engine's safety
  // tag or category-level "always escalate" rule (e.g. Emergency,
  // Complaint) or the generation model's own judgment.
  const requiresEscalation = Boolean(
    generation.requiresEscalation || decision.alwaysEscalate || understanding.safetyTag !== null
  );
  if (decision.alwaysEscalate) reasons.push(`"${decision.category}" always requires the owner's review.`);
  if (generation.requiresEscalation) reasons.push(generation.escalationReason ?? "The draft itself flagged this for escalation.");

  // Check 3 — confidence gate against the Decision Categories table.
  const confidenceCleared = meetsConfidence(generation.confidence, decision.minConfidence);
  if (!confidenceCleared) {
    reasons.push(`Reply confidence "${generation.confidence}" is below the "${decision.minConfidence}" bar required for "${decision.category}".`);
  }

  const wouldAutoSend =
    !decision.neverAutomatic && !requiresEscalation && !groundingFailed && confidenceCleared && Boolean(generation.draftReply);

  return {
    category: decision.category,
    requiresEscalation,
    escalationReason: requiresEscalation ? generation.escalationReason ?? reasons[0] ?? null : null,
    groundingFailed,
    wouldAutoSend,
    reasons,
  };
}
