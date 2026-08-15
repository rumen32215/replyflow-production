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

  // OpenAI's own types only allow array content (text + image parts)
  // on a user message — a system message must stay a plain string.
  // CompletionMessage's shared `content` type is deliberately looser
  // than that (every real system-message caller only ever sends a
  // string anyway), so this maps each role to exactly what the SDK
  // expects rather than passing request.messages through untyped.
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = request.messages.map((m) =>
    m.role === "system"
      ? { role: "system" as const, content: typeof m.content === "string" ? m.content : "" }
      : { role: "user" as const, content: m.content }
  );

  const usesTools = Boolean(request.tools && request.tools.length > 0);
  if (!usesTools && !request.jsonSchema) {
    throw new Error("A completion request must specify either jsonSchema or tools.");
  }

  const response = await getClient().chat.completions.create({
    model,
    messages,
    max_tokens: request.maxOutputTokens ?? 700,
    temperature: 0.3,
    ...(usesTools
      ? {
          tools: request.tools!.map((t) => ({
            type: "function" as const,
            function: { name: t.name, description: t.description, parameters: t.parameters, strict: true },
          })),
          tool_choice: request.toolChoice ?? "auto",
        }
      : {
          response_format: {
            type: "json_schema" as const,
            json_schema: {
              name: request.jsonSchema!.name,
              schema: request.jsonSchema!.schema,
              strict: true,
            },
          },
        }),
  });

  const message = response.choices[0]?.message;
  if (!message) throw new Error("OpenAI returned no message.");
  const usage = response.usage
    ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens }
    : undefined;

  if (usesTools) {
    // Tool-calling mode never parses `content` as the answer — a real
    // tool call reports itself via `tool_calls`, and the model is free
    // to leave content empty when it requests one. Malformed JSON in a
    // single call's arguments degrades to `null`, never a thrown
    // error: lib/reply-engine/tools/validate.ts is what turns that into
    // a safe "invalid_arguments" outcome, not this adapter.
    const toolCalls = (message.tool_calls ?? [])
      .filter((tc): tc is typeof tc & { type: "function" } => tc.type === "function")
      .map((tc) => {
        let args: unknown = null;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = null;
        }
        return { id: tc.id, name: tc.function.name, arguments: args };
      });
    return { data: null, raw: message.content ?? "", model, usage, toolCalls };
  }

  const raw = message.content ?? "";
  if (!raw) throw new Error("OpenAI returned an empty completion.");

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned non-JSON content despite a structured response_format request.");
  }

  return { data, raw, model, usage };
}
