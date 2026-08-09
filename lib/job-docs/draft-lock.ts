/**
 * ReplyFlow 2.0, Phase 2A hardening (BUG-14) — pure helpers behind the
 * draft-generation lock in app/api/job-docs/[id]/draft/route.ts. The
 * actual mutual exclusion happens there, atomically, via a single
 * conditional UPDATE against job_docs.draft_generating_at — these
 * functions only compute the shared staleness threshold and the "is
 * this lock free" rule that the SQL WHERE clause mirrors, so that rule
 * has unit coverage without needing a database.
 */

/** Generous vs. a normal draft generation call (a single completion,
 * typically well under 30s) — only matters if a request dies mid-flight
 * without ever reaching the route's release step. */
export const DRAFT_LOCK_STALE_MS = 2 * 60 * 1000;

export function draftLockStaleThreshold(now: Date, staleMs: number = DRAFT_LOCK_STALE_MS): string {
  return new Date(now.getTime() - staleMs).toISOString();
}

/** Mirrors the route's SQL condition (draft_generating_at is null, or
 * older than the stale threshold) — kept here only so that rule's
 * semantics are unit-testable; the database enforces the real
 * concurrency guard atomically, in the route, not this function. */
export function isDraftLockFree(lockedAt: string | null, now: Date, staleMs: number = DRAFT_LOCK_STALE_MS): boolean {
  if (!lockedAt) return true;
  return new Date(lockedAt).getTime() < now.getTime() - staleMs;
}
