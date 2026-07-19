/**
 * Mission Control — pure functions only, no Supabase, no React. Same
 * convention as lib/dashboard-signals.ts: the page fetches real rows,
 * these turn them into display-ready values, kept separate so "what
 * does this number mean" stays testable and reviewable in one place.
 *
 * Every function here is deliberately mechanical — sorting, counting,
 * averaging real timestamps — never an interpretation or a fabricated
 * insight. Sprint 5's brief is explicit: "do not fabricate AI insight,
 * do not invent confidence values."
 */

import { formatWaitingTime } from "@/lib/dashboard-signals";

export interface WaitingCustomer {
  conversationId: string;
  name: string;
  minutes: number;
}

export interface WaitStats {
  count: number;
  longestMinutes: number | null;
  averageMinutes: number | null;
}

/** Aggregate view of everyone currently waiting — counts, not another
 * copy of the list (Urgent Work already shows the ranked list; this
 * answers "how are we doing on response time overall", matching the
 * original Feature 02 spec's "Customers waiting, Average response
 * time" framing). */
export function computeWaitStats(waiting: readonly WaitingCustomer[]): WaitStats {
  if (waiting.length === 0) return { count: 0, longestMinutes: null, averageMinutes: null };
  const minutes = waiting.map((w) => w.minutes);
  return {
    count: waiting.length,
    longestMinutes: Math.max(...minutes),
    averageMinutes: Math.round(minutes.reduce((sum, m) => sum + m, 0) / minutes.length),
  };
}

export function formatWaitStat(minutes: number | null): string {
  return minutes === null ? "—" : formatWaitingTime(minutes);
}

export type ActivityKind = "job_completed" | "job_created" | "conversation_started";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  text: string;
  occurredAt: string; // ISO
}

/** Merges real events from jobs and conversations into one
 * chronological feed — every line traces back to a real timestamp
 * already in the database (completed_at / created_at), never an
 * inferred or summarised "what happened" narrative. */
export function buildRecentActivity(input: {
  completedJobs: readonly { id: string; jobTitle: string; customerName: string; completedAt: string }[];
  createdJobs: readonly { id: string; jobTitle: string; customerName: string; createdAt: string }[];
  newConversations: readonly { id: string; name: string; createdAt: string }[];
  limit?: number;
}): ActivityEvent[] {
  const events: ActivityEvent[] = [
    ...input.completedJobs.map((j) => ({
      id: `job_completed:${j.id}`,
      kind: "job_completed" as const,
      text: `Completed ${j.jobTitle} for ${j.customerName}`,
      occurredAt: j.completedAt,
    })),
    ...input.createdJobs.map((j) => ({
      id: `job_created:${j.id}`,
      kind: "job_created" as const,
      text: `New job — ${j.jobTitle} for ${j.customerName}`,
      occurredAt: j.createdAt,
    })),
    ...input.newConversations.map((c) => ({
      id: `conversation_started:${c.id}`,
      kind: "conversation_started" as const,
      text: `New enquiry from ${c.name}`,
      occurredAt: c.createdAt,
    })),
  ];

  events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return events.slice(0, input.limit ?? 8);
}
