/**
 * Owner Trust — the earned half of the Trust Ladder
 * (`DOCS/CONSTITUTION/11-ReplyFlow-Trust-Architecture.md`). Business
 * Understanding is the other half; it needed no new code here — it's
 * already `lib/brain/reasoning.ts`'s existing `percentFor`/`gaps`
 * output, exactly as the architecture document anticipated.
 *
 * Deliberately pure and deterministic, matching every other module in
 * lib/brain/: no LLM call, no Supabase access, no I/O. The caller
 * gathers real, already-confirmed outcome counts (how many recent
 * drafts in this category were approved unchanged, edited before
 * approval, or rejected) and this module only judges what those counts
 * mean — never a prediction, always a report of what already happened.
 *
 * Per the architecture doc: rolling, not banked (a bad recent run costs
 * something, the same way a good one earns something), never rendered
 * as a percentage to the owner, and honest about having "not enough
 * history yet" rather than forcing a stage on a handful of drafts.
 */

export type TrustStage = "help" | "recommend" | "prepare" | "handle_routine_work" | "operate_quietly";

export const TRUST_STAGE_LABELS: Record<TrustStage, string> = {
  help: "Help",
  recommend: "Recommend",
  prepare: "Prepare",
  handle_routine_work: "Handle routine work",
  operate_quietly: "Operate quietly",
};

/**
 * The five owner-facing groups this ladder is scoped to — the same
 * grouping `AUTONOMY_ROWS` already presents on the Receptionist page
 * (components/dashboard/receptionist/receptionist-playground.tsx),
 * not `lib/reply-engine/safety/decision-categories.ts`'s finer
 * nine-way taxonomy. Owner-facing simplicity over internal precision,
 * per Ch.02's own "intelligence should create simplicity."
 */
export const OWNER_TRUST_CATEGORIES: readonly { id: string; label: string }[] = [
  { id: "general", label: "General questions & business info" },
  { id: "booking", label: "Booking requests" },
  { id: "quotes", label: "Quotes & pricing" },
  { id: "complaints", label: "Complaints" },
  { id: "emergencies", label: "Emergencies" },
];

/**
 * Maps a real `reply_drafts.category` value (the finer decision-
 * categories.ts taxonomy: general/booking/change_booking/cancellation/
 * returning_problem/payment/pricing/complaint/emergency) down to one
 * of the five groups above. Booking-lifecycle categories (new booking,
 * change, cancellation, a returning problem/follow-up) group under
 * "booking"; payment and pricing questions both group under "quotes" —
 * matching the Receptionist page's own "Quotes & pricing" label.
 */
export function groupDecisionCategory(category: string): string {
  switch (category) {
    case "booking":
    case "change_booking":
    case "cancellation":
    case "returning_problem":
      return "booking";
    case "payment":
    case "pricing":
      return "quotes";
    case "complaint":
      return "complaints";
    case "emergency":
      return "emergencies";
    default:
      return "general";
  }
}

export interface OwnerTrustCategoryInput {
  /** Owner-facing category id — matches AUTONOMY_ROWS in
   * receptionist-playground.tsx (general/booking/quotes/complaints/
   * emergencies), not the finer decision-categories.ts taxonomy. */
  category: string;
  label: string;
  /** Recent resolved drafts in this category, already counted by the
   * caller from real product_events + reply_drafts rows — never
   * inferred here. */
  unchangedCount: number;
  editedCount: number;
  rejectedCount: number;
}

export interface OwnerTrustCategoryResult {
  category: string;
  label: string;
  /** null = genuinely not enough history yet — an honest state, not an
   * edge case to hide or force into a stage. */
  stage: TrustStage | null;
  reason: string;
  sampleSize: number;
}

/** Below this many resolved drafts, a stage would be reading far too
 * much into too little — report the sample size honestly instead. */
const MIN_SAMPLE_SIZE = 5;

/**
 * Founder-set defaults, not evidence-calibrated thresholds — stated
 * plainly per the architecture doc's own honesty standard (§4: real,
 * cross-business-calibrated thresholds are a "measurable later," not a
 * "measurable now"). Revisit once real pilot data exists to check
 * whether these bands actually track anything meaningful.
 */
function stageForUnchangedRate(rate: number): TrustStage {
  if (rate < 0.4) return "help";
  if (rate < 0.6) return "recommend";
  if (rate < 0.8) return "prepare";
  if (rate < 0.95) return "handle_routine_work";
  return "operate_quietly";
}

export function computeOwnerTrust(inputs: readonly OwnerTrustCategoryInput[]): OwnerTrustCategoryResult[] {
  return inputs.map((input) => {
    const sampleSize = input.unchangedCount + input.editedCount + input.rejectedCount;

    if (sampleSize < MIN_SAMPLE_SIZE) {
      return {
        category: input.category,
        label: input.label,
        stage: null,
        reason:
          sampleSize === 0
            ? "No resolved replies in this category yet."
            : `Only ${sampleSize} resolved ${sampleSize === 1 ? "reply" : "replies"} so far — not enough to tell yet.`,
        sampleSize,
      };
    }

    const unchangedRate = input.unchangedCount / sampleSize;
    const stage = stageForUnchangedRate(unchangedRate);

    return {
      category: input.category,
      label: input.label,
      stage,
      reason: `${input.unchangedCount} of your last ${sampleSize} sent without changes.`,
      sampleSize,
    };
  });
}
