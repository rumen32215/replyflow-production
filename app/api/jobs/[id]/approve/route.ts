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
 * 10A), so this route does what the UI always implied: update the job
 * and conversation, then send the real confirmation, using the same
 * send-and-record helper the AI Reply Engine uses. Goes through a
 * server route rather than a direct client write for the same reason
 * reply-drafts approval does — sending needs the business's stored
 * Graph API token, which must never reach the browser.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();

  const { data: job } = await service
    .from("jobs")
    .select("id, business_id, conversation_id, customer_name, job_title, scheduled_for, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const { data: business } = await service
    .from("businesses")
    .select("id, owner_id, business_name")
    .eq("id", job.business_id)
    .maybeSingle();
  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (job.status !== "draft") {
    return NextResponse.json({ error: `This job is already ${job.status}.` }, { status: 409 });
  }

  const { error: jobError } = await service.from("jobs").update({ status: "booked" }).eq("id", job.id);
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });

  // The job is real either way past this point — a failed send below
  // never un-books it. The owner sees exactly what happened via `sent`.
  await service.from("conversations").update({ status: "booked" }).eq("id", job.conversation_id);

  const scheduledLabel = job.scheduled_for
    ? new Date(job.scheduled_for).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })
    : null;
  const confirmationText = `Hi ${job.customer_name}! ${business.business_name} here — your booking for ${job.job_title} is confirmed${
    scheduledLabel ? ` for ${scheduledLabel}` : ""
  }. See you then!`;

  const sendResult = await sendReplyToCustomer({
    supabase: service,
    businessId: job.business_id,
    conversationId: job.conversation_id,
    text: confirmationText,
  });

  return NextResponse.json({
    job: { ...job, status: "booked" },
    confirmationText,
    sent: sendResult.ok,
    sendError: sendResult.ok ? null : sendResult.error,
  });
}
