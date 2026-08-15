import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { checkAvailability, createBooking, updateBooking } from "@/lib/booking/engine";
import { recordProductEvent } from "@/lib/product-events";
import { recordErrorEvent } from "@/lib/error-events";
import {
  validateGetCustomerContext,
  validateCreateOrUpdateJob,
  validateCheckAvailability,
  validateCreateBooking,
  validateUpdateBooking,
  validateEscalateToOwner,
} from "./validate";
import type { ToolName, ToolResult, ExecutedTool } from "./types";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * The one place a tool call is ever actually executed. Every call is
 * validated first (validate.ts — a malformed request never reaches
 * here at all), and every downstream write goes through the exact
 * same deterministic modules already proven in Phase 3 steps 2-3
 * (lib/customers, lib/booking/engine) — this file adds no new business
 * logic of its own beyond resolving "which job/booking does this
 * conversation mean" and translating results into a typed ToolResult.
 *
 * Nothing here ever trusts a model-supplied entity id — job/booking
 * are always looked up from the episode itself (findCurrentJob below).
 */

export interface ToolExecutionContext {
  supabase: ServiceClient;
  businessId: string;
  conversationId: string;
  episodeId: string;
  customerId: string | null;
  customerPhone: string;
  customerName: string | null;
}

interface CurrentJob {
  id: string;
  issue: string | null;
  address: string | null;
  status: string;
  nextBookingId: string | null;
}

/** The one job this episode is about, if one has been created yet —
 * there is at most one live job per episode by construction (Phase 3
 * step 2's episode architecture), so "most recent" is never ambiguous. */
export async function findCurrentJob(supabase: ServiceClient, episodeId: string): Promise<CurrentJob | null> {
  const { data } = await supabase
    .from("work_cards")
    .select("id, issue, address, status, next_booking_id")
    .eq("episode_id", episodeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, issue: data.issue, address: data.address, status: data.status, nextBookingId: data.next_booking_id };
}

async function fetchAlternatives(supabase: ServiceClient, businessId: string): Promise<{ start: string; end: string }[]> {
  const result = await checkAvailability(supabase, { businessId, durationMinutes: 60 });
  return result.slots.slice(0, 3).map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() }));
}

async function executeGetCustomerContext(ctx: ToolExecutionContext): Promise<ToolResult> {
  if (!ctx.customerId) return { ok: true, data: { customer: null, recentJobs: [] } };

  const { data: customerRow } = await ctx.supabase
    .from("customers")
    .select("name, default_address, notes")
    .eq("id", ctx.customerId)
    .maybeSingle();

  const { data: jobRows } = await ctx.supabase
    .from("work_cards")
    .select("issue, status, scheduled_for, completed_at")
    .eq("customer_id", ctx.customerId)
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    ok: true,
    data: {
      customer: customerRow ? { name: customerRow.name, defaultAddress: customerRow.default_address, notes: customerRow.notes } : null,
      recentJobs: (jobRows ?? []).map((j: { issue: string | null; status: string; scheduled_for: string | null; completed_at: string | null }) => ({
        issue: j.issue,
        status: j.status,
        scheduledFor: j.scheduled_for,
        completedAt: j.completed_at,
      })),
    },
  };
}

async function executeCreateOrUpdateJob(
  ctx: ToolExecutionContext,
  args: { issue: string | null; address: string | null; notes: string | null }
): Promise<ToolResult> {
  const existing = await findCurrentJob(ctx.supabase, ctx.episodeId);

  if (!existing) {
    if (!args.issue) return { ok: false, reason: "invalid_arguments", detail: "issue is required to create a new job" };
    const { data, error } = await ctx.supabase
      .from("work_cards")
      .insert({
        business_id: ctx.businessId,
        conversation_id: ctx.conversationId,
        episode_id: ctx.episodeId,
        customer_id: ctx.customerId,
        customer_name: ctx.customerName || ctx.customerPhone,
        issue: args.issue,
        status: "draft",
        address: args.address,
        notes: args.notes,
      })
      .select("id, issue, address, status")
      .single();
    if (error || !data) throw new Error(`Failed to create job: ${error?.message ?? "unknown error"}`);
    return { ok: true, data: { jobId: data.id, issue: data.issue, address: data.address, status: data.status } };
  }

  // Merge-only semantics — never null out a value the job already has
  // just because this particular tool call didn't happen to restate it.
  const patch: Record<string, unknown> = {};
  if (args.issue) patch.issue = args.issue;
  if (args.address) patch.address = args.address;
  if (args.notes) patch.notes = args.notes;

  if (Object.keys(patch).length === 0) {
    return { ok: true, data: { jobId: existing.id, issue: existing.issue, address: existing.address, status: existing.status } };
  }

  const { data, error } = await ctx.supabase.from("work_cards").update(patch).eq("id", existing.id).select("id, issue, address, status").single();
  if (error || !data) throw new Error(`Failed to update job: ${error?.message ?? "unknown error"}`);
  return { ok: true, data: { jobId: data.id, issue: data.issue, address: data.address, status: data.status } };
}

async function executeCheckAvailability(ctx: ToolExecutionContext, args: { durationMinutes: number | null; preferredDate: string | null }): Promise<ToolResult> {
  const result = await checkAvailability(ctx.supabase, {
    businessId: ctx.businessId,
    durationMinutes: args.durationMinutes ?? 60,
    from: args.preferredDate ? new Date(args.preferredDate) : new Date(),
  });
  return { ok: true, data: { slots: result.slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })) } };
}

