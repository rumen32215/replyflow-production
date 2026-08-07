import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { sendTextMessage, WhatsAppAuthError } from "@/lib/whatsapp/graph";
import { recordErrorEvent } from "@/lib/error-events";
import { markConnectionRevoked } from "@/lib/whatsapp/connection-revoke";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type SendReplyResult = { ok: true; whatsappMessageId: string | null } | { ok: false; error: string };

/**
 * The one place a reply actually leaves ReplyFlow and reaches a real
 * customer — sends via the Graph API, then records the outbound
 * `messages` row and updates the conversation, exactly the same
 * bookkeeping every real sent message needs regardless of whether a
 * human clicked "Approve & send" or the safety layer auto-sent it.
 * Extracted so both paths call one real implementation instead of two
 * copies quietly drifting apart.
 */
export async function sendReplyToCustomer(params: {
  supabase: ServiceClient;
  businessId: string;
  conversationId: string;
  text: string;
}): Promise<SendReplyResult> {
  const { supabase, businessId, conversationId, text } = params;

  const { data: conversation } = await supabase
    .from("conversations")
    .select("customer_phone, status")
    .eq("id", conversationId)
    .maybeSingle();
  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("phone_number_id, access_token")
    .eq("business_id", businessId)
    .maybeSingle();

  if (!conversation || !connection) {
    return { ok: false, error: "Missing conversation or WhatsApp connection." };
  }

  try {
    const sendResult = await sendTextMessage(
      connection.phone_number_id,
      connection.access_token,
      conversation.customer_phone,
      text
    );
    const whatsappMessageId = sendResult.messages?.[0]?.id ?? null;

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      business_id: businessId,
      direction: "outbound",
      whatsapp_message_id: whatsappMessageId,
      from_number: connection.phone_number_id,
      to_number: conversation.customer_phone,
      message_type: "text",
      body: text,
      status: "sent",
    });

    // "open" is documented (0003) as meaning "no receptionist replies
    // exist yet" — but nothing ever moved a conversation off it once a
    // reply actually sent, so Front Desk / Mission Control kept
    // showing "waiting for you" on threads already replied to. Move it
    // to "gathering" (the existing status that reads as "I'm looking
    // after this") — never downgrade a conversation that's already
    // booked/completed/closed just because a message went out on it.
    const statusUpdate =
      conversation.status === "open" || conversation.status === "new" ? { status: "gathering" as const } : {};

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString(), last_message_preview: text.slice(0, 140), ...statusUpdate })
      .eq("id", conversationId);

    return { ok: true, whatsappMessageId };
  } catch (err) {
    if (err instanceof WhatsAppAuthError) {
      // Distinct from an ordinary send failure: the connection itself
      // is no longer valid, not just this one message. Recorded once
      // (markConnectionRevoked is idempotent) so Front Desk stops
      // reading "healthy" and the owner gets a clear reconnect path.
      await markConnectionRevoked(supabase, businessId, "reply-engine.send_auth_error");
    } else {
      // A drafted reply that was approved (or auto-sent) failed to
      // actually reach the customer — real, customer-visible impact,
      // distinct from an internal LLM hiccup.
      await recordErrorEvent({
        severity: "error",
        source: "reply-engine.send_failed",
        businessId,
        message: "sendReplyToCustomer failed — an approved/auto-sent reply did not reach the customer.",
        error: err,
        context: { conversationId },
      });
    }
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send message." };
  }
}
