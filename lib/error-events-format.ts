/**
 * Pure formatting logic for error-events.ts, deliberately kept free of
 * the `server-only` guard so it can be unit-tested directly — the same
 * split used for lib/reply-engine/llm/pricing.ts (0.1).
 */

const MAX_ERROR_MESSAGE_LENGTH = 300;

export interface DescribedError {
  errorName: string | null;
  errorDetail: string | null;
}

/** Never returns anything beyond a truncated technical name/message —
 * an Error thrown by a fetch/SDK call describes what broke, not what a
 * customer said, so this is safe by construction as long as callers
 * only ever pass real Error objects (or nothing) into it. */
export function describeError(err: unknown): DescribedError {
  if (err instanceof Error) {
    return { errorName: err.name, errorDetail: err.message.slice(0, MAX_ERROR_MESSAGE_LENGTH) };
  }
  if (err === undefined) {
    return { errorName: null, errorDetail: null };
  }
  return { errorName: null, errorDetail: String(err).slice(0, MAX_ERROR_MESSAGE_LENGTH) };
}
