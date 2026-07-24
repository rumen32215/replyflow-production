import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateReplyForMessage } from "@/lib/reply-engine/generate-reply";
import { TEST_CONVERSATION_PHONE, TEST_CONVERSATION_NAME } from "@/lib/test-conversation";

export const runtime = "nodejs";

/**
 * Test Conversations — "Try to break me" (`03-Trust-Experience.md`
 * §4; roadmap items A2/A3). Drives the real, unmodified reply pipeline
 * (`generateReplyForMessage` — the same function the WhatsApp webhook
 * calls) in-process against a reserved, tagged conversation
 * (`lib/test-conversation.ts`), rather than a mock or a simplified
 * stand-in — otherwise "watch how she'd really handle this" would be
 * a lie. Unlike the webhook, this awaits the pipeline directly instead
 * of firing it via `waitUntil`, since a real request/response call is
 * exactly what a synchronous chat UI needs, and there's no Meta ACK
 * deadline to protect here.
 */
export async function POST(request: NextRequest) {
  const session = createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { messageBody?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const messageBody = typeof body.messageBody === "string" ? body.messageBody.trim() : "";
  if (!messageBody) return NextResponse.json({ error: "A message is required." }, { status: 400 });

  const service = createServiceClient();

  const { data: business } = await service.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!business) return NextResponse.json({ error: "No business found for this account." }, { status: 404 });

  const nowIso = new Date().toISOString();

  const { data: conversation } = await service
    .from("conversations")
    .upsert(
      {
        business_id: business.id,
        customer_phone: TEST_CONVERSATION_PHONE,
        customer_name: TEST_CONVERSATION_NAME,
        last_message_at: nowIso,
        last_message_preview: messageBody.slice(0, 140),
        status: "open",
      },
      { onConflict: "business_id,customer_phone" }
    )
    .select("id")
    .single();
  if (!conversation) return NextResponse.json({ error: "Could not start the test conversation." }, { status: 500 });

  const { data: insertedMessage } = await service
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      business_id: business.id,
      direction: "inbound",
      whatsapp_message_id: `test.${conversation.id}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
      from_number: TEST_CONVERSATION_PHONE,
      to_number: "test",
      message_type: "text",
      body: messageBody,
    })
    .select("id")
    .single();
  if (!insertedMessage) return NextResponse.json({ error: "Could not record the test message." }, { status: 500 });

  await generateReplyForMessage({
    businessId: business.id,
    conversationId: conversation.id,
    customerMessageId: insertedMessage.id,
    messageBody,
  });

  const { data: draft } = await service
    .from("reply_drafts")
    .select("draft_text, final_text, intent, confidence, requires_escalation, escalation_reason, facts_used, status")
    .eq("customer_message_id", insertedMessage.id)
    .maybeSingle();

  if (!draft) {
    // The Readiness Gate inside generateReplyForMessage silently skips
    // drafting altogether when the business hasn't taught enough yet —
    // the same honest signal a real customer's message would get, just
    // surfaced here in a way a test UI can actually explain.
    return NextResponse.json({
      draft: null,
      notReady: true,
      message: "I need a bit more teaching before I can try this for real — head back and finish a few more topics first.",
    });
  }

  return NextResponse.json({ draft });
}

/** Clears this business's test conversation history so a fresh "Try
 * to break me" session starts clean, never accumulating indefinitely
 * across repeat visits. */
export async function DELETE() {
  const session = createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();
  const { data: business } = await service.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!business) return NextResponse.json({ error: "No business found for this account." }, { status: 404 });

  const { data: conversation } = await service
    .from("conversations")
    .select("id")
    .eq("business_id", business.id)
    .eq("customer_phone", TEST_CONVERSATION_PHONE)
    .maybeSingle();
  if (!conversation) return NextResponse.json({ ok: true });

  await service.from("reply_drafts").delete().eq("conversation_id", conversation.id);
  await service.from("messages").delete().eq("conversation_id", conversation.id);
  await service.from("conversations").update({ ai_state: null, last_message_preview: null }).eq("id", conversation.id);

  return NextResponse.json({ ok: true });
}
