import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTier1Eligibility, decideAutonomy, buildPreparedAction } from "./policy";
import { EMPTY_CONVERSATION_STATE } from "../understanding/state";
import type { UnderstandingResult, BookingAcceptance } from "../understanding/types";
import type { ExecutedTool } from "../tools/types";

/**
 * Pure, deterministic policy tests — no I/O. This is the safety-
 * critical core of the autonomy layer: every one of these cases
 * corresponds directly to a scenario in the Phase 3 sign-off ("the
 * system must distinguish between asking about availability,
 * expressing a preference, proposing a time, and explicitly accepting
 * a specific available slot").
 */

function understanding(overrides: Partial<UnderstandingResult> = {}): UnderstandingResult {
  return {
    primaryIntent: "BOOKING_REQUEST",
    secondaryIntents: [],
    confidence: "high",
    patternEntities: { phoneNumbers: [], postcodes: [], emails: [], explicitDates: [] },
    meaningEntities: { urgency: "none", impliedJobType: null, sentiment: "neutral" },
    safetyTag: null,
    conversationState: EMPTY_CONVERSATION_STATE,
    episodeContinuity: "same_job",
    bookingAcceptance: "explicit_accept",
    ...overrides,
  };
}

function proposedBookingTool(status: "proposed" | "confirmed" | "cancelled" = "proposed"): ExecutedTool {
  return {
    name: "create_booking",
    result: { ok: true, data: { start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T10:00:00.000Z", status } },
  };
}

const COMPLETE_JOB = { issue: "Leaking kitchen tap", address: "1 High Street" };

// ---------------------------------------------------------------------
// checkTier1Eligibility

test("checkTier1Eligibility: not applicable at all when no booking was proposed this turn", () => {
  const result = checkTier1Eligibility({
    understanding: understanding(),
    toolResults: [],
    job: COMPLETE_JOB,
    autoConfirmBookingsEnabled: true,
  });
  assert.equal(result.applicable, false);
  assert.equal(result.eligible, false);
});

test("checkTier1Eligibility: eligible when every condition holds", () => {
  const result = checkTier1Eligibility({
    understanding: understanding({ bookingAcceptance: "explicit_accept" }),
    toolResults: [proposedBookingTool()],
    job: COMPLETE_JOB,
    autoConfirmBookingsEnabled: true,
  });
  assert.equal(result.applicable, true);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.reasons, []);
});

const AMBIGUOUS_SIGNALS: BookingAcceptance[] = ["none", "asking_availability", "expressing_preference", "proposing_time"];
for (const signal of AMBIGUOUS_SIGNALS) {
  test(`checkTier1Eligibility: "${signal}" is never treated as acceptance — only explicit_accept qualifies`, () => {
    const result = checkTier1Eligibility({
      understanding: understanding({ bookingAcceptance: signal }),
      toolResults: [proposedBookingTool()],
      job: COMPLETE_JOB,
      autoConfirmBookingsEnabled: true,
    });
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some((r) => r.includes("has not explicitly accepted")));
  });
}

