import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { parseAvailability, candidateSlotsForDay, hasSchedulingConflict, type SlotCandidate, type BusyInterval } from "@/lib/availability";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Plumber Reset Phase 3 step 3 — the booking engine. Everything a
 * plumber's real bookings need, deliberately nothing more (Phase 2
 * Architecture §9): no calendar product, no multi-technician
 * scheduling. Every function here re-validates against the live
 * `bookings` table itself before writing — this is the server-side
 * enforcement boundary Phase 3's sign-off requires: nothing downstream
 * (including a future AI tool call, Phase 3 step 4) can create or move
 * a booking without passing a real conflict check, and nothing can
 * claim a booking exists unless a row was actually written.
 */

const DEFAULT_SEARCH_DAYS = 14;
const MAX_SLOTS_RETURNED = 6;

export const BOOKING_COLUMNS = "id, business_id, job_id, customer_id, scheduled_start, scheduled_end, timezone, status, source, reschedule_of_id, confirmed_at, cancelled_at";

export interface BookingRow {
  id: string;
  business_id: string;
  job_id: string;
  customer_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  timezone: string;
  status: "proposed" | "confirmed" | "completed" | "cancelled";
  source: "ai" | "owner";
  reschedule_of_id: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
}

/** Real, currently-live (proposed or confirmed) bookings for a business
 * that overlap the given window — the single query every conflict
 * check in this file is built on. */
async function fetchBusyBookings(
  supabase: ServiceClient,
  businessId: string,
  from: Date,
  to: Date,
  excludeBookingId?: string
): Promise<BusyInterval[]> {
  let query = supabase
    .from("bookings")
    .select("scheduled_start, scheduled_end")
    .eq("business_id", businessId)
    .in("status", ["proposed", "confirmed"])
    .lt("scheduled_start", to.toISOString())
    .gt("scheduled_end", from.toISOString());
  if (excludeBookingId) query = query.neq("id", excludeBookingId);

  const { data } = await query;
  return (data ?? []).map((b: { scheduled_start: string; scheduled_end: string }) => ({
    start: new Date(b.scheduled_start),
    end: new Date(b.scheduled_end),
  }));
}

export interface CheckAvailabilityInput {
  businessId: string;
  durationMinutes: number;
  from?: Date;
  searchDays?: number;
  now?: Date;
}

export interface CheckAvailabilityResult {
  slots: SlotCandidate[];
}

/**
 * Real, deterministic candidate slots — never invented by an LLM. Reads
 * the business's actual weekly hours/booking rules and actual existing
 * bookings, then reuses the exact same day-level logic
 * (candidateSlotsForDay) already proven in lib/availability.test.ts.
 */
export async function checkAvailability(supabase: ServiceClient, input: CheckAvailabilityInput): Promise<CheckAvailabilityResult> {
  const now = input.now ?? new Date();
  const searchDays = input.searchDays ?? DEFAULT_SEARCH_DAYS;

  const { data: business } = await supabase
    .from("businesses")
    .select("opening_time, closing_time, availability")
    .eq("id", input.businessId)
    .maybeSingle();
  if (!business) return { slots: [] };

  const availability = parseAvailability(business.availability, business.opening_time, business.closing_time);

  const rangeStart = new Date(input.from ?? now);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + searchDays);

  const allBusy = await fetchBusyBookings(supabase, input.businessId, rangeStart, rangeEnd);

  const slots: SlotCandidate[] = [];
  for (let i = 0; i < searchDays && slots.length < MAX_SLOTS_RETURNED; i++) {
    const day = new Date(rangeStart);
    day.setDate(day.getDate() + i);
    const dayEnd = new Date(day);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayBusy = allBusy.filter((b) => b.start < dayEnd && b.end > day);

    const daySlots = candidateSlotsForDay(availability, day, input.durationMinutes, dayBusy, now);
    for (const slot of daySlots) {
      if (slots.length >= MAX_SLOTS_RETURNED) break;
      slots.push(slot);
    }
  }

  return { slots };
}

