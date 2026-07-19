/**
 * Shared Brain — public contract types.
 *
 * Sprint 6 update: Sprint 4B's types were an intentional pre-migration
 * guess, written before any real logic moved here ("agreed before any
 * migration happens... verified against an actual second consumer
 * instead of guessed" — Sprint 4A). Now that Front Desk and Mission
 * Control both really call `getBrainContext()`, this file wraps the
 * real, unchanged shapes from `./reasoning` rather than redefining
 * parallel copies of them — the earlier draft duplicated `Topic`,
 * `Observation`, `Brain`, and `BrainInput` under new names
 * (`BrainTopic`, `BrainObservation`, etc.), which would have meant two
 * sources of truth for the same data drifting apart over time.
 *
 * Two corrections from the original Sprint 4B draft, kept because the
 * real, working code disagreed with the guess and Sprint 6 forbids
 * rewriting working logic to match a guess instead:
 *
 *   1. `ConfidenceLevel` is "Learning" | "Growing" | "Complete"
 *      (capitalised) — the real `confidenceLabelFor` (./confidence)
 *      has always returned these exact strings, and existing
 *      consumers (e.g. components/shared/confidence-bar.tsx) key off
 *      them.
 *   2. Domains are "knowledge" | "receptionist" | "diary" (the real
 *      `TopicDomain`) — not the seven-Brains vocabulary Sprint 4B
 *      guessed. Renaming them would mean rewriting TOPIC_DEFINITIONS
 *      for no behavioural benefit. The generic `BrainContribution`/
 *      multi-domain-orchestration shape is dropped entirely — nothing
 *      computes contributions that way today, and Sprint 6 explicitly
 *      forbids building architecture with no current consumer.
 */

import type { BrainInput, Brain, TopicDomain } from "./reasoning";

export type { TopicDomain as BrainDomain, Topic as BrainTopic, Observation as BrainObservation } from "./reasoning";

/**
 * The only vocabulary ever shown to an owner (Shared Brain
 * Architecture doc: "Confidence is not a percentage shown to users.
 * The user receives: High confidence, Needs review, Missing
 * information — not raw probabilities").
 */
export type ConfidenceLevel = Brain["confidenceLabel"];

/**
 * The input to `getBrainContext()` — the real `BrainInput` every
 * domain field of which stays optional (a caller only supplies the
 * domains it actually has data for — Feature 07 AI spec: "Brain
 * Selection — only involve Brains required for the task") plus a
 * mandatory `businessId`. Every call is scoped to exactly one
 * business — there is no unscoped or global Brain query (Sprint 4A
 * architecture proposal, Risk #3). `businessId` is not read by the
 * reasoning logic itself; it is echoed back on the result so callers
 * can confirm what they got.
 */
export interface BrainScope extends BrainInput {
  businessId: string;
}

/** The assembled result handed to a page — the real `Brain` shape,
 * plus `businessId` echoed back from the scope. */
export interface BrainContext extends Brain {
  businessId: string;
}

/**
 * A correction the owner made — Learning Brain's future input.
 * Nothing produces this yet; no correction is captured anywhere in
 * the product today. Unchanged since Sprint 4B — Sprint 6 explicitly
 * does not implement Learning Brain, only keeps its agreed stub shape.
 */
export interface BrainCorrection {
  businessId: string;
  domain: TopicDomain;
  previousValue: unknown;
  newValue: unknown;
  reason?: string;
  occurredAt: string; // ISO timestamp
}

/**
 * The result of an action ReplyFlow proposed or took — Learning
 * Brain's other future input (Feature 07 AI spec: "Learning
 * Coordination"). Unchanged since Sprint 4B.
 */
export interface BrainOutcome {
  businessId: string;
  domain: TopicDomain;
  description: string;
  result: "accepted" | "rejected" | "edited";
  occurredAt: string; // ISO timestamp
}
