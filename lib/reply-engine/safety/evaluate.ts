import type { UnderstandingResult } from "../understanding/types";
import type { GenerationResult } from "../prompt/types";
import type { Fact } from "../prompt/facts";
import { decisionCategoryFor, meetsConfidence } from "./decision-categories";

/**
 * The deterministic Safety Layer (Sprint 9 §6) — not AI. Three checks,
 * all must pass before a reply could ever be considered for auto-send:
 * confidence gate, fact-grounding, escalation category. This function
 * only ever computes and returns `wouldAutoSend`; it never sends
 * anything itself. The orchestrator (generate-reply.ts) is what
 * actually acts on it — auto-send is real, but deliberately narrow: a
 * single lowest-risk category ("general"), and only when the owner has
 * explicitly opted in via `auto_reply_general_enabled`. Every other
 * category always creates a draft requiring approval regardless of
 * this evaluation's outcome.
 */
export interface SafetyEvaluation {
  category: string;
  requiresEscalation: boolean;
  escalationReason: string | null;
  groundingFailed: boolean;
  wouldAutoSend: boolean;
  reasons: string[];
}

/** Every £ amount stated in `text`, as numbers ("£20.00" and "£20" both
 * become `20`) so a drafted figure can be compared against a fact's
 * figure by value, not by exact substring. */
function poundAmounts(text: string): number[] {
  const matches = text.match(/£\s?\d+(?:\.\d{1,2})?/g) ?? [];
  return matches.map((m) => parseFloat(m.replace(/£\s?/, "")));
}

/** Every £ amount present across only the facts the draft actually
 * cited (`factsUsed`) — a fact that exists but was never cited
 * contributes nothing, same discipline as the fact-grounding check
 * above. */
function citedPoundAmounts(facts: Fact[], factsUsed: string[]): Set<number> {
  const cited = facts.filter((f) => factsUsed.includes(f.id));
  return new Set(cited.flatMap((f) => poundAmounts(f.text)));
}

