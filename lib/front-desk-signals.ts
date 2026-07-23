/**
 * Front Desk (Owner Experience 01) — pure functions only, no Supabase,
 * no React. Same convention as lib/dashboard-signals.ts: the page
 * fetches real rows, these turn them into display-ready values, kept
 * separate so "what does this number/sentence mean" stays testable in
 * one place. Supersedes lib/mission-control-signals.ts — Mission
 * Control as a separate page is retired into Front Desk itself
 * (having two independently-queried "what needs attention" boards was
 * the real duplication this sprint set out to remove), so this file
 * keeps that module's real logic under the name that now matches
 * where it lives.
 *
 * Every function here is deliberately mechanical — sorting, merging,
 * formatting real rows — never an interpretation or a fabricated
 * insight. "Only real system events" applies as much here as it does
 * to lib/work-card-state.ts.
 */

/* ------------------------------ Attention queue -------------------------------- */

export interface AttentionWaitingConversation {
  kind: "waiting_conversation";
  conversationId: string;
  name: string;
  reason: string;
  minutes: number;
  isEmergency: boolean;
}

export interface AttentionDraftWorkCard {
  kind: "draft_work_card";
  workCardId: string;
  conversationId: string | null;
  issue: string;
  customerName: string;
  minutes: number;
}

export interface AttentionPendingReply {
  kind: "pending_reply";
  draftId: string;
  conversationId: string;
  customerName: string;
  minutes: number;
  requiresEscalation: boolean;
}

export type AttentionItem = AttentionWaitingConversation | AttentionDraftWorkCard | AttentionPendingReply;

function isUrgent(item: AttentionItem): boolean {
  if (item.kind === "waiting_conversation") return item.isEmergency;
  if (item.kind === "pending_reply") return item.requiresEscalation;
  return false;
}

/**
 * The one real "what needs me right now" queue — every kind of thing
 * only the owner can unblock, merged into a single urgency-sorted
 * list instead of three separate boards (waiting conversations, draft
 * Work Cards, pending reply drafts) each claiming to be "the" attention
 * list. Emergencies and escalations always sort first; everything else
 * sorts by how long it's genuinely been waiting — never by which table
 * it came from.
 */
export function buildAttentionQueue(input: {
  waitingConversations: readonly AttentionWaitingConversation[];
  draftWorkCards: readonly AttentionDraftWorkCard[];
  pendingReplies: readonly AttentionPendingReply[];
  limit?: number;
}): AttentionItem[] {
  const items: AttentionItem[] = [...input.waitingConversations, ...input.draftWorkCards, ...input.pendingReplies];

  items.sort((a, b) => {
    const aUrgent = isUrgent(a);
    const bUrgent = isUrgent(b);
    if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;
    return b.minutes - a.minutes;
  });

  return items.slice(0, input.limit ?? 8);
}

export function attentionReason(item: AttentionItem): string {
  switch (item.kind) {
    case "waiting_conversation":
      return item.isEmergency ? "Emergency" : item.reason;
    case "draft_work_card":
      return `${item.issue} · awaiting your approval`;
    case "pending_reply":
      return item.requiresEscalation ? "Reply needs your OK — flagged for you" : "Reply ready for your OK";
  }
}

/* -------------------------------- Activity feed --------------------------------- */

export type ActivityKind = "work_card_started" | "work_card_booked" | "work_card_completed" | "conversation_started" | "escalated";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  text: string;
  occurredAt: string; // ISO
}

/**
 * Merges real, already-timestamped events from Work Cards, reply
 * drafts, and conversations into one chronological feed — every line
 * traces back to a real column already in the database
 * (created_at / approved_at / completed_at), never an inferred or
 * summarised "what happened" narrative. Deliberately does not invent
 * events with no real timestamp behind them — e.g. "collected the
 * address" has no stored moment it happened, only whether `address`
 * is set now, so it's left out rather than guessed at (see
 * DOCS/SPECS/Work-Card-Object.md §6 for the same boundary).
 */
export function buildReceptionistActivity(input: {
  startedWorkCards: readonly { id: string; issue: string; customerName: string; createdAt: string }[];
  bookedWorkCards: readonly { id: string; issue: string; customerName: string; approvedAt: string; scheduledFor: string | null }[];
  completedWorkCards: readonly { id: string; issue: string; customerName: string; completedAt: string }[];
  newConversations: readonly { id: string; name: string; startedAt: string }[];
  escalations: readonly { id: string; reason: string; occurredAt: string }[];
  limit?: number;
}): ActivityEvent[] {
  const events: ActivityEvent[] = [
    ...input.startedWorkCards.map((j) => ({
      id: `work_card_started:${j.id}`,
      kind: "work_card_started" as const,
      text: `Started a booking — ${j.issue} for ${j.customerName}`,
      occurredAt: j.createdAt,
    })),
    ...input.bookedWorkCards.map((j) => ({
      id: `work_card_booked:${j.id}`,
      kind: "work_card_booked" as const,
      text: `Booked ${j.issue} for ${j.customerName}${j.scheduledFor ? ` — ${formatBookedTime(j.scheduledFor)}` : ""}`,
      occurredAt: j.approvedAt,
    })),
    ...input.completedWorkCards.map((j) => ({
      id: `work_card_completed:${j.id}`,
      kind: "work_card_completed" as const,
      text: `Completed ${j.issue} for ${j.customerName}`,
      occurredAt: j.completedAt,
    })),
    ...input.newConversations.map((c) => ({
      id: `conversation_started:${c.id}`,
      kind: "conversation_started" as const,
      text: `New enquiry from ${c.name}`,
      occurredAt: c.startedAt,
    })),
    ...input.escalations.map((e) => ({
      id: `escalated:${e.id}`,
      kind: "escalated" as const,
      text: `Escalated: ${e.reason}`,
      occurredAt: e.occurredAt,
    })),
  ];

  events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return events.slice(0, input.limit ?? 8);
}

function formatBookedTime(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const time = date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
  if (isToday) return `today at ${time}`;
  if (isTomorrow) return `tomorrow at ${time}`;
  return `${date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at ${time}`;
}
