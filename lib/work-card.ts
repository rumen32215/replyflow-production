import type { ConversationState } from "@/lib/reply-engine/understanding/state";

/**
 * The Work Card pipeline (Track B, DOCS/SPECS/Work-Card-Object.md §2) —
 * assembles a Work Card's automatic fields from a conversation's real
 * Conversation State. Deterministic, not an LLM call, for the same
 * reason `buildHandoverRecap` is: every field here is either a direct
 * copy of something the receptionist already wrote down (a slot, a
 * resolved commitment), or left blank. Nothing is paraphrased or
 * summarised by a model, so nothing here can invent a fact about the
 * job. The owner reviews and can edit every field before approving —
 * this only saves the retyping, it never removes the review.
 */

export interface WorkCardDraftFields {
  /** From Conversation State's `issue` slot. Empty string, never a
   * guess, if the receptionist never actually captured one. */
  issue: string;
  /** From the `location` slot — a proposal only. Always paired with
   * `addressConfirmed: false`; confirming it is the owner's job. */
  address: string | null;
  /** Every resolved customer_fact commitment, one per line — parking,
   * access, anything volunteered mid-conversation. Not classified into
   * separate categories: guessing which bucket a fact belongs in would
   * be exactly the kind of invention the Commitments ledger exists to
   * avoid. Null when nothing was volunteered. */
  collectedDetails: string | null;
  /** A plain-language recap built only from slots and resolved
   * commitments — never a generated paraphrase of the transcript. */
  conversationSummary: string | null;
}

export function buildWorkCardDraft(state: ConversationState): WorkCardDraftFields {
  const collected = state.commitments
    .filter((c) => c.kind === "customer_fact" && c.status === "resolved")
    .map((c) => c.text.trim())
    .filter(Boolean);

  const summaryLines: string[] = [];
  if (state.slots.issue) summaryLines.push(state.slots.issue);
  if (state.slots.preferredTime) summaryLines.push(`Preferred time: ${state.slots.preferredTime}.`);
  if (state.slots.location) summaryLines.push(`Location: ${state.slots.location}.`);
  for (const fact of collected) summaryLines.push(fact);

  return {
    issue: state.slots.issue?.trim() ?? "",
    address: state.slots.location?.trim() || null,
    collectedDetails: collected.length > 0 ? collected.join("\n") : null,
    conversationSummary: summaryLines.length > 0 ? summaryLines.join(" ") : null,
  };
}
