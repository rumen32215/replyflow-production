import "server-only";
import type { CompletionRequest, CompletionResult } from "./types";
import { recordAiUsage } from "./usage-tracking";

/**
 * The one function the rest of the Reply Engine calls to reach an LLM.
 * Provider selection is a single env var (`LLM_PROVIDER`, defaulting
 * to "openai" — see .env.example) — no provider-specific logic lives
 * outside lib/reply-engine/llm/providers/*.
 */
export async function getCompletion(request: CompletionRequest): Promise<CompletionResult> {
  const provider = process.env.LLM_PROVIDER ?? "openai";

  const result = await (async (): Promise<CompletionResult> => {
    switch (provider) {
      case "openai": {
        const { complete } = await import("./providers/openai");
        return complete(request);
      }
      default:
        throw new Error(
          `Unknown LLM_PROVIDER "${provider}" — supported values: "openai". See .env.example.`
        );
    }
  })();

  // Master Execution Plan 0.1 — recorded here, once, regardless of which
  // provider answered or which pipeline stage asked. Never blocks or
  // fails the completion: usage.inputTokens/outputTokens are only
  // absent if the provider itself didn't return them, in which case
  // there's nothing real to record.
  if (result.usage) {
    await recordAiUsage({
      businessId: request.businessId,
      callSite: request.callSite,
      model: result.model,
      tier: request.tier,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    });
  }

  return result;
}
