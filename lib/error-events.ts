import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { describeError } from "./error-events-format";

/**
 * Master Execution Plan 1.1 — the durable sink for a caught failure at
 * a real reply-engine/webhook chokepoint, so it becomes a queryable
 * fact instead of a line in Vercel's ephemeral function logs. This is
 * the ONLY writer to error_events (migration 0017) — every call site
 * goes through this one function, matching the same "one instrumented
 * chokepoint, not one per caller" discipline already used for
 * ai_usage_events (0.1's usage-tracking.ts).
 *
 * Best-effort by design: recording a failure must never itself become
 * a second failure. A broken monitoring write can never block, delay,
 * or change the outcome of a real customer reply.
 *
 * NEVER pass customer message content, a drafted reply's text, or any
 * other free text a customer or owner authored into `message` or
 * `context` — only opaque IDs (business/conversation/message ids),
 * short generic descriptions written by the call site itself, and
 * error type/message strings (which describe what broke technically,
 * not what anyone said). Same non-negotiable data boundary this
 * project already applies everywhere else.
 */

export type ErrorSeverity = "warning" | "error" | "critical";

/** Deliberately primitives only — a nested object could accidentally
 * smuggle in something unsanitized. If a call site needs to reference
 * a record, pass its id (a string), not the record itself. */
export type ErrorEventContext = Record<string, string | number | boolean | null>;

export interface ErrorEventInput {
  severity: ErrorSeverity;
  /** Dotted identifier naming where this happened, e.g.
   * "reply-engine.pipeline_failure", "webhook.signature_invalid". */
  source: string;
  businessId: string | null;
  /** Short, human-written description of what broke — written by the
   * call site, never the raw error text on its own. */
  message: string;
  error?: unknown;
  context?: ErrorEventContext;
}

export async function recordErrorEvent(input: ErrorEventInput): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { errorName, errorDetail } = describeError(input.error);

    const { error } = await supabase.from("error_events").insert({
      severity: input.severity,
      source: input.source,
      business_id: input.businessId,
      message: input.message,
      error_name: errorName,
      context: { ...(input.context ?? {}), ...(errorDetail ? { errorDetail } : {}) },
    });
    if (error) console.error("[error-events] could not record error event:", error.message);
  } catch (err) {
    // Migration 0017 may not be applied yet in every environment, or
    // the DB may be briefly unreachable — either way, this is
    // observability, not a pipeline dependency, so it degrades
    // silently rather than compounding the failure it was reporting.
    console.error("[error-events] could not record error event:", err);
  }
}
