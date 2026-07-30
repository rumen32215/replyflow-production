/**
 * Master Execution Plan 3.1 — pure functions only, no Supabase, no
 * Stripe SDK, matching the same convention as lib/front-desk-signals.ts
 * and lib/work-card-state.ts: the caller fetches the real row, this
 * turns it into a display-ready, testable decision.
 *
 * Operations Blueprint §6's own instruction: "gated gracefully and
 * honestly... a lapsed payment communicates plainly before restricting
 * anything." trialing and past_due both keep the product fully working
 * — they only ever produce a message, never a block. Only a fully
 * expired trial or a cancelled subscription blocks.
 */

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface SubscriptionGate {
  /** Only true once the product should actually stop working. */
  blocked: boolean;
  /** A plain-language line for a banner or the blocked screen — null
   * when there's nothing worth saying. */
  message: string | null;
  /** Only meaningful while trialing and not yet expired. */
  daysLeftInTrial: number | null;
}

const TRIAL_WARNING_DAYS = 2;

export function describeSubscriptionGate(input: {
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  now: Date;
}): SubscriptionGate {
  if (input.status === "active") {
    return { blocked: false, message: null, daysLeftInTrial: null };
  }

  if (input.status === "past_due") {
    return {
      blocked: false,
      message: "Your last payment didn't go through — update your card to keep your receptionist working without interruption.",
      daysLeftInTrial: null,
    };
  }

  if (input.status === "canceled") {
    return {
      blocked: true,
      message: "Your subscription has been cancelled. Resubscribe to bring your receptionist back online.",
      daysLeftInTrial: null,
    };
  }

  // trialing
  if (!input.trialEndsAt) {
    // Shouldn't happen for a real trialing row (trial_ends_at is always
    // set at creation time) — an honest "can't tell" never blocks on a
    // data gap.
    return { blocked: false, message: null, daysLeftInTrial: null };
  }

  const msLeft = new Date(input.trialEndsAt).getTime() - input.now.getTime();

  if (msLeft <= 0) {
    return {
      blocked: true,
      message: "Your 7-day trial has ended. Subscribe to keep your receptionist working.",
      daysLeftInTrial: 0,
    };
  }

  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  if (daysLeft <= TRIAL_WARNING_DAYS) {
    return {
      blocked: false,
      message: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your trial — subscribe any time to keep things running without a gap.`,
      daysLeftInTrial: daysLeft,
    };
  }

  return { blocked: false, message: null, daysLeftInTrial: daysLeft };
}

/**
 * Maps a real Stripe subscription.status value to ReplyFlow's own
 * 4-value enum. Stripe has more states than we track distinctly
 * (incomplete, incomplete_expired, unpaid) — everything that isn't a
 * genuinely live or recoverable state collapses to `canceled` rather
 * than inventing a 5th status the rest of the app would need to
 * understand.
 */
export function mapStripeSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    default:
      // canceled, unpaid, incomplete, incomplete_expired, paused
      return "canceled";
  }
}
