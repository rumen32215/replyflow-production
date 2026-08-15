/**
 * Shared Brain — public API surface.
 *
 * Sprint 6: this is now the real, working entry point every feature
 * that needs "understanding of the business" calls — Front Desk and
 * Mission Control both consume `getBrainContext()` from here instead
 * of calling `buildBrain()` directly. The reasoning itself is
 * unchanged: `getBrainContext()` is a thin wrapper around the same
 * `buildBrain()` that has always lived here (moved, not rewritten,
 * to lib/brain/reasoning.ts), plus `businessId` echoed onto the
 * result so every call is traceably scoped to one business (Sprint 4A
 * architecture proposal, Risk #3).
 *
 * `lib/intelligence.ts` still exists as a thin re-export shim so the
 * other real callers this sprint doesn't touch — the Diary,
 * Business Knowledge, Receptionist, and Conversations pages — keep
 * working completely unchanged.
 */

import { buildBrain, selectTodaysPriority } from "./reasoning";
import type { BrainContext, BrainScope } from "./types";

export type {
  BrainScope,
  BrainContext,
  BrainDomain,
  BrainTopic,
  BrainObservation,
  ConfidenceLevel,
} from "./types";
export { selectTodaysPriority } from "./reasoning";
export type { TodaysPriority, TodaysPriorityInput } from "./reasoning";
export { confidenceLabelFor } from "./confidence";
export type { OrganiseCandidate, OrganiseGap } from "./organise";

/**
 * Assembles a business's Shared Brain context for whichever domains
 * the caller supplies (Feature 07 AI spec: "Brain Selection — only
 * involve Brains required for the task") — an omitted domain simply
 * reads as "not yet known," never fetched or assumed. Pure/read-only
 * by design: no I/O happens inside lib/brain itself — callers fetch
 * their own Supabase rows and shape them into this call, exactly as
 * they already did when calling `buildBrain()` directly.
 */
export function getBrainContext(scope: BrainScope): BrainContext {
  const { businessId, ...input } = scope;
  return { businessId, ...buildBrain(input) };
}
