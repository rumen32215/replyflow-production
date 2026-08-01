/**
 * The Organise Checkpoint — Brain Loop step 7 ("Organise") from the
 * ReplyFlow Founder Handbook, Chapter 4: "Every interaction leaves the
 * business more organised than before... nothing should disappear,
 * everything should have a destination."
 *
 * A new, permanent, stable stage in the Brain's reasoning — not a
 * one-off rule bolted onto a page. Future handbook-driven rules get
 * added to RULES below; this file's shape (a candidate in, a gap or
 * nothing out) should never need to change to add one.
 *
 * Deliberately pure and deterministic: no LLM call, no Supabase
 * access, no I/O. Exactly like every other module in lib/brain/ —
 * callers gather the real facts (has this conversation's state already
 * settled on a booking? does a Work Card already exist for it?) and
 * this module only judges what those facts mean. Reasoning, not
 * fetching — the same separation `buildBrain()` itself already holds.
 *
 * v1 ships with exactly one rule, deliberately: a conversation whose
 * real goal (never inferred from message text — always the Reply
 * Engine's own `ConversationState.goal`, the same field
 * `generate-reply.ts` already computes) has settled into
 * "book_appointment" and isn't abandoned, but has no corresponding
 * `work_cards` row yet. Every other candidate rule considered during
 * design (quote-stage gaps, stale follow-ups, unresolved commitments)
 * is deliberately deferred — each needs real pilot evidence to design
 * well, not a guess made ahead of any real correction volume.
 */

export interface OrganiseCandidate {
  conversationId: string;
  customerName: string;
  /** From the real, already-computed ConversationState.goal — never
   * inferred here. True once the goal has settled on a booking and
   * hasn't been abandoned; still true if completed or escalated, since
   * either of those still genuinely implies a Work Card should exist. */
  impliesBooking: boolean;
  /** Whether any work_cards row already exists for this conversation,
   * regardless of its status — existence is all this rule asks. */
  hasWorkCard: boolean;
}

export interface OrganiseGap {
  id: string;
  conversationId: string;
  text: string;
  href: string;
}

type OrganiseRule = (candidate: OrganiseCandidate) => OrganiseGap | null;

const bookingWithoutWorkCardRule: OrganiseRule = (candidate) => {
  if (!candidate.impliesBooking || candidate.hasWorkCard) return null;
  return {
    id: `organise:booking-without-work-card:${candidate.conversationId}`,
    conversationId: candidate.conversationId,
    text: `${candidate.customerName}'s conversation looks like a booking, but there's no Work Card for it yet`,
    href: `/dashboard/conversations/${candidate.conversationId}`,
  };
};

/** The stage's own rule list — the only thing a future rule needs to
 * extend. Order matters only in that it determines which gap appears
 * first when a single conversation somehow matches more than one rule
 * (not possible with v1's single rule, but true once more exist). */
const RULES: readonly OrganiseRule[] = [bookingWithoutWorkCardRule];

export function runOrganiseCheckpoint(candidates: readonly OrganiseCandidate[]): OrganiseGap[] {
  const gaps: OrganiseGap[] = [];
  for (const candidate of candidates) {
    for (const rule of RULES) {
      const gap = rule(candidate);
      if (gap) gaps.push(gap);
    }
  }
  return gaps;
}
