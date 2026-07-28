/**
 * Pure cost-estimation logic, deliberately kept free of the
 * `server-only` guard (unlike usage-tracking.ts, which does the actual
 * DB write) so it can be unit-tested directly with `node:test` — the
 * same split already used elsewhere in the Reply Engine (prompt/facts.ts
 * is pure and tested; safety/evaluate.ts is pure and tested).
 */

/** USD per token, current as of the models this project actually uses
 * (.env.example's OPENAI_MODEL_SMALL/LARGE both default to
 * gpt-4o-mini). Deliberately a static table, not a live pricing API —
 * OpenAI pricing changes rarely enough that a manual update here when
 * it does is simpler and more reliable than a network call on every
 * completion. An unrecognised model still gets its tokens recorded;
 * only the cost estimate is left null rather than guessed. */
const MODEL_PRICING_USD_PER_TOKEN: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const pricing = MODEL_PRICING_USD_PER_TOKEN[model];
  if (!pricing) return null;
  return inputTokens * pricing.input + outputTokens * pricing.output;
}
