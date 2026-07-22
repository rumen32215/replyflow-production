/**
 * Conversation State (Conversation Intelligence Sprint) — the record
 * that turns the Reply Engine from stateless ("re-read the transcript
 * and guess everything, every turn") into stateful ("here's where we
 * already were, here's what just came in, where are we now"). Carried
 * forward turn by turn via `conversations.ai_state`, never re-derived
 * from scratch — that re-derivation is what caused re-greeting,
 * re-asking, and fact drift in production testing.
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
}

export const EMPTY_CONVERSATION_STATE: ConversationState = {
  stage: "understand",
  slots: { issue: null, location: null, preferredTime: null, customerName: null },
  openQuestion: null,
  greetingGiven: false,
  lastTopic: null,
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

function isStage(value: unknown): value is ConversationStage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
  };
}
