import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Master Execution Plan 3.2 — the durable sink for a real product
 * event, so "it earns responsibility over time" is measurable instead
 * of assumed. This is the ONLY writer to product_events (migration
 * 0021), matching the same "one instrumented chokepoint" discipline
 * already used for ai_usage_events and error_events.
 *
 * Best-effort by design, same as recordErrorEvent: recording a fact
 * about the product must never itself become a failure that affects a
 * real customer interaction or an owner's action.
 *
 * NEVER pass customer message content, a drafted reply's text, or any
 * other free text a customer or owner authored into `context` — only
 * opaque IDs and short categorical facts. Same non-negotiable data
 * boundary this project applies everywhere else.
 *
 * Deliberately narrow: only called where a genuinely new fact isn't
 * already captured by an existing table's own timestamp column (see
 * DOCS/SPECS/ReplyFlow-Usage-Analytics.md for the reasoning behind
 * which events are and aren't instrumented here).
 */

/** Deliberately primitives only — same reasoning as ErrorEventContext. */
export type ProductEventContext = Record<string, string | number | boolean | null>;

export interface ProductEventInput {
  /** Dotted identifier, e.g. "draft.approved", "onboarding.signup_completed". */
  eventType: string;
  businessId: string;
  context?: ProductEventContext;
}

export async function recordProductEvent(input: ProductEventInput): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("product_events").insert({
      event_type: input.eventType,
      business_id: input.businessId,
      context: input.context ?? {},
    });
    if (error) console.error("[product-events] could not record product event:", error.message);
  } catch (err) {
    // Same degrade-silently reasoning as recordErrorEvent — this is
    // observability, never a dependency of the action it's describing.
    console.error("[product-events] could not record product event:", err);
  }
}
