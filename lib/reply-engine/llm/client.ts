import "server-only";
import type { CompletionRequest, CompletionResult } from "./types";

/**
 * The one function the rest of the Reply Engine calls to reach an LLM.
 * Provider selection is a single env var (`LLM_PROVIDER`, defaulting
 * to "openai" — see .env.example) — no provider-specific logic lives
 * outside lib/reply-engine/llm/providers/*.
 */
export async function getCompletion(request: CompletionRequest): Promise<CompletionResult> {
  const provider = process.env.LLM_PROVIDER ?? "openai";

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
}
