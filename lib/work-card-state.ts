import type { ConversationGroup } from "@/lib/conversations";

/**
 * Mission Control / Front Desk (Owner Experience 01) — what a Work
 * Card's status enum actually means to an owner glancing at it, not
 * the raw database word. Reuses the exact same real, already-stored
 * signals the rest of the product grounds itself in — `status`,
 * `address_confirmed` (Work Card spec §5's soft warning), the linked
 * conversation's group (`lib/conversations.ts`), and the linked
 * conversation's real goal type (Conversation State) — never a new
 * interpretation of any of them, and never a fabricated one.
 */

export type WorkCardStateTone = "emergency" | "attention" | "warning" | "success" | "active" | "neutral";

export interface WorkCardState {
  label: string;
  tone: WorkCardStateTone;
  /** Whether this card is actually blocking on the owner right now —
   * drives whether it's eligible for the Needs Your Attention queue. */
  needsAction: boolean;
}

const STATUS_STATE: Record<string, WorkCardState> = {
  draft: { label: "Needs approval", tone: "attention", needsAction: true },
  new_enquiry: { label: "Needs a decision", tone: "attention", needsAction: true },
  quote_requested: { label: "Needs a decision", tone: "attention", needsAction: true },
  quote_sent: { label: "Needs a decision", tone: "attention", needsAction: true },
  quote_accepted: { label: "Needs a decision", tone: "attention", needsAction: true },
  booked: { label: "Booked", tone: "success", needsAction: false },
  in_progress: { label: "In progress", tone: "active", needsAction: false },
  completed: { label: "Completed", tone: "neutral", needsAction: false },
  cancelled: { label: "Cancelled", tone: "neutral", needsAction: false },
};

const ACTIVE_STATUSES = new Set(["draft", "new_enquiry", "quote_requested", "quote_sent", "quote_accepted", "booked", "in_progress"]);

export interface WorkCardStateInput {
  status: string;
  addressConfirmed: boolean;
  /** The linked conversation's group, if a conversation is linked —
   * `null` for an owner-created Work Card with no conversation. */
  conversationGroup: ConversationGroup | null;
  /** Whether the linked conversation's real goal is `handle_emergency`
   * (Conversation State) — never inferred from the issue text. */
  isEmergency: boolean;
}

/**
 * Overlays stack on top of the base status, most urgent first —
 * a Work Card is never described by more than one state at once, so
 * an emergency always wins over a routine "waiting for address" note.
 */
export function describeWorkCardState(input: WorkCardStateInput): WorkCardState {
  const base = STATUS_STATE[input.status] ?? { label: input.status, tone: "neutral" as const, needsAction: false };
  const isTerminal = input.status === "completed" || input.status === "cancelled";

  if (input.isEmergency && !isTerminal) {
    return { label: "Emergency", tone: "emergency", needsAction: true };
  }

  if ((input.status === "booked" || input.status === "in_progress") && !input.addressConfirmed) {
    return { label: "Waiting for address", tone: "warning", needsAction: true };
  }

  if (input.conversationGroup === "waiting" && (input.status === "booked" || input.status === "in_progress")) {
    return { label: "Customer replied", tone: "attention", needsAction: true };
  }

  return base;
}

/** Whether a Work Card counts as "still open work" at all — the same
 * boundary Front Desk's Today's Work and Waiting For Customer
 * sections both need, so a completed/cancelled card never lingers on
 * either list past its own terminal state (Work Card spec §4). */
export function isActiveWorkCardStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}
