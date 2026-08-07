import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { getMediaUrl, downloadMedia, WhatsAppAuthError } from "@/lib/whatsapp/graph";
import { markConnectionRevoked } from "@/lib/whatsapp/connection-revoke";
import { storeCustomerMedia } from "./media-storage";
import { analyzePhoto, type PhotoAnalysis } from "./vision/analyze-photo";
import { recordErrorEvent } from "@/lib/error-events";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * The one orchestration point for "a customer sent a photo" (Phase B):
 * download from Meta -> store it -> analyse it. Called from
 * generate-reply.ts before the normal classify/generate pipeline runs,
 * so a successful result can be threaded in as ordinary context
 * (ReplyContext.photoAnalysis) rather than as a parallel system.
 *
 * Returns null on any real failure — download, storage, or analysis —
 * and the caller's own job is to fall back to the existing, already-
 * honest attachment acknowledgment rather than invent a new failure
 * mode. This function's job is only to try, record why it couldn't,
 * and never throw past its own boundary (same no-throw discipline
 * generateReplyForMessage's own top-level try/catch already expects
 * from everything it calls).
 */
export async function handleCustomerPhoto(
  supabase: ServiceClient,
  input: {
    businessId: string;
    conversationId: string;
    customerMessageId: string;
    mediaId: string;
    caption: string | null;
    trade: string;
  }
): Promise<PhotoAnalysis | null> {
  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("access_token")
    .eq("business_id", input.businessId)
    .maybeSingle();
  if (!connection) return null;

  let bytes: Uint8Array;
  let mimeType: string;
  try {
    const media = await getMediaUrl(input.mediaId, connection.access_token);
    const downloaded = await downloadMedia(media.url, connection.access_token);
    bytes = downloaded.bytes;
    mimeType = media.mimeType || downloaded.mimeType;
  } catch (err) {
    if (err instanceof WhatsAppAuthError) {
      await markConnectionRevoked(supabase, input.businessId, "reply-engine.photo_download_auth_error");
    }
    console.error("[reply-engine] photo download failed:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "reply-engine.photo_download_failed",
      businessId: input.businessId,
      message: "Could not download a customer's photo from Meta — falling back to the standard attachment acknowledgment.",
      error: err,
      context: { conversationId: input.conversationId, customerMessageId: input.customerMessageId },
    });
    return null;
  }

  let storagePath: string;
  try {
    storagePath = await storeCustomerMedia(supabase, {
      businessId: input.businessId,
      conversationId: input.conversationId,
      messageId: input.customerMessageId,
      bytes,
      mimeType,
    });
    await supabase.from("messages").update({ storage_path: storagePath, media_mime_type: mimeType }).eq("id", input.customerMessageId);
  } catch (err) {
    console.error("[reply-engine] photo storage failed:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "reply-engine.photo_storage_failed",
      businessId: input.businessId,
      message: "Could not store a customer's photo — falling back to the standard attachment acknowledgment.",
      error: err,
      context: { conversationId: input.conversationId, customerMessageId: input.customerMessageId },
    });
    return null;
  }

  // The photo is safely stored from this point on regardless of what
  // happens next — a failed analysis below still leaves a real,
  // retrievable photo on the messages row, just without a summary.
  const base64Image = Buffer.from(bytes).toString("base64");
  const analysis = await analyzePhoto({ businessId: input.businessId, trade: input.trade, base64Image, mimeType, caption: input.caption });
  if (!analysis) return null;

  await supabase.from("conversation_photos").upsert(
    {
      business_id: input.businessId,
      conversation_id: input.conversationId,
      message_id: input.customerMessageId,
      storage_path: storagePath,
      visible_summary: analysis.visible,
      possible_summary: analysis.possible,
      unknown_note: analysis.unknown,
      analysis_confidence: analysis.confidence,
    },
    { onConflict: "message_id" }
  );

  return analysis;
}
