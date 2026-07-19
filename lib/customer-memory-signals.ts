/**
 * Customer Memory — pure functions only, no Supabase, no React. Same
 * convention as lib/dashboard-signals.ts and lib/mission-control-signals.ts.
 *
 * There is no dedicated "customers" table — a customer is a real
 * `conversations` row (unique per business_id + customer_phone), and
 * their history is their real `jobs` rows. Every function below is
 * mechanical: counting, sorting, and phrasing facts that already
 * exist. Nothing here infers a preference from message content,
 * predicts a service date, or fabricates a relationship detail —
 * Sprint 7's brief is explicit: "do not fabricate memories, do not
 * invent AI conclusions."
 */

import { confidenceLabelFor } from "@/lib/brain";
import { formatWaitingTime } from "@/lib/dashboard-signals";

export interface CustomerJob {
  id: string;
  jobTitle: string;
  status: string;
  scheduledFor: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
}

/**
 * Relationship Strength — Feature 12 UI: "Instead of a score, display:
 * New Customer / Growing Relationship / Regular Customer / Trusted
 * Customer / VIP Customer." Thresholds are a transparent count of real
 * completed jobs — not a hidden or weighted score, so the label is
 * always traceable back to a fact the owner can verify.
 */
export type RelationshipStrength =
  | "New Customer"
  | "Growing Relationship"
  | "Regular Customer"
  | "Trusted Customer"
  | "VIP Customer";

export function relationshipStrengthFor(completedJobCount: number): RelationshipStrength {
  if (completedJobCount >= 6) return "VIP Customer";
  if (completedJobCount >= 4) return "Trusted Customer";
  if (completedJobCount >= 2) return "Regular Customer";
  if (completedJobCount >= 1) return "Growing Relationship";
  return "New Customer";
}

/**
 * "Confidence" here means profile completeness — how much this
 * customer's real record actually contains — reusing the exact same
 * qualitative vocabulary (Learning/Growing/Complete) the Shared Brain
 * already uses everywhere else, via the same `confidenceLabelFor`
 * function, so a label means the same thing across the whole product.
 * Never a business-wide Brain concept — this is scoped to one customer.
 */
export function computeProfileConfidence(input: {
  hasName: boolean;
  jobCount: number;
  hasAnyNotes: boolean;
}): { percent: number; label: ReturnType<typeof confidenceLabelFor> } {
  let score = 0;
  if (input.hasName) score += 34;
  if (input.jobCount > 0) score += 33;
  if (input.hasAnyNotes) score += 33;
  const percent = Math.min(100, score);
  return { percent, label: confidenceLabelFor(percent) };
}

/** One point in the customer's real history — only ever built from an
 * actual timestamp already in the database. */
export interface TimelineEvent {
  id: string;
  label: string;
  occurredAt: string;
  kind: "enquiry" | "scheduled" | "completed" | "cancelled";
}

/**
 * Notes deliberately never appear here even though `CustomerJob.notes`
 * is available — they already have a home in the "Notes from past
 * jobs" memory card. The timeline tells the chronology; it doesn't
 * re-quote reference detail (found and fixed during Sprint 7
 * screenshot review — notes were appearing twice on the page).
 */
export function buildRelationshipTimeline(input: {
  conversationStartedAt: string;
  jobs: readonly CustomerJob[];
}): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: "enquiry",
      label: "First got in touch",
      occurredAt: input.conversationStartedAt,
      kind: "enquiry",
    },
  ];

  for (const job of input.jobs) {
    events.push({
      id: `job-created:${job.id}`,
      label: job.status === "cancelled" ? `Enquired about ${job.jobTitle}` : `Booked in for ${job.jobTitle}`,
      occurredAt: job.createdAt,
      kind: job.status === "cancelled" ? "cancelled" : "scheduled",
    });
    if (job.completedAt) {
      events.push({
        id: `job-completed:${job.id}`,
        label: `Completed — ${job.jobTitle}`,
        occurredAt: job.completedAt,
        kind: "completed",
      });
    }
  }

  events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  return events;
}

/**
 * The centre panel's opening paragraph — Feature 12 UI: "The centre
 * panel begins with a natural summary." Every sentence maps to a real
 * fact; a fact that isn't known is simply not mentioned, never guessed.
 */
export function buildRelationshipSummary(input: {
  name: string;
  conversationStartedAt: string;
  completedJobCount: number;
  mostRecentJob: CustomerJob | null;
  waitingMinutes: number | null;
}): string {
  const since = new Date(input.conversationStartedAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const parts: string[] = [`${input.name} has been in touch with you since ${since}.`];

  if (input.completedJobCount > 0) {
    parts.push(
      `You've completed ${input.completedJobCount} ${input.completedJobCount === 1 ? "job" : "jobs"} for ${input.name}${
        input.mostRecentJob ? ` — most recently ${input.mostRecentJob.jobTitle.toLowerCase()}` : ""
      }.`
    );
  } else {
    parts.push(`Nothing has been completed for ${input.name} yet.`);
  }

  if (input.waitingMinutes !== null) {
    parts.push(`${input.name} is waiting on a reply right now (${formatWaitingTime(input.waitingMinutes)}).`);
  }

  return parts.join(" ");
}

/** One genuinely useful, rule-based suggestion — never random (Feature
 * 12 UI: "No recommendation should feel random"). Every branch only
 * fires from a real, checkable fact. */
export interface SuggestedAction {
  id: string;
  text: string;
  actionLabel: string;
  actionHref: string;
}

export function buildSuggestedActions(input: {
  conversationId: string;
  name: string;
  waitingMinutes: number | null;
  draftJob: { id: string; jobTitle: string } | null;
  upcomingJob: { jobTitle: string; scheduledFor: string } | null;
  monthsSinceLastActivity: number | null;
  completedJobCount: number;
}): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  if (input.waitingMinutes !== null) {
    actions.push({
      id: "reply",
      text: `${input.name} is waiting on a reply (${formatWaitingTime(input.waitingMinutes)}).`,
      actionLabel: "Reply now",
      actionHref: `/dashboard/conversations/${input.conversationId}`,
    });
  }

  if (input.draftJob) {
    actions.push({
      id: "approve-draft",
      text: `A draft booking for "${input.draftJob.jobTitle}" is waiting on your approval.`,
      actionLabel: "Review draft",
      actionHref: `/dashboard/conversations/${input.conversationId}`,
    });
  }

  if (input.upcomingJob) {
    const date = new Date(input.upcomingJob.scheduledFor).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    actions.push({
      id: "upcoming",
      text: `${input.upcomingJob.jobTitle} is booked in for ${date}.`,
      actionLabel: "View diary",
      actionHref: "/dashboard/availability",
    });
  }

  // A generic, honestly-framed nudge — never a fabricated prediction
  // about *why* they might be due contact (no service-interval data
  // exists to support that), just the real gap in time.
  if (
    !input.waitingMinutes &&
    !input.draftJob &&
    !input.upcomingJob &&
    input.completedJobCount > 0 &&
    input.monthsSinceLastActivity !== null &&
    input.monthsSinceLastActivity >= 6
  ) {
    actions.push({
      id: "check-in",
      text: `It's been ${input.monthsSinceLastActivity} months since your last activity with ${input.name} — might be worth checking in.`,
      actionLabel: "View conversation",
      actionHref: `/dashboard/conversations/${input.conversationId}`,
    });
  }

  return actions;
}
