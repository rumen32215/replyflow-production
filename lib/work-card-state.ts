import type { ConversationGroup } from "@/lib/conversations";
import type { ConversationState } from "@/lib/reply-engine/understanding/state";

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

/** Shared across every surface that shows a Work Card's state
 * (Today's Work, the Work Card detail page) — one tone→style mapping,
 * not one copy per component. */
export const WORK_CARD_TONE_STYLE: Record<WorkCardStateTone, string> = {
  emergency: "bg-destructive/10 text-destructive",
  attention: "bg-attention/10 text-attention",
  warning: "bg-amber-100 text-amber-700",
  success: "bg-success/10 text-success",
  active: "bg-accent text-primary",
  neutral: "bg-muted text-muted-foreground",
};

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

/* --------------------------- Job-Ready (ReplyFlow V2) --------------------------- */

/**
 * ReplyFlow V2 (2026-08-11) — "Ready to Quote," the core payoff moment
 * of the whole redefinition. Deliberately not an AI judgement: every
 * field here is either a real Work Card column or the real, already-
 * persisted Conversation State (understanding/state.ts) — the same
 * "never a fabricated one" discipline this file's own header already
 * commits to. A job is genuinely ready only when the information it
 * would take to quote is actually present, never because the AI
 * decided it "felt" ready.
 *
 * Photo is deliberately never a hard requirement — many real plumbing
 * enquiries (a simple booking, no water pressure, a strange noise)
 * are genuinely ready to quote with no photo at all. The only way a
 * missing photo blocks readiness is if the receptionist itself asked
 * for one and is still waiting on an answer — reusing the existing
 * commitments ledger (Sprint B) as the signal, rather than inventing a
 * second "is a photo needed" heuristic that could disagree with what
 * the conversation itself actually asked.
 */
export type JobReadinessItemStatus = "done" | "not_needed" | "outstanding";

export interface JobReadinessItem {
  key: "issue" | "postcode" | "urgency" | "photo";
  label: string;
  status: JobReadinessItemStatus;
}

export interface JobReadiness {
  ready: boolean;
  checklist: JobReadinessItem[];
}

export interface JobReadinessInput {
  issue: string | null;
  /** Work Card's `address` column — the postcode/address proposed from
   * the conversation (see lib/work-card.ts's own field comment). */
  address: string | null;
  /** Null for an owner-created Work Card with no linked conversation —
   * urgency and outstanding photo requests simply can't be known, so
   * neither ever blocks readiness in that case. */
  conversationState: ConversationState | null;
  /** Whether at least one photo has actually been analysed for this
   * conversation (a real `conversation_photos` row) — never inferred
   * from the conversation text. */
  hasAnalysedPhoto: boolean;
}

const PHOTO_MENTION_RE = /photo|picture|image|snap/i;

function urgencyLabel(urgency: ConversationState["urgency"]): string {
  if (urgency === "urgent") return "Urgent";
  if (urgency === "soon") return "Soon";
  return "Not urgent";
}

export function computeJobReadiness(input: JobReadinessInput): JobReadiness {
  const hasIssue = Boolean(input.issue?.trim());
  const hasPostcode = Boolean(input.address?.trim());

  // The only deterministic way to know a photo is still genuinely
  // wanted: the receptionist asked for one (a real, tracked
  // commitment) and nothing has resolved it yet.
  // A real analysed photo is ground truth and always wins over the
  // commitments ledger — the same "ground truth always wins" rule
  // prompt/facts.ts already applies to booking.status — so a photo
  // that arrived before the ledger caught up to marking its request
  // "resolved" never leaves a job stuck as not-ready.
  const outstandingPhotoRequest =
    !input.hasAnalysedPhoto &&
    Boolean(
      input.conversationState?.commitments.some(
        (c) => c.kind === "receptionist_question" && c.status === "outstanding" && PHOTO_MENTION_RE.test(c.text)
      )
    );

  const urgency = input.conversationState?.urgency ?? "none";

  const checklist: JobReadinessItem[] = [
    { key: "issue", label: "Issue understood", status: hasIssue ? "done" : "outstanding" },
    { key: "postcode", label: "Postcode captured", status: hasPostcode ? "done" : "outstanding" },
    // Informational only — "not urgent" is a legitimate, final answer,
    // never a gap waiting to be filled.
    { key: "urgency", label: urgencyLabel(urgency), status: "done" },
    {
      key: "photo",
      label: input.hasAnalysedPhoto ? "Photo reviewed" : outstandingPhotoRequest ? "Waiting on a photo" : "No photo needed",
      status: input.hasAnalysedPhoto ? "done" : outstandingPhotoRequest ? "outstanding" : "not_needed",
    },
  ];

  return { ready: hasIssue && hasPostcode && !outstandingPhotoRequest, checklist };
}

/**
 * ReplyFlow V2 (2026-08-11) — the plain lifecycle stage a plumber
 * actually needs, collapsing the database's eight-value status enum
 * (only some of which have ever had a real UI action — the `quote_*`
 * values in particular were never wired to anything) down to the five
 * that matter. UI-layer only: no migration, no change to the stored
 * `status` column, exactly the "smallest safe change" this pass is
 * scoped to. Deliberately separate from `describeWorkCardState` above
 * — that function answers "what does this card need from me right
 * now" (an action/attention signal, genuinely different information);
 * this one answers the plainer question "what stage is this job at."
 */
export type SimplifiedWorkCardStatus = "new" | "gathering_info" | "ready_to_quote" | "booked" | "done";

export const SIMPLIFIED_STATUS_LABEL: Record<SimplifiedWorkCardStatus, string> = {
  new: "New",
  gathering_info: "Gathering info",
  ready_to_quote: "Ready to quote",
  booked: "Booked",
  done: "Done",
};

export function simplifiedWorkCardStatus(status: string, readiness: JobReadiness): SimplifiedWorkCardStatus {
  if (status === "completed" || status === "cancelled") return "done";
  if (status === "booked" || status === "in_progress") return "booked";
  if (readiness.ready) return "ready_to_quote";
  const hasIssue = readiness.checklist.find((item) => item.key === "issue")?.status === "done";
  return hasIssue ? "gathering_info" : "new";
}