export function evaluateSafety(input: {
  understanding: UnderstandingResult;
  generation: GenerationResult;
  facts: Fact[];
}): SafetyEvaluation {
  const { understanding, generation, facts } = input;
  const decision = decisionCategoryFor(understanding.primaryIntent);
  const reasons: string[] = [];

  // Escalation must consider secondary intents too, not just the primary
  // one — a real gap found in adversarial testing: a long, rambling
  // message with a genuine complaint buried inside it (alongside an
  // unrelated booking request) got classified with COMPLAINT correctly
  // present in secondaryIntents, but requiresEscalation stayed false
  // because this whole evaluation only ever looked at primaryIntent's
  // category. Compound messages are real (the Understanding Engine's
  // own context-needs table already unions primary+secondary for
  // fetching context) — the safety layer needs the same discipline.
  const secondaryDecisions = understanding.secondaryIntents.map(decisionCategoryFor);
  const anySecondaryAlwaysEscalate = secondaryDecisions.some((d) => d.alwaysEscalate);
  const anySecondaryNeverAutomatic = secondaryDecisions.some((d) => d.neverAutomatic);

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
  //
  // Hardened again (production test, 2026-08-16): the zero-facts-cited
  // gate above is bypassable — a draft that cites any fact at all, even
  // one wholly unrelated to price, cleared this check while still
  // stating an invented figure (the real bug: a £20 call-out fee was
  // invented while the business's own callout_fee fact was null/
  // unconfirmed, but the draft happened to also cite an unrelated fact
  // like conversation.stage). Every £ figure the draft actually states
  // must now match a £ figure present in the text of a fact that was
  // genuinely cited — not just "was something cited."
  const hasUncitedPriceFigure = poundAmounts(generation.draftReply).some(
    (amount) => !citedPoundAmounts(facts, generation.factsUsed).has(amount)
  );
  const hasUncitedFreeOrGuaranteeClaim =
    Boolean(generation.draftReply) && /\bfree\b|\bguarantee/i.test(generation.draftReply) && generation.factsUsed.length === 0;
  const hasUncitedPriceClaim = hasUncitedPriceFigure || hasUncitedFreeOrGuaranteeClaim;
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

  // Deterministic backstop for a specific overclaim the system prompt
  // alone failed to prevent twice in live testing: a reschedule request
  // ("can we move it to Friday?") getting "your booking is confirmed for
  // Friday" when nothing about the booking actually changed. Cancellation
  // correctly hedges with the same wording; reschedule kept confidently
  // confirming a new date it has no authority to set. Forces escalation
  // (not just a blocked auto-send) — the same class of risk as the
  // original booking-overclaim bug, and prompt wording alone has already
  // been shown not to reliably prevent it here.
  const hasUnconfirmedRescheduleClaim =
    decision.category === "change_booking" &&
    Boolean(generation.draftReply) &&
    /\b(is confirmed|confirmed for|now confirmed|booking is set)\b/i.test(generation.draftReply) &&
    !generation.factsUsed.includes("booking.status");
  if (hasUnconfirmedRescheduleClaim) {
    groundingFailed = true;
    reasons.push("Draft confirms a reschedule to a new date without [booking.status] reflecting that change — only the owner can actually move a booking.");
  }

  // Deterministic backstop for Product Guarantee 2 (the receptionist
  // must always use known business facts when answering customers).
  // Reproduced in live testing: a customer asked a direct payment-
  // method question ("do you take cash?") on a business that had
  // actually taught a payment method (paymentMethods included "Cash"),
  // and the draft gave a generic non-answer instead — the prompt alone
  // didn't reliably reach for a real, known fact every time. The
  // Understanding Engine already classifies this as PAYMENT_QUERY
  // deterministically (Sprint 9.1's own taxonomy), so this reuses that
  // classification rather than adding a second, parallel detector: if
  // the business has taught real payment methods and the draft doesn't
  // cite any of them, that's the same shape of problem as an uncited
  // price claim above, just inverted — a known fact that should have
  // been used, silently ignored rather than invented.
  const isPaymentQuery =
    understanding.primaryIntent === "PAYMENT_QUERY" || understanding.secondaryIntents.includes("PAYMENT_QUERY");
  const taughtPaymentFactIds = facts.filter((f) => f.id.startsWith("profile.payment.")).map((f) => f.id);
  const hasUncitedPaymentAnswer =
    isPaymentQuery &&
    taughtPaymentFactIds.length > 0 &&
    !generation.factsUsed.some((id) => taughtPaymentFactIds.includes(id));
  if (hasUncitedPaymentAnswer) {
    groundingFailed = true;
    reasons.push(
      "Customer asked about payment methods and the business has taught real payment methods, but the draft doesn't answer using any of them."
    );
  }

  // Deterministic backstop for a real invented commitment found in live
  // testing: a draft told a customer "a deposit will be required to
  // secure the booking" with nothing configured anywhere in the schema
  // that could ever support that claim — there is no deposit field on
  // `businesses`, `ai_configurations`, or anywhere else facts.ts reads
  // from (unlike the call-out fee, which has a real
  // `profile.callout_fee` fact when genuinely configured). Unlike the
  // uncited-price/instruction check above, this one isn't "cite a fact
  // or fail" — a deposit claim has literally no fact it could ever cite,
  // so any mention of one always fails grounding and always escalates,
  // the same severity as the reschedule-overclaim backstop.
  const hasUncitedDepositClaim = Boolean(generation.draftReply) && /\bdeposit\b/i.test(generation.draftReply);
  if (hasUncitedDepositClaim) {
    groundingFailed = true;
    reasons.push("Draft mentions a deposit, but nothing about a deposit is configured anywhere for this business.");
  }

  // Check 2 — escalation category: the Understanding Engine's safety
  // tag or category-level "always escalate" rule (e.g. Emergency,
  // Complaint) or the generation model's own judgment.
  //
  // Round 2 (production test, 2026-08-16) — hasUncitedPriceClaim and
  // hasUncitedInstruction used to only set groundingFailed (blocking
  // auto-send) without ever forcing requiresEscalation, unlike every
  // other backstop in this file. That meant a draft with an invented
  // price could be written to reply_drafts looking like a completely
  // ordinary "Suggested reply" — no amber warning banner, nothing
  // telling the owner anything was wrong — even though the system had
  // already, internally, correctly identified it as ungrounded. The
  // detection was never the gap; the owner never seeing it was. Added
  // here so this class of claim gets the exact same visible-warning
  // treatment the reschedule/payment/deposit backstops already do.
  const requiresEscalation = Boolean(
    generation.requiresEscalation ||
      decision.alwaysEscalate ||
      anySecondaryAlwaysEscalate ||
      understanding.safetyTag !== null ||
      hasUnconfirmedRescheduleClaim ||
      hasUncitedPaymentAnswer ||
      hasUncitedDepositClaim ||
      hasUncitedPriceClaim ||
      hasUncitedInstruction
  );
  if (decision.alwaysEscalate) reasons.push(`"${decision.category}" always requires the owner's review.`);
  if (anySecondaryAlwaysEscalate) {
    reasons.push("A secondary intent on this message always requires the owner's review, even though it wasn't the primary one.");
  }
  if (generation.requiresEscalation) reasons.push(generation.escalationReason ?? "The draft itself flagged this for escalation.");

  // Check 3 — confidence gate against the Decision Categories table.
  const confidenceCleared = meetsConfidence(generation.confidence, decision.minConfidence);
  if (!confidenceCleared) {
    reasons.push(`Reply confidence "${generation.confidence}" is below the "${decision.minConfidence}" bar required for "${decision.category}".`);
  }

  const wouldAutoSend =
    !decision.neverAutomatic &&
    !anySecondaryNeverAutomatic &&
    !requiresEscalation &&
    !groundingFailed &&
    confidenceCleared &&
    Boolean(generation.draftReply);

  return {
    category: decision.category,
    requiresEscalation,
    escalationReason: requiresEscalation ? generation.escalationReason ?? reasons[0] ?? null : null,
    groundingFailed,
    wouldAutoSend,
    reasons,
  };
}
