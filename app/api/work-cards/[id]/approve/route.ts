import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendReplyToCustomer } from "@/lib/reply-engine/send";
import { recordErrorEvent } from "@/lib/error-events";
import { markEpisodeBooked } from "@/lib/reply-engine/episode";
import { createBooking, type CreateBookingResult } from "@/lib/booking/engine";
import { toConversationState } from "@/lib/reply-engine/understanding/state";
import { windowCanFitDuration } from "@/lib/datetime";
import { formatDateTime } from "@/lib/work-card-format";

/** No per-job duration data exists yet (Phase 2 Architecture §9 — a
 * per-business default was proposed, never built) — matches the same
 * fixed 60-minute default lib/reply-engine/tools/execute.ts already
 * uses for the AI booking path, so a manually-approved job and an
 * AI-proposed one read the same real slot length, not two guesses. */
const DEFAULT_BOOKING_DURATION_MINUTES = 60;

export const runtime = "nodejs";

/**
 * Approving a booking draft used to only flip two status columns —
 * the customer never actually received the confirmation the UI showed
 * them a "preview" of (explicitly labeled "not actually sent" because
 * outbound WhatsApp sending didn't exist yet). It does now (Sprint
 * 10A), so this route does what the UI always implied: update the
 * Work Card and conversation, then send the real confirmation, using
 * the same send-and-record helper the AI Reply Engine uses. Goes
 * through a server route rather than a direct client write for the
 * same reason reply-drafts approval does — sending needs the
 * business's stored Graph API token, which must never reach the
 * browser.
 *
 * Also records the audit trail (approved_by/approved_at) — the one
 * write path that currently exists for those fields
 * (DOCS/SPECS/Work-Card-Object.md §2).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();

  const { data: workCard } = await service
    .from("work_cards")
    .select("id, business_id, conversation_id, episode_id, customer_id, customer_name, issue, scheduled_for, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!workCard) return NextResponse.json({ error: "Work Card not found" }, { status: 404 });

  // QA2 Phase 5 — the customer's stated time WINDOW (not just the single
  // instant work_cards.scheduled_for holds), re-read from the same
  // source of truth the owner-facing Job Detail page already reads
  // (conversation_episodes.ai_state.slots.preferredTimeWindowEnd) so
  // this route can independently verify a standard-duration booking
  // still fits inside what the customer actually asked for — never
  // relying on the owner having seen Phase 4's UI warning.
  let preferredTimeWindowEnd: string | null = null;
  if (workCard.episode_id) {
    const { data: episode } = await service
      .from("conversation_episodes")
      .select("ai_state")
      .eq("id", workCard.episode_id)
      .maybeSingle();
    if (episode) {
      preferredTimeWindowEnd = toConversationState(episode.ai_state).slots.preferredTimeWindowEnd;
    }
  }

  const { data: business } = await service
    .from("businesses")
    .select("id, owner_id, business_name")
    .eq("id", workCard.business_id)
    .maybeSingle();
  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (workCard.status !== "draft") {
    return NextResponse.json({ error: `This Work Card is already ${workCard.status}.` }, { status: 409 });
  }

  const { error: workCardError } = await service
    .from("work_cards")
    .update({ status: "booked", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", workCard.id);
  if (workCardError) {
    await recordErrorEvent({
      severity: "error",
      source: "work-cards.approve_failed",
      businessId: workCard.business_id,
      message: "Failed to mark a Work Card as booked when the owner approved it.",
      error: workCardError,
      context: { workCardId: workCard.id },
    });
    return NextResponse.json({ error: workCardError.message }, { status: 500 });
  }

  // Plumber Reset Phase 3 step 7 — the owner's manual approval now
  // creates a real, confirmed booking through the same deterministic
  // engine the AI's own booking tools use (lib/booking/engine.ts),
  // rather than leaving the new bookings table populated only for the
  // rare AI-confirmed case. Best-effort: a real conflict here (or any
  // other failure) is logged and never blocks the approval itself —
  // the Work Card is already genuinely booked past this point either
  // way; a missing bookings row just means the Job page falls back to
  // its plain scheduled_for display instead of a richer booking card.
  let bookingResult: CreateBookingResult | null = null;
  if (workCard.scheduled_for) {
    const start = new Date(workCard.scheduled_for);
    const end = new Date(start.getTime() + DEFAULT_BOOKING_DURATION_MINUTES * 60_000);
    bookingResult = await createBooking(service, {
      businessId: workCard.business_id,
      jobId: workCard.id,
      customerId: workCard.customer_id,
      start,
      end,
      status: "confirmed",
      source: "owner",
    });
    if (!bookingResult.ok) {
      await recordErrorEvent({
        severity: "warning",
        source: "work-cards.approve_booking_create_failed",
        businessId: workCard.business_id,
        message: "A Work Card was approved, but a real booking record could not be created for it.",
        context: { workCardId: workCard.id, reason: bookingResult.reason },
      });
    } else if (
      preferredTimeWindowEnd &&
      !windowCanFitDuration(workCard.scheduled_for, preferredTimeWindowEnd, DEFAULT_BOOKING_DURATION_MINUTES)
    ) {
      // The owner has already made the explicit decision this call
      // requires (clicking Approve, having seen Phase 4's UI warning) —
      // this never blocks the booking. It's recorded purely so the
      // mismatch is visible in the audit trail, and — critically — so
      // `confirmationText` below is built from the booking's own real
      // start/end rather than ever implying it matches a window it
      // actually overflows.
      await recordErrorEvent({
        severity: "warning",
        source: "work-cards.approve_booking_exceeds_requested_window",
        businessId: workCard.business_id,
        message: "A confirmed booking's standard duration extends past the customer's originally requested time window.",
        context: {
          workCardId: workCard.id,
          bookingStart: bookingResult.booking.scheduled_start,
          bookingEnd: bookingResult.booking.scheduled_end,
          requestedWindowEnd: preferredTimeWindowEnd,
        },
      });
    }
  }

  // ReplyFlow V4 — Conversation Episodes (Contract §A): booked is not
  // a closure (no closed_at, no draft supersession — a booked episode
  // is still a real, valid future job) but it must move out of the
  // "in progress" set, so a genuinely new, unrelated request from this
  // same customer can open its own episode alongside it.
  if (workCard.episode_id) {
    await markEpisodeBooked(service, workCard.episode_id);
  }

  // The Work Card is real either way past this point — a failed send
  // below never un-books it. The owner sees exactly what happened via
  // `sent`. This status flip is a secondary/cosmetic field on the
  // conversation, not the Work Card record itself, so a failure here
  // doesn't block anything further — but it used to be fully invisible
  // (error not even read), not just unrecorded.
  const { error: conversationStatusError } = await service
    .from("conversations")
    .update({ status: "booked" })
    .eq("id", workCard.conversation_id);
  if (conversationStatusError) {
    await recordErrorEvent({
      severity: "warning",
      source: "work-cards.conversation_status_update_failed",
      businessId: workCard.business_id,
      message: "A Work Card was booked, but its conversation's status didn't update to reflect it.",
      error: conversationStatusError,
      context: { workCardId: workCard.id, conversationId: workCard.conversation_id },
    });
  }

  // QA2 Phase 5 — this used to drop the time entirely (toLocaleDateString
  // only) and never touched the real booking just created a few lines
  // above, even though its actual start/end were sitting right there.
  // When a real booking exists, describe *that* — its true confirmed
  // start/end, time included — never the customer's originally requested
  // window (which may legitimately differ, e.g. a 30-minute request that
  // became a full 60-minute visit): stating the actual booked time is
  // always truthful; implying it matches a preference it may not is not.
  const scheduledLabel =
    bookingResult?.ok
      ? formatDateTime(bookingResult.booking.scheduled_start)
      : workCard.scheduled_for
        ? new Date(workCard.scheduled_for).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })
        : null;
  const confirmationText = `Hi ${workCard.customer_name}! ${business.business_name} here — your booking for ${workCard.issue} is confirmed${
    scheduledLabel ? ` for ${scheduledLabel}` : ""
  }. See you then!`;

  const sendResult = await sendReplyToCustomer({
    supabase: service,
    businessId: workCard.business_id,
    conversationId: workCard.conversation_id,
    text: confirmationText,
  });

  // Production hardening — the Work Cards list is a separate route
  // whose own cached data has no way to know this write happened.
  revalidatePath("/dashboard/work-cards");

  return NextResponse.json({
    job: { ...workCard, status: "booked" },
    confirmationText,
    sent: sendResult.ok,
    sendError: sendResult.ok ? null : sendResult.error,
  });
}