async function executeCreateBooking(ctx: ToolExecutionContext, args: { start: Date; end: Date }): Promise<ToolResult> {
  const job = await findCurrentJob(ctx.supabase, ctx.episodeId);
  if (!job) return { ok: false, reason: "no_job", detail: "no job exists yet for this conversation — call create_or_update_job first" };

  const result = await createBooking(ctx.supabase, {
    businessId: ctx.businessId,
    jobId: job.id,
    customerId: ctx.customerId,
    start: args.start,
    end: args.end,
    // Autonomy tiers (Phase 3 step 5) decide confirmed-vs-proposed —
    // an AI-initiated booking is never auto-confirmed here, full stop.
    status: "proposed",
    source: "ai",
  });

  if (!result.ok) {
    if (result.reason === "invalid_window") return { ok: false, reason: "invalid_window" };
    return { ok: false, reason: "conflict", alternatives: await fetchAlternatives(ctx.supabase, ctx.businessId) };
  }

  return { ok: true, data: { start: result.booking.scheduled_start, end: result.booking.scheduled_end, status: result.booking.status } };
}

async function executeUpdateBooking(
  ctx: ToolExecutionContext,
  args: { action: "confirm" | "cancel" | "reschedule"; start: Date | null; end: Date | null }
): Promise<ToolResult> {
  const job = await findCurrentJob(ctx.supabase, ctx.episodeId);
  if (!job || !job.nextBookingId) return { ok: false, reason: "no_active_booking" };

  // keepConfirmed: false — an AI-initiated reschedule of an already-
  // confirmed booking must never silently re-confirm itself; it has to
  // land as "proposed" and go through the same Tier 1/Tier 2 autonomy
  // evaluation as any other booking action (Plumber Reset Phase 3
  // step 5). Only a real owner-initiated reschedule (not built via
  // this tool path) should ever preserve confirmed status.
  const update =
    args.action === "reschedule" ? { action: "reschedule" as const, start: args.start!, end: args.end!, keepConfirmed: false } : { action: args.action };

  const result = await updateBooking(ctx.supabase, job.nextBookingId, update);
  if (!result.ok) {
    if (result.reason === "conflict") return { ok: false, reason: "conflict", alternatives: await fetchAlternatives(ctx.supabase, ctx.businessId) };
    if (result.reason === "not_found" || result.reason === "already_terminal") return { ok: false, reason: "no_active_booking" };
    return { ok: false, reason: "invalid_window" };
  }

  return { ok: true, data: { start: result.booking.scheduled_start, end: result.booking.scheduled_end, status: result.booking.status } };
}

async function executeEscalateToOwner(args: { reason: string }): Promise<ToolResult> {
  return { ok: true, data: { reason: args.reason } };
}

async function dispatch(ctx: ToolExecutionContext, name: ToolName, rawArgs: unknown): Promise<ToolResult> {
  switch (name) {
    case "get_customer_context": {
      const v = validateGetCustomerContext(rawArgs);
      return v.ok ? executeGetCustomerContext(ctx) : { ok: false, reason: "invalid_arguments", detail: v.detail };
    }
    case "create_or_update_job": {
      const v = validateCreateOrUpdateJob(rawArgs);
      return v.ok ? executeCreateOrUpdateJob(ctx, v.args) : { ok: false, reason: "invalid_arguments", detail: v.detail };
    }
    case "check_availability": {
      const v = validateCheckAvailability(rawArgs);
      return v.ok ? executeCheckAvailability(ctx, v.args) : { ok: false, reason: "invalid_arguments", detail: v.detail };
    }
    case "create_booking": {
      const v = validateCreateBooking(rawArgs);
      return v.ok ? executeCreateBooking(ctx, v.args) : { ok: false, reason: "invalid_arguments", detail: v.detail };
    }
    case "update_booking": {
      const v = validateUpdateBooking(rawArgs);
      return v.ok ? executeUpdateBooking(ctx, v.args) : { ok: false, reason: "invalid_arguments", detail: v.detail };
    }
    case "escalate_to_owner": {
      const v = validateEscalateToOwner(rawArgs);
      return v.ok ? executeEscalateToOwner(v.args) : { ok: false, reason: "invalid_arguments", detail: v.detail };
    }
  }
}

/**
 * Validates, executes, and logs one tool call. Never throws: an
 * unexpected failure inside a deterministic module (a DB error, not a
 * validation failure) is caught here and degrades to a typed
 * "execution_failed" outcome — the reply pipeline continues and can
 * still answer honestly, rather than losing the whole turn. Every
 * invocation is logged (product_events on any outcome, error_events
 * additionally on a genuine exception) — auditable without ever
 * writing customer-authored free text into either sink, matching this
 * codebase's existing data-minimisation rule for both tables.
 */
export async function executeTool(ctx: ToolExecutionContext, name: ToolName, rawArgs: unknown): Promise<ExecutedTool> {
  try {
    const result = await dispatch(ctx, name, rawArgs);
    await recordProductEvent({
      eventType: `tool.${name}`,
      businessId: ctx.businessId,
      context: {
        episodeId: ctx.episodeId,
        ok: result.ok,
        reason: result.ok ? null : result.reason,
      },
    });
    return { name, result };
  } catch (err) {
    await recordErrorEvent({
      severity: "error",
      source: "reply-engine.tool_execution_failed",
      businessId: ctx.businessId,
      message: `Tool "${name}" threw during execution.`,
      error: err,
      context: { episodeId: ctx.episodeId },
    });
    return { name, result: { ok: false, reason: "execution_failed" } };
  }
}
