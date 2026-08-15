import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { updateBooking } from "@/lib/booking/engine";
import { findCurrentJob } from "../tools/execute";
import type { ExecutedTool } from "../tools/types";
import type { Tier1ApplyOutcome } from "./policy";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * The one place a Tier 1 booking confirmation is ever actually
 * performed. Eligibility (policy.ts's checkTier1Eligibility) is a pure
 * decision; this is the real, server-side action, re-validated through
 * the exact same deterministic booking engine every other confirm path
 * uses (lib/booking/engine.ts) — never a shortcut, never assumed to
 * succeed just because it was eligible. If the confirm itself fails
 * for any reason (a race, the booking having been superseded since the
 * eligibility check ran a moment earlier), this reports failure and
 * the caller falls back to Tier 2 — the customer is never told
 * something is confirmed unless it genuinely is.
 */
export async function applyTier1AutoConfirm(supabase: ServiceClient, episodeId: string): Promise<Tier1ApplyOutcome> {
  const job = await findCurrentJob(supabase, episodeId);
  if (!job?.nextBookingId) return { attempted: false, succeeded: false, reasons: [] };

  const result = await updateBooking(supabase, job.nextBookingId, { action: "confirm" });
  if (!result.ok) {
    return { attempted: true, succeeded: false, reasons: [`automatic confirmation attempt failed: ${result.reason}`] };
  }
  return { attempted: true, succeeded: true, reasons: [] };
}

/**
 * Once a Tier 1 confirmation has genuinely succeeded, the tool results
 * fed into generation must reflect that — otherwise the drafted reply
 * would still ground itself in "proposed, not yet confirmed" facts
 * (prompt/facts.ts) despite the booking now being real. Returns a new
 * array; never mutates the one it was given.
 */
export function reflectConfirmedBooking(toolResults: readonly ExecutedTool[]): ExecutedTool[] {
  let patchedOne = false;
  return toolResults.map((t) => {
    if (patchedOne || !(t.name === "create_booking" || t.name === "update_booking") || !t.result.ok) return t;
    const data = t.result.data as { start: string; end: string; status: string };
    if (data.status !== "proposed") return t;
    patchedOne = true;
    return { ...t, result: { ok: true as const, data: { ...data, status: "confirmed" as const } } };
  });
}
