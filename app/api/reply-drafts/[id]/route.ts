import { NextResponse, type NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendReplyToCustomer } from "@/lib/reply-engine/send";
import { recordProductEvent } from "@/lib/product-events";
import { detectAndProposeLearning } from "@/lib/reply-engine/learning/detect-and-propose";

export const runtime = "nodejs";

/**
 * Resolves one AI-drafted reply — approve (and send), edit, or reject.
 * This goes through a server route rather than a direct client-side
 * Supabase write (unlike jobs' approve/reject, which write straight
 * from the browser) for one reason: approving sends a real WhatsApp
 * message using the business's stored Graph API access token, which
 * must never reach the browser. reply_drafts' own RLS only grants
 * owners SELECT — every write, including resolving a draft, happens
 * here with the service role after an explicit ownership check.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { action?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { action } = body;
  if (action !== "approve" && action !== "edit" && action !== "reject") {
    return NextResponse.json({ error: "action must be approve, edit, or reject" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: draft } = await service
    .from("reply_drafts")
    .select("id, business_id, conversation_id, draft_text, final_text, status, category, customer_message_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const { data: business } = await service
    .from("businesses")
    .select("id, owner_id, business_name")
    .eq("id", draft.business_id)
    .maybeSingle();
  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (draft.status !== "pending") {
    return NextResponse.json({ error: `This draft is already ${draft.status}.` }, { status: 409 });
  }

  if (action === "reject") {
    const { data: updated } = await service
      .from("reply_drafts")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("id", draft.id)
      .select()
      .single();
    // Master Execution Plan 3.2 — status='rejected'/resolved_at already
    // make this queryable directly from reply_drafts; recorded here too
    // so approve/edit/reject live in one consistent stream for the
    // approve/edit/reject ratio 3.4 wants, rather than three different
    // derivations.
    await recordProductEvent({ eventType: "draft.rejected", businessId: draft.business_id, context: { draftId: draft.id } });
    return NextResponse.json({ draft: updated });
  }

  if (action === "edit") {
    if (typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json({ error: "text is required to edit a draft" }, { status: 400 });
    }
    const { data: updated } = await service
      .from("reply_drafts")
      .update({ final_text: body.text.trim() })
      .eq("id", draft.id)
      .select()
      .single();
    // Master Execution Plan 3.2 — genuinely new: editing never touched
    // status/resolved_at before this, so "a draft was edited, and when"
    // had no queryable trace anywhere prior to this event.
    await recordProductEvent({ eventType: "draft.edited", businessId: draft.business_id, context: { draftId: draft.id } });

    // Learning Memory Stage 8 (doc 12) — deferred, non-blocking, same
    // waitUntil pattern the WhatsApp webhook already uses for
    // generateReplyForMessage: the owner's save must never wait on this.
    waitUntil(
      detectAndProposeLearning({
        supabase: service,
        businessId: draft.business_id,
        replyDraftId: draft.id,
        customerMessageId: draft.customer_message_id,
        category: draft.category,
        originalDraft: draft.draft_text ?? "",
        editedDraft: body.text.trim(),
      })
    );

    return NextResponse.json({ draft: updated });
  }

  // action === "approve" — send for real.
  const textToSend = (draft.final_text ?? draft.draft_text ?? "").trim();
  if (!textToSend) {
    return NextResponse.json({ error: "This draft has no text to send." }, { status: 400 });
  }

  const result = await sendReplyToCustomer({
    supabase: service,
    businessId: draft.business_id,
    conversationId: draft.conversation_id,
    text: textToSend,
  });

  if (!result.ok) {
    await service.from("reply_drafts").update({ status: "failed", error_message: result.error }).eq("id", draft.id);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const { data: updated } = await service
    .from("reply_drafts")
    .update({ status: "sent", resolved_at: new Date().toISOString() })
    .eq("id", draft.id)
    .select()
    .single();

  // Master Execution Plan 3.2 — genuinely new: reply_drafts.status
  // lands on the identical 'sent' value whether an owner explicitly
  // approved this or the reply engine auto-sent it (generate-reply.ts's
  // own auto-send path) — status alone can't distinguish "an owner
  // took this action" from "the system did," which is exactly what
  // "draft approve/edit/reject" is meant to measure. Only ever fired
  // here, on this owner-facing route, never from auto-send.
  await recordProductEvent({ eventType: "draft.approved", businessId: draft.business_id, context: { draftId: draft.id } });

  return NextResponse.json({ draft: updated });
}
