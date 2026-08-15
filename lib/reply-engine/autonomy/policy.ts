import type { UnderstandingResult } from "../understanding/types";
import type { SafetyEvaluation } from "../safety/evaluate";
import type { ExecutedTool, BookingData } from "../tools/types";
import type { AutonomyDecision, ActionType, PreparedAction } from "./types";

/**
 * The deterministic core of autonomy (Plumber Reset Phase 3 step 5) —
 * pure functions only, no I/O, no LLM call. "The LLM can recommend an
 * action, but the autonomy policy decides whether that action is
 * permitted" is enforced structurally: every function here only ever
 * reads already-computed, already-validated signals (Understanding's
 * typed classification, the existing deterministic Safety Layer, real
 * tool-execution results) and returns a plain decision. Nothing here
 * can be talked into a different answer by clever phrasing in a
 * drafted reply — there's no reply text anywhere in these inputs.
 */

function findPendingBookingProposal(toolResults: readonly ExecutedTool[]): ExecutedTool | null {
  // create_booking only — deliberately never update_booking. Tier 1 is
  // narrowly "a customer explicitly accepts a genuinely available NEW
  // slot" (Phase 3 sign-off §Tier 1); a reschedule or cancellation of
  // an existing booking is explicitly Tier 2 ("owner involvement is
  // appropriate") regardless of how confidently it was accepted, so an
  // update_booking result — even one that happens to land as
  // "proposed" — must never be treated as Tier-1-eligible here.
  //
  // Most recent first — if several booking-shaped tool calls happened
  // in one turn (shouldn't normally happen, but never assumed), the
  // last one is the one that actually matters for what the customer
  // will see.
  for (let i = toolResults.length - 1; i >= 0; i--) {
    const t = toolResults[i]!;
    if (t.name === "create_booking" && t.result.ok) {
      const data = t.result.data as BookingData;
      if (data.status === "proposed") return t;
    }
  }
  return null;
}

export interface Tier1EligibilityInput {
  understanding: UnderstandingResult;
  toolResults: readonly ExecutedTool[];
  job: { issue: string | null; address: string | null } | null;
  autoConfirmBookingsEnabled: boolean;
}

export interface Tier1Eligibility {
  /** False whenever there's no freshly-proposed booking to even
   * consider this turn — Tier 1 simply doesn't apply, distinct from
   * "applies but isn't eligible." */
  applicable: boolean;
  eligible: boolean;
  reasons: string[];
}

/**
 * Every one of these conditions is independently checked and
 * independently reported — an owner (or an engineer reading the log)
 * can always see exactly which one(s) blocked automatic confirmation,
 * never just a bare "no."
 */
export function checkTier1Eligibility(input: Tier1EligibilityInput): Tier1Eligibility {
  const pending = findPendingBookingProposal(input.toolResults);
  if (!pending) return { applicable: false, eligible: false, reasons: [] };

  const reasons: string[] = [];

  // "The customer seems to want tomorrow morning" is not acceptance —
  // only a dedicated, typed signal from Understanding counts (see
  // understanding/types.ts's BookingAcceptance doc comment for the
  // full distinction this enforces).
  if (input.understanding.bookingAcceptance !== "explicit_accept") {
    reasons.push(`customer has not explicitly accepted a specific slot (signal: ${input.understanding.bookingAcceptance})`);
  }

  // The strongest urgency seen anywhere in this thread, not just this
  // message — a job that was ever flagged urgent should not later
  // slip through on a calmer follow-up message alone.
  if (input.understanding.conversationState.urgency === "urgent") {
    reasons.push("job is flagged urgent and needs the owner's judgement on timing");
  }

  if (!input.job?.issue || !input.job?.address) {
    reasons.push("job details are not yet complete enough (issue and address) for automatic confirmation");
  }

  if (!input.autoConfirmBookingsEnabled) {
    reasons.push("automatic booking confirmation is not enabled for this business");
  }

  return { applicable: true, eligible: reasons.length === 0, reasons };
}

export interface Tier1ApplyOutcome {
  attempted: boolean;
  succeeded: boolean;
  reasons: string[];
}

