import type { ToolSpec } from "../llm/types";
import type { Intent } from "../understanding/types";
import type { ToolName } from "./types";

/**
 * Real OpenAI function-calling schemas for the six approved tools.
 * Strict mode (see llm/providers/openai.ts) — every property listed in
 * `required`, `additionalProperties: false`, optional fields expressed
 * as nullable rather than actually omittable — the exact convention
 * every other structured-output schema in this codebase already uses
 * (see understanding/classify.ts, prompt/build.ts).
 */

const GET_CUSTOMER_CONTEXT: ToolSpec = {
  name: "get_customer_context",
  description:
    "Look up this customer's real, stored identity and recent job history. Use when the customer indicates they've contacted this business before (\"it's me again\", a reference to a previous job) or when knowing their history would genuinely help. Takes no arguments — it always looks up the customer already on this conversation, never a name or number you supply.",
  parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
};

const CREATE_OR_UPDATE_JOB: ToolSpec = {
  name: "create_or_update_job",
  description:
    "Record or update the real details of the job this conversation is about, so the rest of the system (booking, the eventual report) has something real to work from. Only pass a field the customer has actually stated in this conversation — never guess or invent a value; pass null for anything not genuinely known. `issue` is required the first time a job is created for this conversation.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      issue: { type: ["string", "null"], description: "The problem or job, in a few words, in terms the customer actually used." },
      address: { type: ["string", "null"], description: "The job's postcode or address, only if the customer has actually given one." },
      notes: { type: ["string", "null"], description: "Any other real, specific detail worth recording, only if genuinely stated." },
    },
    required: ["issue", "address", "notes"],
  },
};

const CHECK_AVAILABILITY: ToolSpec = {
  name: "check_availability",
  description:
    "Get real, currently-open appointment slots for this business. Always call this before ever proposing or confirming a specific day or time to the customer — never invent or guess one yourself.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      durationMinutes: { type: ["number", "null"], description: "Expected job duration in minutes, between 15 and 480. Null to use the business's default." },
      preferredDate: { type: ["string", "null"], description: "A specific date the customer asked about, as an ISO date (YYYY-MM-DD). Null to search starting from today." },
    },
    required: ["durationMinutes", "preferredDate"],
  },
};

const CREATE_BOOKING: ToolSpec = {
  name: "create_booking",
  description:
    "Book a specific slot the customer has clearly, explicitly accepted. start/end must be a real slot exactly as returned by check_availability in this conversation — never a time that was only discussed or proposed, and never one you or the customer mentioned that hasn't actually been confirmed as open.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      start: { type: "string", description: "ISO 8601 start time, exactly as returned by check_availability." },
      end: { type: "string", description: "ISO 8601 end time, exactly as returned by check_availability." },
    },
    required: ["start", "end"],
  },
};

const UPDATE_BOOKING: ToolSpec = {
  name: "update_booking",
  description:
    "Confirm, cancel, or reschedule this job's existing booking. For reschedule, start/end must be a real slot from check_availability that the customer has clearly accepted — the same rule as create_booking.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      action: { type: "string", enum: ["confirm", "cancel", "reschedule"] },
      start: { type: ["string", "null"], description: "Required only when action is reschedule." },
      end: { type: ["string", "null"], description: "Required only when action is reschedule." },
    },
    required: ["action", "start", "end"],
  },
};

const ESCALATE_TO_OWNER: ToolSpec = {
  name: "escalate_to_owner",
  description:
    "Flag this conversation for the owner's personal attention instead of attempting to handle it yourself. Use for anything needing real business judgement you cannot safely make on your own — an emergency, a complaint, or a genuinely ambiguous request. Do not attempt a normal booking/job flow when this applies.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      reason: { type: "string", description: "A short, specific reason the owner needs to see." },
    },
    required: ["reason"],
  },
};

export const TOOL_SCHEMAS: Record<ToolName, ToolSpec> = {
  get_customer_context: GET_CUSTOMER_CONTEXT,
  create_or_update_job: CREATE_OR_UPDATE_JOB,
  check_availability: CHECK_AVAILABILITY,
  create_booking: CREATE_BOOKING,
  update_booking: UPDATE_BOOKING,
  escalate_to_owner: ESCALATE_TO_OWNER,
};

/**
 * Deterministic gate, not a model judgment call: which tools (if any)
 * are even worth offering for a given intent. A general question
 * (BUSINESS_INFORMATION, PRICING_INQUIRY, PAYMENT_QUERY, SOCIAL,
 * UNCLEAR) never gets a decision call made for it at all — "no
 * unnecessary tool call" is guaranteed by construction here, not by
 * trusting the model to decline.
 *
 * EMERGENCY and COMPLAINT are offered escalate_to_owner ONLY — a
 * booking/job tool is never even available to call during either, so
 * "attempt a normal booking flow during an emergency" is structurally
 * impossible, on top of (not instead of) the existing deterministic
 * safety/decision-categories.ts gate that already forces escalation
 * for both.
 */
const INTENT_TOOLS: Partial<Record<Intent, readonly ToolName[]>> = {
  BOOKING_REQUEST: ["get_customer_context", "create_or_update_job", "check_availability", "create_booking", "escalate_to_owner"],
  BOOKING_CHANGE: ["get_customer_context", "check_availability", "update_booking", "escalate_to_owner"],
  BOOKING_CANCELLATION: ["get_customer_context", "update_booking", "escalate_to_owner"],
  RETURNING_PROBLEM: ["get_customer_context", "create_or_update_job", "check_availability", "escalate_to_owner"],
  STATUS_CHECK: ["get_customer_context", "escalate_to_owner"],
  EMERGENCY: ["escalate_to_owner"],
  COMPLAINT: ["escalate_to_owner"],
};

export function toolsForIntent(intent: Intent): readonly ToolName[] {
  return INTENT_TOOLS[intent] ?? [];
}

export function needsToolDecision(understanding: { primaryIntent: Intent }): boolean {
  return toolsForIntent(understanding.primaryIntent).length > 0;
}
