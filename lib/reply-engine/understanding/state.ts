/**
 * Conversation State (Conversation Intelligence Sprint) — the record
 * that turns the Reply Engine from stateless ("re-read the transcript
 * and guess everything, every turn") into stateful ("here's where we
 * already were, here's what just came in, where are we now"). Carried
 * forward turn by turn via `conversations.ai_state`, never re-derived
 * from scratch — that re-derivation is what caused re-greeting,
 * re-asking, and fact drift in production testing.
 *
 * Sprint B (Conversation Goals & Commitments) adds a layer above stage:
 * `goal` answers "what is the customer actually trying to achieve" —
 * stage answers "where are we in achieving it." A side-question (call-
 * out fee, mid-booking) doesn't change the goal; a genuinely new request
 * does. `commitments` is the accumulating ledger of facts and questions
 * — both directions, ours and the customer's — that isn't captured by
 * the four fixed slots: "niece will be home," "already asked about the
 * call-out fee." Append-and-update, never silently dropped or re-asked.
 */

export type ConversationStage =
  | "understand"
  | "diagnose"
  | "collect"
  | "quote_or_book"
  | "confirm"
  | "waiting"
  | "completed"
  | "closed";

/** A small, fixed schema — deliberately not an open bag of arbitrary
 * key/value pairs. A fixed shape is what a strict-mode JSON schema call
 * can extract reliably turn after turn; an open one reintroduces the
 * exact "trust the model to get it right" problem this whole change
 * exists to remove. */
export interface CollectedSlots {
  issue: string | null;
  location: string | null;
  preferredTime: string | null;
  customerName: string | null;
  /** ReplyFlow V4 (Conversation Episodes, Phase 3) — an actual ISO 8601
   * timestamp, set only when the model is genuinely confident and
   * unambiguous given the real current date/time it's given (see
   * lib/datetime.ts). Null far more often than preferredTime is — "next
   * week sometime" has no resolved timestamp, but still has free text.
   * Never auto-books anything; only ever pre-fills a Work Card's
   * scheduled_for, which the owner still reviews. */
  preferredTimeResolved: string | null;
  /** Production test (2026-08-16 round 2) — set only when the customer
   * stated an actual WINDOW ("between 1 and 2pm"), never for a single
   * point-in-time preference. `preferredTimeResolved` is the window's
   * start in that case (never a midpoint), and this is the end — both
   * real ISO 8601 timestamps from lib/datetime.ts's
   * resolvePreferredTimeWindow, never invented. Null whenever only a
   * single instant was ever stated. This is a customer PREFERENCE, not
   * a confirmed booking — see DOCS/SPECS/Work-Card-Object.md and the
   * `work_cards.status` draft/booked distinction for where "confirmed"
   * actually lives. */
  preferredTimeWindowEnd: string | null;
}

/** What the customer is fundamentally trying to achieve — distinct from
 * intent (evaluated fresh per message) and from stage (progress within
 * the goal). Mirrors the Decision Categories, since that's the same
 * real-world shape of "what kind of thing is this." */
export type GoalType =
  | "book_appointment"
  | "change_booking"
  | "cancel_booking"
  | "get_pricing"
  | "get_information"
  | "make_payment"
  | "report_problem"
  | "make_complaint"
  | "handle_emergency"
  | "general_chat";

export type GoalStatus = "in_progress" | "completed" | "escalated" | "abandoned";

export interface ConversationGoal {
  type: GoalType;
  status: GoalStatus;
}

/** One item in the commitments ledger. `kind` distinguishes a fact the
 * customer stated (never re-ask for it) from a question either side
 * asked (track whether it's been answered) — `status` is the one field
 * that actually matters for behaviour: outstanding items must not be
 * silently repeated as if new, and must not be treated as answered
 * until something in the conversation actually answers them. */
export interface Commitment {
  text: string;
  kind: "customer_fact" | "customer_question" | "receptionist_question";
  status: "outstanding" | "resolved";
}

/** Mirrors `MeaningEntities["urgency"]` (types.ts) — duplicated as a
 * literal union rather than imported to avoid a circular import
 * (types.ts already imports `ConversationState` from this file). */
export type ConversationUrgency = "none" | "soon" | "urgent";

const URGENCY_RANK: Record<ConversationUrgency, number> = { none: 0, soon: 1, urgent: 2 };

/** The strongest of two urgency readings — a later message saying
 * "actually it's not urgent, no rush" should never downgrade an
 * earlier, more urgent one (e.g. active flooding mentioned, then a
 * calmer follow-up); the owner should always see the worst case the
 * thread has genuinely described. */
export function mergeUrgency(a: ConversationUrgency, b: ConversationUrgency): ConversationUrgency {
  return URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b;
}

export interface ConversationState {
  stage: ConversationStage;
  slots: CollectedSlots;
  /** Exactly what the receptionist is currently waiting to hear back on
   * — null when nothing is outstanding. The single field responsible
   * for killing "asks something already answered" and for making
   * silence-after-completion a safe default rather than a guess. */
  openQuestion: string | null;
  /** Has any message in this thread already opened with a greeting —
   * kills the "Hi Rumen!" every-message repeat. */
  greetingGiven: boolean;
  /** What the live thread is actually about right now, so an unrelated
   * fact (an FAQ answer, a different job) can't get pulled in and read
   * as a topic jump. */
  lastTopic: string | null;
  goal: ConversationGoal;
  commitments: Commitment[];
  /** ReplyFlow V2 (2026-08-11) — Job-Ready computation needs to know
   * the job's urgency at read time (e.g. Front Desk), not just in the
   * moment a single message was classified, so the strongest urgency
   * seen anywhere in the thread is carried forward here exactly like
   * every other slot — mechanically merged in classify.ts, never
   * re-derived from raw history. */
  urgency: ConversationUrgency;
}

