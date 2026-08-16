import "server-only";
import { getCompletion } from "../llm/client";
import type { createServiceClient } from "@/lib/supabase/service";
import type { UnderstandingResult } from "../understanding/types";
import { toolsForIntent } from "./schema";
import { TOOL_SCHEMAS } from "./schema";
import { executeTool, findCurrentJob, type ToolExecutionContext } from "./execute";
import { isToolName, type ExecutedTool, type ToolName } from "./types";
import { recordErrorEvent } from "@/lib/error-events";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Plumber Reset — Phase 3 step 4, the "decide" step: customer message
 * → understand (already done, classify.ts) → decide whether an action
 * is required → call the correct deterministic tool → verify the
 * result → continue. This file is only the deciding-and-dispatching
 * half; execute.ts is the deterministic half that actually does
 * anything. Nothing here ever writes to the database directly.
 *
 * Deliberately a real, native OpenAI tool-calling request (llm/types.ts
 * `tools`), not a bespoke prose-encoded "requested_action" field — the
 * model is offered the exact same typed, strict-mode function schemas
 * (schema.ts) regardless of which tool it picks, and may request zero,
 * one, or several. Tool calls actually returned are executed in a
 * fixed, safe order (customer/job lookups before booking actions)
 * regardless of what order the model listed them in.
 */

const EXECUTION_ORDER: readonly ToolName[] = [
  "get_customer_context",
  "create_or_update_job",
  "check_availability",
  "create_booking",
  "update_booking",
  "escalate_to_owner",
];

const SYSTEM_PROMPT = `You decide whether ReplyFlow's application needs to take a real action for this WhatsApp message from a UK plumbing customer, using only the tools you're given. You do not write the customer-facing reply here — a separate step does that afterward, using whatever you find.

Call a tool only when the conversation genuinely needs it right now — a message that doesn't need an action needs no tool call at all.

Every tool already knows who this conversation's customer and job are; you only ever supply real content the customer actually stated, never an id, and never a guess.

Only call check_availability before ever proposing or confirming a specific day or time — never invent one yourself. Only call create_booking, or update_booking's reschedule action, with a start/end time that check_availability actually returned in this conversation, and only once the customer has clearly, explicitly accepted that specific time — a time merely discussed or proposed is not yet accepted.

If you are genuinely unsure what to do, call nothing rather than guessing.`;

function buildDecisionPrompt(input: DecideAndExecuteInput, job: Awaited<ReturnType<typeof findCurrentJob>>): string {
  const state = input.understanding.conversationState;
  const lines: string[] = [
    `Customer message: "${input.messageBody}"`,
    `Detected intent: ${input.understanding.primaryIntent}.`,
    `Conversation goal: ${state.goal.type} (${state.goal.status}). Stage: ${state.stage}.`,
  ];
  if (state.slots.issue) lines.push(`Known issue: ${state.slots.issue}`);
  if (state.slots.location) lines.push(`Known location: ${state.slots.location}`);
  if (state.slots.preferredTime) lines.push(`Customer's stated preferred time: ${state.slots.preferredTime}`);

  lines.push(
    job
      ? `A job already exists for this conversation — issue: ${job.issue ?? "not yet recorded"}, status: ${job.status}, ${
          job.nextBookingId ? "has an active booking" : "no active booking yet"
        }.`
      : "No job has been created for this conversation yet."
  );

  return lines.join("\n");
}

export interface DecideAndExecuteInput {
  supabase: ServiceClient;
  businessId: string;
  conversationId: string;
  episodeId: string;
  customerId: string | null;
  customerPhone: string;
  customerName: string | null;
  understanding: UnderstandingResult;
  messageBody: string;
}

export interface DecideAndExecuteResult {
  executed: ExecutedTool[];
  escalateRequested: boolean;
  escalateReason: string | null;
}

const EMPTY_RESULT: DecideAndExecuteResult = { executed: [], escalateRequested: false, escalateReason: null };

/**
 * The one entry point generate-reply.ts calls between Understanding
 * and Context Assembly. Returns immediately, with no LLM call at all,
 * for any intent that structurally can't need an action (schema.ts's
 * `toolsForIntent`) — this is what guarantees "a general question
 * never produces a tool call," deterministically, not by hoping the
 * model declines.
 */
