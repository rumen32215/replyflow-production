/**
 * Minimal typing for the pieces of Meta's WhatsApp Cloud API payloads
 * ReplyFlow actually reads. Not exhaustive — Meta's webhook payload has
 * many more optional fields (reactions, statuses, media, etc.); add
 * them here as each is actually handled rather than typing the whole
 * API surface speculatively.
 */

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string; // WABA id
    changes: Array<{
      field: string;
      value: {
        messaging_product: "whatsapp";
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<WhatsAppInboundMessage>;
      };
    }>;
  }>;
}

export interface WhatsAppInboundMessage {
  id: string;
  from: string; // customer's phone number (E.164, no +)
  timestamp: string;
  type: "text" | "image" | "document" | "audio" | "video" | "location" | string;
  text?: { body: string };
  /** Present when type === "image" — id is the media id used with
   * GET /{media-id} (lib/whatsapp/graph.ts's getMediaUrl) to resolve a
   * short-lived download URL. Meta re-reports mime_type at that lookup
   * too; the webhook-delivered value here is only used as a fallback. */
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  /** Present when type === "unsupported" — Meta's own explanation of
   * why it couldn't classify this message (real-world cause: one
   * photo in a rapid multi-image send occasionally arrives this way
   * instead of as type "image"). No media object accompanies it — see
   * lib/whatsapp/inbound-message.ts for how this is handled. */
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
  [key: string]: unknown; // other message types (document/audio/video/location) captured but not parsed yet
}

export interface TokenExchangeResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface WabaPhoneNumberInfo {
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
}

export interface SendTextMessageResponse {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}