export interface DecideAutonomyInput {
  safety: Pick<SafetyEvaluation, "requiresEscalation" | "wouldAutoSend" | "category" | "groundingFailed">;
  tier1Check: Tier1Eligibility;
  /** Null when Tier 1 was never even attempted (not eligible, or
   * nothing to confirm this turn) — see lib/reply-engine/autonomy/
   * apply.ts, the one place a Tier 1 confirmation is ever actually
   * performed. */
  tier1Apply: Tier1ApplyOutcome | null;
}

/**
 * The final tier for this turn — computed AFTER generation and the
 * existing Safety Layer have already run, so a Tier 1 action that
 * genuinely succeeded can still be held back from auto-send if the
 * drafted TEXT itself fails a grounding check (the action and the
 * sentence describing it are never conflated: "never allow an
 * AI-generated sentence to bypass an autonomy restriction" applies to
 * the text even when the underlying action was real and permitted).
 */
export function decideAutonomy(input: DecideAutonomyInput): AutonomyDecision {
  // Tier 3 always wins — this is the existing, unmodified deterministic
  // safety gate (EMERGENCY/COMPLAINT category, an uncited claim, a
  // reschedule overclaim, etc.). Nothing below can override it.
  if (input.safety.requiresEscalation) {
    return { tier: "tier3_owner_required", reasons: ["the deterministic safety gate requires the owner's review"], allowAutoSend: false };
  }

  if (input.tier1Apply?.succeeded && !input.safety.groundingFailed) {
    return {
      tier: "tier1_auto_action",
      reasons: ["customer explicitly accepted a genuinely available slot; automatic booking confirmation is enabled and the booking was confirmed"],
      allowAutoSend: true,
    };
  }

  if (input.tier1Check.applicable) {
    // Either never eligible, or eligible but the real confirm attempt
    // itself failed (e.g. a race with another change) — either way,
    // this always prepares for the owner, never claims success.
    const reasons = input.tier1Apply && !input.tier1Apply.succeeded ? input.tier1Apply.reasons : input.tier1Check.reasons;
    return { tier: "tier2_prepare", reasons: reasons.length > 0 ? reasons : ["booking action needs the owner's review"], allowAutoSend: false };
  }

  if (input.safety.wouldAutoSend && input.safety.category === "general") {
    return { tier: "tier0_auto", reasons: ["safe, non-committal message — grounding and confidence checks passed"], allowAutoSend: true };
  }

  return { tier: "tier2_prepare", reasons: ["does not qualify for automatic handling"], allowAutoSend: false };
}

function describeSlot(startIso: string): string {
  return new Date(startIso).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

/**
 * The structured "decision the owner can approve or reject" the Phase
 * 3 sign-off asked for (e.g. "Sarah wants Tuesday at 10:00am... Job:
 * leaking bathroom P-trap. Confirm booking?") — built once, from real
 * tool-execution output only, reused regardless of which tier the
 * message ends up in (a Tier 1 auto-confirmation is logged with the
 * same structured shape as a Tier 2 one waiting on the owner).
 */
export function buildPreparedAction(input: {
  toolResults: readonly ExecutedTool[];
  jobIssue: string | null;
  customerName: string | null;
  customerPhone: string;
}): PreparedAction | null {
  let match: { name: ExecutedTool["name"]; data: BookingData } | null = null;
  for (let i = input.toolResults.length - 1; i >= 0; i--) {
    const t = input.toolResults[i]!;
    if ((t.name === "create_booking" || t.name === "update_booking") && t.result.ok) {
      match = { name: t.name, data: t.result.data as BookingData };
      break;
    }
  }
  if (!match) return null;

  const who = input.customerName || input.customerPhone;
  const when = describeSlot(match.data.start);
  const jobLine = input.jobIssue ? ` Job: ${input.jobIssue}.` : "";
  const payload = { start: match.data.start, end: match.data.end, customerName: who };

  let actionType: ActionType;
  let summary: string;
  switch (match.data.status) {
    case "cancelled":
      actionType = "cancel_booking";
      summary = `${who}'s booking for ${when} was cancelled.`;
      break;
    case "confirmed":
      actionType = "confirm_booking";
      summary = `${who}'s booking for ${when} is confirmed.${jobLine}`;
      break;
    default:
      actionType = match.name === "update_booking" ? "reschedule_booking" : "propose_booking";
      summary = `${who} wants ${when}.${jobLine} Confirm booking?`;
  }

  return { actionType, summary, payload };
}
