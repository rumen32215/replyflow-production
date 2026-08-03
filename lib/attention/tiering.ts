import type { ConnectionHealthStatus } from "@/lib/front-desk-signals";

/**
 * Owner Attention Architecture (`DOCS/CONSTITUTION/14-ReplyFlow-Owner-Attention-Architecture.md`)
 * §2–§3 — the classification half of the delivery layer. Deliberately
 * the smallest real signal set for V1: pending replies (the dominant
 * Shadowing-era case) and WhatsApp connection health (cheap, single-row,
 * and named directly in the Pilot Plan as something to "catch fast").
 * Organise gaps and learning proposals are real doc-14 sources too, but
 * are deliberately deferred to a fast-follow rather than multiplying
 * the per-business query cost of every cron tick before the core
 * pending-reply pipeline is proven — the same "smallest complete V1"
 * discipline already applied to Learning Memory.
 *
 * Pure and deterministic — no I/O, no Supabase, matching every other
 * module in lib/brain/ and lib/front-desk-signals.ts.
 */

export interface AttentionSnapshot {
  pendingReplyCount: number;
  /** True only when at least one pending reply is escalation-flagged —
   * i.e. it fell into one of the owner's own configured escalation
   * categories (`evaluateSafety()` → `requires_escalation`), never a
   * guess. This is the one fact allowed to cross quiet hours (§4). */
  hasEscalatedPendingReply: boolean;
  connectionStatus: ConnectionHealthStatus;
}

export type AttentionTier = "now" | "today" | "none";

/**
 * doc 14 §2's two axes, collapsed into the three delivery tiers §3
 * defines. "Now" only ever comes from a confirmed, action-needed,
 * urgent fact — never from volume alone (ten routine pending replies
 * is still "today," not "now").
 */
export function classifyAttentionTier(snapshot: AttentionSnapshot): AttentionTier {
  if (snapshot.hasEscalatedPendingReply || snapshot.connectionStatus === "expired") return "now";
  if (snapshot.pendingReplyCount > 0 || snapshot.connectionStatus === "expiring_soon") return "today";
  return "none";
}

/**
 * doc 14 §4 rule 4 — quiet hours are crossed only by something the
 * owner's own configured escalation rules already marked as always
 * urgent, never by an internal tier label alone. A "now"-tier item
 * caused only by connection health (not owner-configured) does not
 * qualify — it stays "now" for immediacy once checked, but waits for
 * the quiet-hours window like "today" would.
 */
export function crossesQuietHours(snapshot: AttentionSnapshot): boolean {
  return snapshot.hasEscalatedPendingReply;
}
