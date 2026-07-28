/**
 * Provider-agnostic LLM contract (Sprint 9 "Implement the first
 * production LLM integration... The Reply Engine should only know it
 * is requesting a completion"). Nothing outside lib/reply-engine/llm/
 * should import a provider SDK directly or reference a model name.
 *
 * `tier` replaces a raw model name in the request — callers ask for a
 * "small" (cheap/fast, used by the Understanding Engine's
 * classification call) or "large" (fuller, used by reply generation)
 * completion; each provider adapter maps tiers to its own real models.
 */
export type ModelTier = "small" | "large";

export interface CompletionMessage {
  role: "system" | "user";
  content: string;
}

/** Every call requests structured output, never prose (Sprint 9 §5) —
 * `schema` must be a valid JSON Schema object describing the exact
 * shape the caller will parse `data` into. */
export interface JsonSchemaSpec {
  name: string;
  schema: Record<string, unknown>;
}

export interface CompletionRequest {
  tier: ModelTier;
  messages: CompletionMessage[];
  jsonSchema: JsonSchemaSpec;
  maxOutputTokens?: number;
  /** Master Execution Plan 0.1 — every call is attributed to the
   * business it was made for and the pipeline stage that made it, so
   * token usage lands in ai_usage_events instead of being discarded.
   * Required, not optional: the two real call sites (classify.ts,
   * generate.ts) always have a businessId available by the time they
   * call this, and making it required means a future third call site
   * can't silently go untracked by omitting it. */
  businessId: string;
  callSite: string;
}

export interface CompletionResult {
  /** Parsed JSON conforming to the requested schema. */
  data: unknown;
  raw: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}
