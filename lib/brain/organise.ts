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
 * v1 shipped with exactly one rule, deliberately: a conversation whose
 * real goal (never inferred from message text — always the Reply
 * Engine's own `ConversationState.goal`, the same field
 * `generate-reply.ts` already computes) has settled into
 * "book_appointment" and isn't abandoned, but has no corresponding
 * `work_cards` row yet. Every other *heuristic* candidate rule
 * considered during design (quote-stage gaps, stale follow-ups,
 * unresolved commitments) is deliberately still deferred — each needs
 * real pilot evidence to design well, not a guess made ahead of any
 * real correction volume.
 *
 * v1.1 (2026-08-02) adds one more rule that is deliberately NOT of
 * that deferred kind: it surfaces an already-confirmed fact (a real
 * `error_events` row already recorded that a specific customer message
 * got no reply at all), not a heuristic guess about business process.
 * Founder principle this answers: "when a function deliberately
 * continues after a failure, should the business owner eventually be
 * aware, even if the immediate [customer-facing] experience remains
 * uninterrupted?" Today's reply-engine failures are recorded
 * (`recordErrorEvent`) but only ever readable by the founder's own
 * admin pages — the owner, whose actual customer this was, never finds
 * out. See `unrepliedMessageRule` below.
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
  /** True when a recent (caller-bounded window) `critical` error_events
   * row recorded that a real customer message on this conversation got
   * no reply_drafts row at all (`reply-engine.pipeline_failure` /
   * `reply-engine.conversation_not_found`) — never a guess, always a
   * fact that already happened and was already durably recorded. */
  hasRecentPipelineFailure: boolean;
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

/** A customer's message was real, arrived, and — per an already-
 * recorded, already-confirmed `error_events` row — never got a reply
 * at all. Deliberately worded plainly and honestly, matching this
 * product's own tone principles: not alarmist, not vague either. */
const unrepliedMessageRule: OrganiseRule = (candidate) => {
  if (!candidate.hasRecentPipelineFailure) return null;
  return {
    id: `organise:unreplied-message:${candidate.conversationId}`,
    conversationId: candidate.conversationId,
    text: `${candidate.customerName} messaged and I wasn't able to reply — worth a quick check`,
    href: `/dashboard/conversations/${candidate.conversationId}`,
  };
};

/** The stage's own rule list — the only thing a future rule needs to
 * extend. Order matters only in that it determines which gap wins when
 * a single conversation matches more than one rule; across different
 * conversations, whichever appears earlier in the caller's candidate
 * list is what surfaces (`buildBrain()` only ever shows one Organise
 * observation at a time) — an accepted v1 limitation, not something
 * this addition changes. */
const RULES: readonly OrganiseRule[] = [unrepliedMessageRule, bookingWithoutWorkCardRule];

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