const EARLY_JOB_STATUSES = ["draft", "new_enquiry", "quote_requested", "quote_sent", "quote_accepted"];

/** A Job only ever advances toward "booked" here — never backward, and
 * never past a status the owner or the pipeline has already moved it
 * to independently (e.g. in_progress/completed must never be stomped
 * back to "booked" just because a booking was confirmed). */
async function linkConfirmedBookingToJob(supabase: ServiceClient, jobId: string, bookingId: string): Promise<void> {
  const { data: job } = await supabase.from("work_cards").select("status").eq("id", jobId).maybeSingle();
  const patch: Record<string, unknown> = { next_booking_id: bookingId };
  if (job && EARLY_JOB_STATUSES.includes(job.status)) patch.status = "booked";
  await supabase.from("work_cards").update(patch).eq("id", jobId);
}

async function linkProposedBookingToJob(supabase: ServiceClient, jobId: string, bookingId: string): Promise<void> {
  await supabase.from("work_cards").update({ next_booking_id: bookingId }).eq("id", jobId);
}

/** Only clears the pointer if it still points at this exact booking —
 * never clobbers a newer booking that may have already superseded it. */
async function clearJobBookingLinkIfMatches(supabase: ServiceClient, jobId: string, bookingId: string): Promise<void> {
  await supabase.from("work_cards").update({ next_booking_id: null }).eq("id", jobId).eq("next_booking_id", bookingId);
}

export interface CreateBookingInput {
  businessId: string;
  jobId: string;
  customerId: string | null;
  start: Date;
  end: Date;
  /** Tier 1 auto-confirm vs. Tier 2 propose-and-ask is an autonomy
   * decision made by the caller (Phase 3 step 6) — this function only
   * ever does exactly what it's told, after re-validating it's real. */
  status?: "proposed" | "confirmed";
  source: "ai" | "owner";
  timezone?: string;
}

export type CreateBookingResult =
  | { ok: true; booking: BookingRow }
  | { ok: false; reason: "conflict"; conflicting: BusyInterval[] }
  | { ok: false; reason: "invalid_window" };

/**
 * The one way a booking is ever created. Always re-validates the
 * requested window against the live table immediately before writing
 * — never trusts a caller's (or a model's) claim that a slot is free.
 */
export async function createBooking(supabase: ServiceClient, input: CreateBookingInput): Promise<CreateBookingResult> {
  if (input.end <= input.start) return { ok: false, reason: "invalid_window" };

  const busy = await fetchBusyBookings(supabase, input.businessId, input.start, input.end);
  if (hasSchedulingConflict(input.start, input.end, busy)) {
    return { ok: false, reason: "conflict", conflicting: busy };
  }

  const status = input.status ?? "proposed";
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      business_id: input.businessId,
      job_id: input.jobId,
      customer_id: input.customerId,
      scheduled_start: input.start.toISOString(),
      scheduled_end: input.end.toISOString(),
      timezone: input.timezone ?? "Europe/London",
      status,
      source: input.source,
      confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
    })
    .select(BOOKING_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(`Failed to create booking: ${error?.message ?? "unknown error"}`);
  }

  if (status === "confirmed") await linkConfirmedBookingToJob(supabase, input.jobId, data.id);
  else await linkProposedBookingToJob(supabase, input.jobId, data.id);

  return { ok: true, booking: data as BookingRow };
}

export type UpdateBookingAction =
  | { action: "confirm" }
  | { action: "cancel" }
  | {
      action: "reschedule";
      start: Date;
      end: Date;
      /** Plumber Reset Phase 3 step 5 (autonomy tiers) — whether moving
       * an already-confirmed booking should keep it confirmed. Defaults
       * to true (today's original behaviour, for an owner-initiated
       * reschedule where preserving confirmed status is correct). The
       * AI tool layer (lib/reply-engine/tools/execute.ts) always passes
       * false: an AI-initiated reschedule of a confirmed booking must
       * never silently re-confirm itself with zero owner visibility —
       * it has to go through the same Tier 1/Tier 2 evaluation as any
       * other booking action. */
      keepConfirmed?: boolean;
    };

