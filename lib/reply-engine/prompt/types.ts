/** Reply confidence — the Reply Engine's own signal (Sprint 9 §5),
 * deliberately distinct from the Understanding Engine's classification
 * confidence (Sprint 9.1 §4: "two signals that must never be
 * conflated"). A message can be well-understood and still produce a
 * low-confidence draft reply. */
export type ReplyConfidence = "unknown" | "low" | "medium" | "high" | "verified";

/** The generation LLM's structured output (Sprint 9 §5) — a proposal,
 * never a decision. `factsUsed` are the stable Fact ids (see
 * prompt/facts.ts) the draft actually relied on, which the Safety
 * Layer cross-checks against the real facts that were sent. */
export interface GenerationResult {
  draftReply: string;
  confidence: ReplyConfidence;
  requiresEscalation: boolean;
  escalationReason: string | null;
  factsUsed: string[];
  /** Voice doc 07 §2 "Ending conversations" / §6 Follow-up example:
   * silence is a deliberate, correct outcome, not a gap. True only when
   * the model judges no reply is needed at all — the orchestrator only
   * ever honours this for the same narrow, already-safe category
   * auto-send uses, never for anything requiring escalation. */
  noReplyNeeded: boolean;
  /** Conversation Intelligence Sprint — what, if anything, THIS reply
   * actually asks the customer, in a few words, or null if it asks
   * nothing. The generation call is the one true source for this (it's
   * the one writing the sentence) — the orchestrator uses it to correct
   * conversation_state.openQuestion after the fact, since the
   * classification call's pre-generation guess can't know what wording
   * generation will actually land on. */
  asksQuestion: string | null;
}
