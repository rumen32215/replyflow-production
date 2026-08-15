/**
 * Plumber Reset — Phase 3 step 4 (the brain's tool-calling layer). The
 * six tools approved in the Phase 2 architecture, and nothing more.
 * None of them ever take an entity id (customer/job/booking) from the
 * model — every id is resolved server-side from the conversation
 * itself (lib/reply-engine/tools/execute.ts). This removes an entire
 * class of possible model error (a hallucinated or wrong id) by
 * construction, rather than trying to validate one away.
 */

export const TOOL_NAMES = [
  "get_customer_context",
  "create_or_update_job",
  "check_availability",
  "create_booking",
  "update_booking",
  "escalate_to_owner",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

const TOOL_NAME_SET: ReadonlySet<string> = new Set(TOOL_NAMES);

export function isToolName(name: string): name is ToolName {
  return TOOL_NAME_SET.has(name);
}

// ---------------------------------------------------------------------
// Result data shapes — one per tool's success case.

export interface CustomerContextData {
  customer: { name: string | null; defaultAddress: string | null; notes: string | null } | null;
  recentJobs: { issue: string | null; status: string; scheduledFor: string | null; completedAt: string | null }[];
}

export interface JobData {
  jobId: string;
  issue: string | null;
  address: string | null;
  status: string;
}

export interface SlotData {
  start: string;
  end: string;
}

export interface AvailabilityData {
  slots: SlotData[];
}

export interface BookingData {
  start: string;
  end: string;
  status: "proposed" | "confirmed" | "cancelled" | "completed";
}

export interface EscalationData {
  reason: string;
}

/** Every distinct, safe way a tool can decline to do what was asked —
 * always a typed reason, never a raw thrown error reaching the model
 * or the customer. */
export type ToolFailureReason =
  | "invalid_arguments"
  | "no_job"
  | "no_active_booking"
  | "invalid_window"
  | "conflict"
  | "execution_failed";

export interface ToolFailure {
  ok: false;
  reason: ToolFailureReason;
  detail?: string;
  /** Only ever populated for "conflict" — real, currently-open slots
   * computed by the deterministic booking engine, never invented. */
  alternatives?: SlotData[];
}

export interface ToolSuccess<T> {
  ok: true;
  data: T;
}

export type ToolOutcome<T> = ToolSuccess<T> | ToolFailure;

export type ToolResult =
  | ToolOutcome<CustomerContextData>
  | ToolOutcome<JobData>
  | ToolOutcome<AvailabilityData>
  | ToolOutcome<BookingData>
  | ToolOutcome<EscalationData>;

/** One tool call the decide step actually executed, paired with its
 * real outcome — this is what flows into prompt/facts.ts, and what
 * gets logged for auditability. */
export interface ExecutedTool {
  name: ToolName;
  result: ToolResult;
}
