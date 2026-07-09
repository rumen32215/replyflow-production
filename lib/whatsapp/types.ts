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
  [key: string]: unknown; // other message types (image/document/...) captured but not parsed yet
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
