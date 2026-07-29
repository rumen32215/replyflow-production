import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { WINDOW_SECONDS, MAX_EVENTS_PER_WINDOW, isOverLimit } from "./ai-rate-limit-policy";

/**
 * Master Execution Plan 0.2 — a basic, DB-backed rate limit for the
 * owner-facing AI routes (Receptionist live-reply preview, Test
 * Conversations). Reuses the ai_usage_events ledger (0.1) as its own
 * counter rather than standing up a new store (Redis/Upstash) this
 * project doesn't otherwise have — "Simplicity is a feature."
 *
 * Deliberately NOT applied to the WhatsApp webhook — see 0.2's
 * completion notes in DOCS/SPECS/ReplyFlow-Master-Execution-Plan.md.
 * A real inbound customer message must never be silently dropped by a
 * rate limit; the Founder Constitution's Product Promise treats a
 * missed customer as a strictly worse failure than elevated cost.
 */

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

/** Fails open: if the check itself can't run (migration not applied
 * yet, DB briefly unreachable), a real reply is never blocked because
 * a safety check broke — the same discipline usage-tracking.ts already
 * applies to recording itself. */
export async function checkAiRateLimit(businessId: string): Promise<RateLimitResult> {
  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
    const { count, error } = await supabase
      .from("ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", since);

    if (error) {
      console.error("[rate-limit] check failed, failing open:", error.message);
      return { limited: false, retryAfterSeconds: 0 };
    }
    return { limited: isOverLimit(count ?? 0), retryAfterSeconds: WINDOW_SECONDS };
  } catch (err) {
    console.error("[rate-limit] check failed, failing open:", err);
    return { limited: false, retryAfterSeconds: 0 };
  }
}
