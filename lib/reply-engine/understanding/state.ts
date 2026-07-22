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
}

export const EMPTY_CONVERSATION_STATE: ConversationState = {
  stage: "understand",
  slots: { issue: null, location: null, preferredTime: null, customerName: null },
  openQuestion: null,
  greetingGiven: false,
  lastTopic: null,
  goal: { type: "general_chat", status: "in_progress" },
  commitments: [],
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
    },
    openQuestion: str(r.openQuestion ?? r.open_question),
    greetingGiven: Boolean(r.greetingGiven ?? r.greeting_given),
    lastTopic: str(r.lastTopic ?? r.last_topic),
    goal: toGoal(r.goal),
    commitments: toCommitments(r.commitments),
  };
}
