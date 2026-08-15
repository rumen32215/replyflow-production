/**
 * Plumber Reset — Phase 3 step 5. A trust/permission system, not an
 * auto-send switch: every tier answers a different question about who
 * is allowed to do what, never just "should this text be sent."
 */

export type AutonomyTier = "tier0_auto" | "tier1_auto_action" | "tier2_prepare" | "tier3_owner_required";

export interface AutonomyDecision {
  tier: AutonomyTier;
  /** Short, categorical, safe to log and store — never customer- or
   * owner-authored free text (matches the existing product_events/
   * error_events data-minimisation rule). */
  reasons: string[];
  /** Whether the drafted reply describing whatever happened this turn
   * may be sent to the customer without owner review. Independent of
   * whether a real action (e.g. a booking confirmation) already
   * happened — an action can succeed while the reply describing it
   * still needs review (a grounding problem in the text itself), and
   * conversely a reply can be safe to send even though no action was
   * taken at all (Tier 0). */
  allowAutoSend: boolean;
}

export type ActionType = "propose_booking" | "confirm_booking" | "reschedule_booking" | "cancel_booking";

/** The structured "decision the owner can approve or reject," not a
 * rewritten chatbot message — populated whenever a booking-related
 * tool actually ran this turn, regardless of tier, purely from real
 * tool-execution output. */
export interface PreparedAction {
  actionType: ActionType;
  summary: string;
  payload: {
    start: string;
    end: string;
    customerName: string;
  };
}
