import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendTextMessage } from "@/lib/whatsapp/graph";

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
    .select("id, business_id, conversation_id, draft_text, final_text, status")
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
    return NextResponse.json({ draft: updated });
  }

  // action === "approve" — send for real.
  const textToSend = (draft.final_text ?? draft.draft_text ?? "").trim();
  if (!textToSend) {
    return NextResponse.json({ error: "This draft has no text to send." }, { status: 400 });
  }

  const { data: conversation } = await service
    .from("conversations")
    .select("customer_phone")
    .eq("id", draft.conversation_id)
    .maybeSingle();
  const { data: connection } = await service
    .from("whatsapp_connections")
    .select("phone_number_id, access_token")
    .eq("business_id", draft.business_id)
    .maybeSingle();

  if (!conversation || !connection) {
    return NextResponse.json({ error: "Missing conversation or WhatsApp connection." }, { status: 500 });
  }

  try {
    const sendResult = await sendTextMessage(
      connection.phone_number_id,
      connection.access_token,
      conversation.customer_phone,
      textToSend
    );
    const sentMessageId = sendResult.messages?.[0]?.id;

    await service.from("messages").insert({
      conversation_id: draft.conversation_id,
      business_id: draft.business_id,
      direction: "outbound",
      whatsapp_message_id: sentMessageId ?? null,
      from_number: connection.phone_number_id,
      to_number: conversation.customer_phone,
      message_type: "text",
      body: textToSend,
      status: "sent",
    });

    await service
      .from("conversations")
      .update({ last_message_at: new Date().toISOString(), last_message_preview: textToSend.slice(0, 140) })
      .eq("id", draft.conversation_id);

    const { data: updated } = await service
      .from("reply_drafts")
      .update({ status: "sent", resolved_at: new Date().toISOString() })
      .eq("id", draft.id)
      .select()
      .single();

    return NextResponse.json({ draft: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send message.";
    await service.from("reply_drafts").update({ status: "failed", error_message: message }).eq("id", draft.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
