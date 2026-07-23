import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendReplyToCustomer } from "@/lib/reply-engine/send";

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
    .select("id, business_id, conversation_id, customer_name, issue, scheduled_for, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!workCard) return NextResponse.json({ error: "Work Card not found" }, { status: 404 });

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
  if (workCardError) return NextResponse.json({ error: workCardError.message }, { status: 500 });

  // The Work Card is real either way past this point — a failed send
  // below never un-books it. The owner sees exactly what happened via
  // `sent`.
  await service.from("conversations").update({ status: "booked" }).eq("id", workCard.conversation_id);

  const scheduledLabel = workCard.scheduled_for
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

  return NextResponse.json({
    job: { ...workCard, status: "booked" },
    confirmationText,
    sent: sendResult.ok,
    sendError: sendResult.ok ? null : sendResult.error,
  });
}
