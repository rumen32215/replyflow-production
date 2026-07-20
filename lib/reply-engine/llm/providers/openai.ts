import "server-only";
import OpenAI from "openai";
import type { CompletionRequest, CompletionResult, ModelTier } from "../types";

/**
 * The first (and so far only) concrete LLM adapter, chosen because
 * it's the provider the project's own .env.example already anticipated
 * ("# AI (not wired yet — placeholder for Phase 5)" / OPENAI_API_KEY).
 * Nothing in this file is imported outside lib/reply-engine/llm/ — see
 * client.ts for the provider-agnostic entry point every caller uses.
 */

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY — AI-drafted replies need this set in your environment. See .env.example."
    );
  }
  if (!cachedClient) cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

function modelFor(tier: ModelTier): string {
  if (tier === "small") return process.env.OPENAI_MODEL_SMALL ?? "gpt-4o-mini";
  return process.env.OPENAI_MODEL_LARGE ?? "gpt-4o-mini";
}

export async function complete(request: CompletionRequest): Promise<CompletionResult> {
  const model = modelFor(request.tier);

  const response = await getClient().chat.completions.create({
    model,
    messages: request.messages,
    max_tokens: request.maxOutputTokens ?? 700,
    temperature: 0.3,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: request.jsonSchema.name,
        schema: request.jsonSchema.schema,
        strict: true,
      },
    },
  });

  const raw = response.choices[0]?.message?.content ?? "";
  if (!raw) throw new Error("OpenAI returned an empty completion.");

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned non-JSON content despite a structured response_format request.");
  }

  return {
    data,
    raw,
    model,
    usage: response.usage
      ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens }
      : undefined,
  };
}