export async function decideAndExecuteTools(input: DecideAndExecuteInput): Promise<DecideAndExecuteResult> {
  const availableTools = toolsForIntent(input.understanding.primaryIntent);
  if (availableTools.length === 0) return EMPTY_RESULT;

  // The job lookup is its own try/catch, separate from the LLM call
  // below: a DB hiccup here means we genuinely don't know whether a job
  // exists, so the deterministic backstop couldn't safely run either —
  // degrade exactly like before (no action attempted this turn,
  // generation still runs), never abort the whole message the way an
  // uncaught throw from this function would.
  let job: Awaited<ReturnType<typeof findCurrentJob>>;
  try {
    job = await findCurrentJob(input.supabase, input.episodeId);
  } catch (err) {
    await recordErrorEvent({
      severity: "warning",
      source: "reply-engine.decide_tools_failed",
      businessId: input.businessId,
      message: "Looking up the current job failed — no action was attempted for this message.",
      error: err,
      context: { episodeId: input.episodeId },
    });
    return EMPTY_RESULT;
  }

  let toolCalls: { id: string; name: string; arguments: unknown }[] = [];
  try {
    const result = await getCompletion({
      tier: "small",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildDecisionPrompt(input, job) },
      ],
      tools: availableTools.map((name) => TOOL_SCHEMAS[name]),
      toolChoice: "auto",
      maxOutputTokens: 400,
      businessId: input.businessId,
      callSite: "reply-engine.decide_tools",
    });
    toolCalls = result.toolCalls ?? [];
  } catch (err) {
    // A failed decision call must never block the reply pipeline — it
    // simply means the MODEL couldn't be asked this turn; generation
    // still runs and can answer honestly from whatever context already
    // exists (the same degrade-gracefully discipline classify.ts and
    // generate.ts already both follow on their own LLM calls). Unlike
    // before, this no longer returns immediately — the deterministic
    // backstop just below can still fire on a real, already-known job
    // lookup even though the model itself couldn't be reached.
    await recordErrorEvent({
      severity: "warning",
      source: "reply-engine.decide_tools_failed",
      businessId: input.businessId,
      message: "The tool-decision call failed — no action was attempted for this message.",
      error: err,
      context: { episodeId: input.episodeId },
    });
  }

  // Deterministic backstop (production test, 2026-08-16): job capture
  // was previously entirely at the model's discretion, with no fallback
  // when it declined or the call itself failed. `executeCreateOrUpdateJob`
  // already re-verifies `findCurrentJob` itself immediately before
  // writing and merges rather than duplicates if a job now exists — that
  // built-in safety net is what makes firing this deterministically,
  // without waiting on the model, safe. Only fires when nothing already
  // requested the same tool, no job exists yet, and enough is genuinely
  // known (an issue, plus either a location or a resolved time) that
  // creating a draft job is clearly warranted rather than guessed at.
  const slots = input.understanding.conversationState.slots;
  const alreadyRequestingJob = toolCalls.some((c) => c.name === "create_or_update_job");
  if (
    availableTools.includes("create_or_update_job") &&
    !job &&
    !alreadyRequestingJob &&
    slots.issue &&
    (slots.location || slots.preferredTimeResolved)
  ) {
    toolCalls = [
      ...toolCalls,
      {
        id: "backstop-create-or-update-job",
        name: "create_or_update_job",
        arguments: { issue: slots.issue, address: slots.location ?? null, notes: null },
      },
    ];
  }

  if (toolCalls.length === 0) return EMPTY_RESULT;

  const ctx: ToolExecutionContext = {
    supabase: input.supabase,
    businessId: input.businessId,
    conversationId: input.conversationId,
    episodeId: input.episodeId,
    customerId: input.customerId,
    customerPhone: input.customerPhone,
    customerName: input.customerName,
  };

  // Defense in depth: only ever execute a call for a tool this intent
  // was actually offered, even though the provider should never return
  // one outside the `tools` array it was sent — never trust that alone.
  const ordered = toolCalls
    .filter((call) => isToolName(call.name) && availableTools.includes(call.name))
    .sort((a, b) => EXECUTION_ORDER.indexOf(a.name as ToolName) - EXECUTION_ORDER.indexOf(b.name as ToolName));

  const executed: ExecutedTool[] = [];
  let escalateRequested = false;
  let escalateReason: string | null = null;

  for (const call of ordered) {
    const outcome = await executeTool(ctx, call.name as ToolName, call.arguments);
    executed.push(outcome);
    if (outcome.name === "escalate_to_owner" && outcome.result.ok) {
      escalateRequested = true;
      escalateReason = (outcome.result.data as { reason: string }).reason;
    }
  }

  return { executed, escalateRequested, escalateReason };
}