export const EMPTY_CONVERSATION_STATE: ConversationState = {
  stage: "understand",
  slots: { issue: null, location: null, preferredTime: null, customerName: null, preferredTimeResolved: null, preferredTimeWindowEnd: null },
  openQuestion: null,
  greetingGiven: false,
  lastTopic: null,
  goal: { type: "general_chat", status: "in_progress" },
  commitments: [],
  urgency: "none",
};

const STAGES: readonly ConversationStage[] = [
  "understand",
  "diagnose",
  "collect",
  "quote_or_book",
  "confirm",
  "waiting",
  "completed",
  "closed",
];

const GOAL_TYPES: readonly GoalType[] = [
  "book_appointment",
  "change_booking",
  "cancel_booking",
  "get_pricing",
  "get_information",
  "make_payment",
  "report_problem",
  "make_complaint",
  "handle_emergency",
  "general_chat",
];

const GOAL_STATUSES: readonly GoalStatus[] = ["in_progress", "completed", "escalated", "abandoned"];
const COMMITMENT_KINDS: readonly Commitment["kind"][] = ["customer_fact", "customer_question", "receptionist_question"];
const COMMITMENT_STATUSES: readonly Commitment["status"][] = ["outstanding", "resolved"];
const URGENCY_LEVELS: readonly ConversationUrgency[] = ["none", "soon", "urgent"];

function isUrgency(value: unknown): value is ConversationUrgency {
  return typeof value === "string" && (URGENCY_LEVELS as readonly string[]).includes(value);
}

function isStage(value: unknown): value is ConversationStage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

function isGoalType(value: unknown): value is GoalType {
  return typeof value === "string" && (GOAL_TYPES as readonly string[]).includes(value);
}

function isGoalStatus(value: unknown): value is GoalStatus {
  return typeof value === "string" && (GOAL_STATUSES as readonly string[]).includes(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Defensive: only ever an actual, parseable timestamp — a malformed
 * or half-written date from the model degrades to null (an honest
 * "not resolved") rather than propagating garbage into a Work Card's
 * scheduled_for. */
function isoTimestamp(value: unknown): string | null {
  const s = str(value);
  if (!s) return null;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toGoal(raw: unknown): ConversationGoal {
  if (!raw || typeof raw !== "object") return EMPTY_CONVERSATION_STATE.goal;
  const r = raw as Record<string, unknown>;
  return {
    type: isGoalType(r.type) ? r.type : "general_chat",
    status: isGoalStatus(r.status) ? r.status : "in_progress",
  };
}

function toCommitments(raw: unknown): Commitment[] {
  if (!Array.isArray(raw)) return [];
  const out: Commitment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const text = str(r.text);
    if (!text) continue;
    const kind = COMMITMENT_KINDS.includes(r.kind as Commitment["kind"]) ? (r.kind as Commitment["kind"]) : "customer_fact";
    const status = COMMITMENT_STATUSES.includes(r.status as Commitment["status"])
      ? (r.status as Commitment["status"])
      : "outstanding";
    out.push({ text, kind, status });
  }
  // A hard cap, not because more couldn't be real, but an unbounded
  // list is exactly the kind of thing that should never silently grow
  // forever in a persisted column — long-running conversations keep the
  // most recent, most likely still-relevant items.
  return out.slice(-20);
}

/** Defensive parsing for state read back from either the model's
 * structured output or the database — malformed/missing input always
 * degrades to EMPTY_CONVERSATION_STATE rather than propagating garbage
 * into the prompt or crashing the pipeline. */
export function toConversationState(raw: unknown): ConversationState {
  if (!raw || typeof raw !== "object") return EMPTY_CONVERSATION_STATE;
  const r = raw as Record<string, unknown>;
  const slots = (r.slots && typeof r.slots === "object" ? (r.slots as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;

  return {
    stage: isStage(r.stage) ? r.stage : "understand",
    slots: {
      issue: str(slots.issue),
      location: str(slots.location),
      preferredTime: str(slots.preferredTime ?? slots.preferred_time),
      customerName: str(slots.customerName ?? slots.customer_name),
      preferredTimeResolved: isoTimestamp(slots.preferredTimeResolved ?? slots.preferred_time_resolved),
      preferredTimeWindowEnd: isoTimestamp(slots.preferredTimeWindowEnd ?? slots.preferred_time_window_end),
    },
    openQuestion: str(r.openQuestion ?? r.open_question),
    greetingGiven: Boolean(r.greetingGiven ?? r.greeting_given),
    lastTopic: str(r.lastTopic ?? r.last_topic),
    goal: toGoal(r.goal),
    commitments: toCommitments(r.commitments),
    urgency: isUrgency(r.urgency) ? r.urgency : "none",
  };
}
