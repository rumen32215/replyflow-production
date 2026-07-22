import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { sendTextMessage } from "@/lib/whatsapp/graph";

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
    .select("customer_phone")
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

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString(), last_message_preview: text.slice(0, 140) })
      .eq("id", conversationId);

    return { ok: true, whatsappMessageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send message." };
  }
}
