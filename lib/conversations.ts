/**
 * Conversation lifecycle (Conversations V1/V2) — pure functions only.
 *
 * ReplyFlow organises work, not conversations: everything here exists
 * so the important customers find the owner. Priority order is fixed
 * by the doc: Waiting for Owner -> Active -> Booked -> Completed.
 * The legacy 'open'/'closed' statuses stay legal and are mapped in.
 */

export type ConversationStatus =
  | "new"
  | "gathering"
  | "waiting_owner"
  | "booked"
  | "completed"
  | "open" // legacy: reads as waiting (no receptionist replies exist yet)
  | "closed"; // legacy: reads as completed

export type ConversationGroup = "waiting" | "active" | "booked" | "done";

export function groupForStatus(status: string): ConversationGroup {
  switch (status) {
    case "waiting_owner":
    case "open":
      return "waiting";
    case "new":
    case "gathering":
      return "active";
    case "booked":
      return "booked";
    default:
      return "done";
  }
}

export const GROUP_ORDER: ConversationGroup[] = ["waiting", "active", "booked", "done"];

/** Section headings speak like a receptionist, never like a database. */
export const GROUP_LABELS: Record<ConversationGroup, string> = {
  waiting: "Waiting for you",
  active: "I'm looking after these",
  booked: "Booked in",
  done: "Finished",
};

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  new: "New enquiry",
  gathering: "Getting the details",
  waiting_owner: "Waiting for you",
  booked: "Booked",
  completed: "Completed",
  open: "Waiting for you",
  closed: "Completed",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as ConversationStatus] ?? "Enquiry";
}

export interface StoryMoment {
  label: string;
  done: boolean;
  pending?: boolean;
}

/**
 * The conversation timeline — the story, not just the messages
 * (Conversations Experience V2). Derived from what actually happened:
 * photos received, current status. Only true things are ever shown.
 */
export function buildStory(input: {
  status: string;
  messageCount: number;
  photoCount: number;
}): StoryMoment[] {
  const group = groupForStatus(input.status);
  const moments: StoryMoment[] = [{ label: "Customer got in touch", done: input.messageCount > 0 }];

  if (input.photoCount > 0) {
    moments.push({
      label: `${input.photoCount === 1 ? "Photo" : `${input.photoCount} photos`} received`,
      done: true,
    });
  }

  if (group === "waiting") {
    moments.push({ label: "Waiting for you", done: false, pending: true });
  } else if (group === "active") {
    moments.push({ label: "I'm gathering the details", done: false, pending: true });
  } else if (group === "booked") {
    moments.push({ label: "Appointment booked", done: true });
  } else {
    moments.push({ label: "Conversation completed", done: true });
  }

  return moments;
}
