import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { estimateCostUsd } from "./pricing";

/**
 * Master Execution Plan 0.1 — every OpenAI call already returns token
 * usage; this is where it finally gets kept instead of discarded.
 * Called from client.ts, the single provider-agnostic chokepoint every
 * completion request already passes through, so every real call site
 * (production replies, Test Conversations, the onboarding/coaching
 * live-reply preview) is covered by one instrumentation point rather
 * than one per caller.
 *
 * Best-effort by design, matching the pipeline's existing discipline
 * for non-critical persistence (e.g. ai_state writes in
 * generate-reply.ts): a failed insert here is logged and swallowed,
 * never allowed to block or fail a reply.
 */

export interface AiUsageEvent {
  businessId: string;
  callSite: string;
  model: string;
  tier: "small" | "large";
  inputTokens: number;
  outputTokens: number;
}

export async function recordAiUsage(event: AiUsageEvent): Promise<void> {
  try {
    const supabase = createServiceClient();
    const estimatedCostUsd = estimateCostUsd(event.model, event.inputTokens, event.outputTokens);

    const { error } = await supabase.from("ai_usage_events").insert({
      business_id: event.businessId,
      call_site: event.callSite,
      model: event.model,
      tier: event.tier,
      input_tokens: event.inputTokens,
      output_tokens: event.outputTokens,
      estimated_cost_usd: estimatedCostUsd,
    });
    if (error) console.error("[reply-engine] could not record AI usage:", error.message);
  } catch (err) {
    // Migration 0016 may not be applied yet in every environment, or the
    // DB may be briefly unreachable — either way, usage tracking is
    // observability, not a pipeline dependency, so it degrades silently.
    console.error("[reply-engine] could not record AI usage:", err);
  }
}