export type UpdateBookingResult =
  | { ok: true; booking: BookingRow }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "already_terminal" }
  | { ok: false; reason: "conflict"; conflicting: BusyInterval[] }
  | { ok: false; reason: "invalid_window" };

/**
 * Confirm / cancel / reschedule — one entry point, one result shape.
 * Reschedule never mutates a booking's time in place: it cancels the
 * old row and inserts a new one linked via reschedule_of_id, so the
 * history of a job being moved stays visible rather than silently
 * overwritten (Phase 2 Architecture §9).
 */
export async function updateBooking(supabase: ServiceClient, bookingId: string, update: UpdateBookingAction): Promise<UpdateBookingResult> {
  const { data: existing } = await supabase.from("bookings").select(BOOKING_COLUMNS).eq("id", bookingId).maybeSingle();
  if (!existing) return { ok: false, reason: "not_found" };
  const current = existing as BookingRow;
  if (current.status === "cancelled" || current.status === "completed") return { ok: false, reason: "already_terminal" };

  if (update.action === "confirm") {
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", bookingId)
      .eq("status", "proposed")
      .select(BOOKING_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(`Failed to confirm booking: ${error.message}`);
    if (!data) return { ok: false, reason: "already_terminal" };
    await linkConfirmedBookingToJob(supabase, current.job_id, bookingId);
    return { ok: true, booking: data as BookingRow };
  }

  if (update.action === "cancel") {
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", bookingId)
      .select(BOOKING_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(`Failed to cancel booking: ${error.message}`);
    if (!data) return { ok: false, reason: "already_terminal" };
    await clearJobBookingLinkIfMatches(supabase, current.job_id, bookingId);
    return { ok: true, booking: data as BookingRow };
  }

  // reschedule
  if (update.end <= update.start) return { ok: false, reason: "invalid_window" };
  const busy = await fetchBusyBookings(supabase, current.business_id, update.start, update.end, bookingId);
  if (hasSchedulingConflict(update.start, update.end, busy)) {
    return { ok: false, reason: "conflict", conflicting: busy };
  }

  // Captured before the cancel-update below runs — never read off
  // `current` afterward, in case the write mutates the same in-memory
  // row (a real risk with some query-builder implementations, not just
  // this file's own tests).
  const previousStatus = current.status;
  const keepConfirmed = update.keepConfirmed ?? true;
  const newStatus = keepConfirmed && previousStatus === "confirmed" ? "confirmed" : "proposed";

  const { data: cancelledOld, error: cancelError } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("status", previousStatus)
    .select("id")
    .maybeSingle();
  if (cancelError) throw new Error(`Failed to reschedule booking: ${cancelError.message}`);
  if (!cancelledOld) return { ok: false, reason: "already_terminal" };
  const { data: created, error: insertError } = await supabase
    .from("bookings")
    .insert({
      business_id: current.business_id,
      job_id: current.job_id,
      customer_id: current.customer_id,
      scheduled_start: update.start.toISOString(),
      scheduled_end: update.end.toISOString(),
      timezone: current.timezone,
      status: newStatus,
      source: current.source,
      reschedule_of_id: bookingId,
      confirmed_at: newStatus === "confirmed" ? new Date().toISOString() : null,
    })
    .select(BOOKING_COLUMNS)
    .single();
  if (insertError || !created) throw new Error(`Failed to reschedule booking: ${insertError?.message ?? "unknown error"}`);

  if (newStatus === "confirmed") await linkConfirmedBookingToJob(supabase, current.job_id, created.id);
  else await linkProposedBookingToJob(supabase, current.job_id, created.id);

  return { ok: true, booking: created as BookingRow };
}
