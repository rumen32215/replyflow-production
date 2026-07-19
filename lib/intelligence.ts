/**
 * Sprint 6: the real reasoning logic that used to live in this file
 * has moved, unchanged, to lib/brain/reasoning.ts and
 * lib/brain/confidence.ts (see the Sprint 4A architecture proposal
 * and Sprint 6's migration report). This file now only re-exports the
 * same names from their new home, so every existing caller —
 * components/dashboard/availability/availability-diary.tsx,
 * components/dashboard/business/business-memory.tsx,
 * components/dashboard/receptionist/receptionist-playground.tsx,
 * components/shared/{confidence-bar,insight}.tsx,
 * app/(dashboard)/dashboard/conversations/layout.tsx —
 * keeps working completely unchanged. Front Desk and Mission Control
 * import directly from "@/lib/brain" instead, since they're the two
 * features this sprint actually migrated to the Shared Brain contract.
 *
 * New code should import from "@/lib/brain", not this file.
 */
export { buildBrain, type Topic, type TopicDomain, type BrainInput, type Observation, type Brain } from "@/lib/brain/reasoning";
export { confidenceLabelFor } from "@/lib/brain/confidence";