test("checkTier1Eligibility: urgent jobs are never Tier 1 eligible, even with explicit acceptance", () => {
  const result = checkTier1Eligibility({
    understanding: understanding({ conversationState: { ...EMPTY_CONVERSATION_STATE, urgency: "urgent" } }),
    toolResults: [proposedBookingTool()],
    job: COMPLETE_JOB,
    autoConfirmBookingsEnabled: true,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.some((r) => r.includes("urgent")));
});

test("checkTier1Eligibility: incomplete job details block Tier 1", () => {
  const result = checkTier1Eligibility({
    understanding: understanding(),
    toolResults: [proposedBookingTool()],
    job: { issue: "Leaking tap", address: null },
    autoConfirmBookingsEnabled: true,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.some((r) => r.includes("job details")));
});

test("checkTier1Eligibility: the owner setting is checked independently — off blocks Tier 1 even with everything else satisfied", () => {
  const result = checkTier1Eligibility({
    understanding: understanding(),
    toolResults: [proposedBookingTool()],
    job: COMPLETE_JOB,
    autoConfirmBookingsEnabled: false,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.some((r) => r.includes("not enabled")));
});

test("checkTier1Eligibility: multiple failing conditions are all reported, not just the first", () => {
  const result = checkTier1Eligibility({
    understanding: understanding({ bookingAcceptance: "expressing_preference" }),
    toolResults: [proposedBookingTool()],
    job: { issue: null, address: null },
    autoConfirmBookingsEnabled: false,
  });
  assert.equal(result.reasons.length, 3);
});

test("checkTier1Eligibility: a reschedule (update_booking) is never Tier 1 eligible, even proposed with explicit acceptance — reschedule is always Tier 2", () => {
  const reschedule: ExecutedTool = {
    name: "update_booking",
    result: { ok: true, data: { start: "2026-09-01T13:00:00.000Z", end: "2026-09-01T14:00:00.000Z", status: "proposed" } },
  };
  const result = checkTier1Eligibility({
    understanding: understanding({ bookingAcceptance: "explicit_accept" }),
    toolResults: [reschedule],
    job: COMPLETE_JOB,
    autoConfirmBookingsEnabled: true,
  });
  assert.equal(result.applicable, false, "Tier 1 must never even consider a reschedule");
});

test("checkTier1Eligibility: a booking already confirmed or cancelled this turn is not something Tier 1 needs to act on", () => {
  const confirmed = checkTier1Eligibility({ understanding: understanding(), toolResults: [proposedBookingTool("confirmed")], job: COMPLETE_JOB, autoConfirmBookingsEnabled: true });
  assert.equal(confirmed.applicable, false);
  const cancelled = checkTier1Eligibility({ understanding: understanding(), toolResults: [proposedBookingTool("cancelled")], job: COMPLETE_JOB, autoConfirmBookingsEnabled: true });
  assert.equal(cancelled.applicable, false);
});

// ---------------------------------------------------------------------
// decideAutonomy

test("decideAutonomy: Tier 3 always wins when the deterministic safety gate requires escalation", () => {
  const result = decideAutonomy({
    safety: { requiresEscalation: true, wouldAutoSend: false, category: "emergency", groundingFailed: false },
    tier1Check: { applicable: false, eligible: false, reasons: [] },
    tier1Apply: null,
  });
  assert.equal(result.tier, "tier3_owner_required");
  assert.equal(result.allowAutoSend, false);
});

test("decideAutonomy: Tier 3 overrides even a booking that was just successfully confirmed", () => {
  const result = decideAutonomy({
    safety: { requiresEscalation: true, wouldAutoSend: false, category: "booking", groundingFailed: false },
    tier1Check: { applicable: true, eligible: true, reasons: [] },
    tier1Apply: { attempted: true, succeeded: true, reasons: [] },
  });
  assert.equal(result.tier, "tier3_owner_required");
  assert.equal(result.allowAutoSend, false);
});

test("decideAutonomy: Tier 1 only when the confirm genuinely succeeded and the drafted text itself has no grounding problem", () => {
  const result = decideAutonomy({
    safety: { requiresEscalation: false, wouldAutoSend: false, category: "booking", groundingFailed: false },
    tier1Check: { applicable: true, eligible: true, reasons: [] },
    tier1Apply: { attempted: true, succeeded: true, reasons: [] },
  });
  assert.equal(result.tier, "tier1_auto_action");
  assert.equal(result.allowAutoSend, true);
});

test("decideAutonomy: a genuinely confirmed booking still falls to Tier 2 if the reply text fails grounding — the action and the sentence are never conflated", () => {
  const result = decideAutonomy({
    safety: { requiresEscalation: false, wouldAutoSend: false, category: "booking", groundingFailed: true },
    tier1Check: { applicable: true, eligible: true, reasons: [] },
    tier1Apply: { attempted: true, succeeded: true, reasons: [] },
  });
  assert.equal(result.tier, "tier2_prepare");
  assert.equal(result.allowAutoSend, false);
});

test("decideAutonomy: eligible but the real confirm attempt itself failed — Tier 2, never Tier 1", () => {
  const result = decideAutonomy({
    safety: { requiresEscalation: false, wouldAutoSend: false, category: "booking", groundingFailed: false },
    tier1Check: { applicable: true, eligible: true, reasons: [] },
    tier1Apply: { attempted: true, succeeded: false, reasons: ["automatic confirmation attempt failed: conflict"] },
  });
  assert.equal(result.tier, "tier2_prepare");
  assert.equal(result.allowAutoSend, false);
  assert.ok(result.reasons[0]!.includes("failed"));
});

test("decideAutonomy: not eligible at all (e.g. ambiguous acceptance) — Tier 2, with the real reason carried through", () => {
  const result = decideAutonomy({
    safety: { requiresEscalation: false, wouldAutoSend: false, category: "booking", groundingFailed: false },
    tier1Check: { applicable: true, eligible: false, reasons: ["customer has not explicitly accepted a specific slot (signal: expressing_preference)"] },
    tier1Apply: null,
  });
  assert.equal(result.tier, "tier2_prepare");
  assert.ok(result.reasons[0]!.includes("expressing_preference"));
});

test("decideAutonomy: Tier 0 for a safe, general, already-passing message with no booking action at all", () => {
  const result = decideAutonomy({
    safety: { requiresEscalation: false, wouldAutoSend: true, category: "general", groundingFailed: false },
    tier1Check: { applicable: false, eligible: false, reasons: [] },
    tier1Apply: null,
  });
  assert.equal(result.tier, "tier0_auto");
  assert.equal(result.allowAutoSend, true);
});

test("decideAutonomy: a pricing question never reaches Tier 0 or Tier 1 — falls to Tier 2 by default", () => {
  const result = decideAutonomy({
    safety: { requiresEscalation: false, wouldAutoSend: false, category: "pricing", groundingFailed: false },
    tier1Check: { applicable: false, eligible: false, reasons: [] },
    tier1Apply: null,
  });
  assert.equal(result.tier, "tier2_prepare");
  assert.equal(result.allowAutoSend, false);
});

test("decideAutonomy: low confidence (safety.wouldAutoSend already false) never produces increasingly aggressive autonomy — Tier 2, not Tier 0", () => {
  const result = decideAutonomy({
    safety: { requiresEscalation: false, wouldAutoSend: false, category: "general", groundingFailed: false },
    tier1Check: { applicable: false, eligible: false, reasons: [] },
    tier1Apply: null,
  });
  assert.equal(result.tier, "tier2_prepare");
  assert.equal(result.allowAutoSend, false);
});

// ---------------------------------------------------------------------
// buildPreparedAction

test("buildPreparedAction: no booking-shaped tool result at all -> null", () => {
  const result = buildPreparedAction({ toolResults: [], jobIssue: "Leaking tap", customerName: "Sarah", customerPhone: "+447700900123" });
  assert.equal(result, null);
});

test("buildPreparedAction: a proposed booking reads as a real decision to approve, matching the sign-off's own example shape", () => {
  const result = buildPreparedAction({
    toolResults: [proposedBookingTool("proposed")],
    jobIssue: "Leaking bathroom P-trap",
    customerName: "Sarah",
    customerPhone: "+447700900123",
  });
  assert.equal(result?.actionType, "propose_booking");
  assert.ok(result?.summary.includes("Sarah"));
  assert.ok(result?.summary.includes("Leaking bathroom P-trap"));
  assert.ok(result?.summary.includes("Confirm booking?"));
});

test("buildPreparedAction: a confirmed booking reads as already confirmed, not as a pending question", () => {
  const result = buildPreparedAction({
    toolResults: [proposedBookingTool("confirmed")],
    jobIssue: "Leaking tap",
    customerName: "Sarah",
    customerPhone: "+447700900123",
  });
  assert.equal(result?.actionType, "confirm_booking");
  assert.ok(!result?.summary.includes("Confirm booking?"));
});

test("buildPreparedAction: a cancellation reads as already cancelled", () => {
  const result = buildPreparedAction({
    toolResults: [{ name: "update_booking", result: { ok: true, data: { start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T10:00:00.000Z", status: "cancelled" } } }],
    jobIssue: "Leaking tap",
    customerName: "Sarah",
    customerPhone: "+447700900123",
  });
  assert.equal(result?.actionType, "cancel_booking");
  assert.ok(result?.summary.includes("cancelled"));
});

test("buildPreparedAction: falls back to the phone number when no name is known", () => {
  const result = buildPreparedAction({
    toolResults: [proposedBookingTool("proposed")],
    jobIssue: "Leaking tap",
    customerName: null,
    customerPhone: "+447700900123",
  });
  assert.ok(result?.summary.includes("+447700900123"));
});
