import type { ConversationState } from "@/lib/reply-engine/understanding/state";
import { formatDateTime } from "@/lib/work-card-format";

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
  /** ReplyFlow V4 (Conversation Episodes) — the customer's actual
   * requested time, already resolved against the real calendar date
   * ("tomorrow at 10am" -> a real ISO timestamp) by the Understanding
   * Engine. Distinct from `preferredTime` (the free-text slot used only
   * for the human-readable summary line above) — this is the one value
   * that should ever pre-fill a Work Card's `scheduled_for`. Was
   * computed since the V4 rollout but never wired into the create-job
   * form, which is why a Work Card's scheduled_for previously only ever
   * captured a date, silently losing whatever time the customer asked
   * for. */
  preferredTimeResolved: string | null;
}

/** Capitalizes only the first character — a plain string transform, not
 * a rewrite, so it never risks changing meaning (a customer's own
 * wording, proper nouns, etc. are left exactly as stated). */
function sentenceCase(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Drops any collected commitment that's already redundant with the
 * location slot (case-insensitive substring containment) — a customer
 * who volunteers "it's NW1 1AA" mid-conversation shouldn't have that
 * postcode appear a second time once it's also captured as `location`. */
function dedupeAgainstLocation(collected: string[], location: string | null): string[] {
  const loc = location?.trim().toLowerCase();
  if (!loc) return collected;
  return collected.filter((c) => !c.toLowerCase().includes(loc));
}

export function buildWorkCardDraft(state: ConversationState): WorkCardDraftFields {
  const collected = dedupeAgainstLocation(
    state.commitments
      .filter((c) => c.kind === "customer_fact" && c.status === "resolved")
      .map((c) => c.text.trim())
      .filter(Boolean),
    state.slots.location
  );

  // Prefer the resolved, absolute appointment time over the customer's
  // own relative wording ("next Monday") whenever it's known — the raw
  // wording is kept only as a fallback for when nothing could be
  // resolved yet.
  const resolvedTimeLabel = formatDateTime(state.slots.preferredTimeResolved);

  const summaryLines: string[] = [];
  if (state.slots.issue) summaryLines.push(sentenceCase(state.slots.issue.trim()));
  if (resolvedTimeLabel) {
    summaryLines.push(`Preferred time: ${resolvedTimeLabel}.`);
  } else if (state.slots.preferredTime) {
    summaryLines.push(`Preferred time: ${state.slots.preferredTime}.`);
  }
  if (state.slots.location) summaryLines.push(`Location: ${state.slots.location}.`);
  for (const fact of collected) summaryLines.push(fact);

  return {
    issue: sentenceCase(state.slots.issue?.trim() ?? ""),
    address: state.slots.location?.trim() || null,
    collectedDetails: collected.length > 0 ? collected.join("\n") : null,
    conversationSummary: summaryLines.length > 0 ? summaryLines.join(" ") : null,
    preferredTimeResolved: state.slots.preferredTimeResolved,
  };
}
