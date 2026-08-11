import type { WhatsAppInboundMessage } from "./types";

/**
 * ReplyFlow V4 (P1.E) — pure classification of one inbound WhatsApp
 * message, extracted out of the webhook route so the actual branching
 * (text / image / unsupported / anything else) is testable without a
 * live request or a Supabase client. Same convention as lib/front-desk-
 * signals.ts: mechanical, no side effects, no I/O.
 *
 * The bug this closes: a real live test sent 4 photos in one rapid
 * batch; 3 arrived as type "image" and were analysed correctly, 1
 * arrived as type "unsupported" — a real, documented WhatsApp Cloud
 * API behaviour for certain grouped/multi-select media sends — and
 * fell through to a generic fallback with zero trace anywhere. Meta
 * never attaches a media object to an "unsupported" message, so there
 * is nothing to download in that case (this does not blindly try to
 * treat it as an image) — but it must no longer be silent.
 */
export interface DerivedInboundMessage {
  /** What gets stored on the message row and, for non-media types,
   * shown to the reply engine as the customer's message text. */
  body: string;
  /** Present only for type === "image" with a real media id — the one
   * case a download is ever attempted. */
  mediaId: string | null;
  mediaCaption: string | null;
  isUnsupported: boolean;
  /** Meta's own explanation, when it gives one (message.errors[0]) —
   * null if Meta reported "unsupported" with no detail at all. */
  unsupportedDetail: string | null;
}

export function deriveInboundMessage(message: WhatsAppInboundMessage): DerivedInboundMessage {
  if (message.type === "text") {
    return { body: message.text?.body ?? "", mediaId: null, mediaCaption: null, isUnsupported: false, unsupportedDetail: null };
  }

  if (message.type === "image") {
    const caption = message.image?.caption ?? null;
    return {
      body: caption ? caption : "[image message]",
      mediaId: message.image?.id ?? null,
      mediaCaption: caption,
      isUnsupported: false,
      unsupportedDetail: null,
    };
  }

  if (message.type === "unsupported") {
    const metaError = Array.isArray(message.errors) ? message.errors[0] : undefined;
    const detail = metaError?.title || metaError?.message || metaError?.error_data?.details || null;
    return {
      body: "[unsupported message]",
      mediaId: null,
      mediaCaption: null,
      isUnsupported: true,
      unsupportedDetail: detail,
    };
  }

  // document/audio/video/location, or anything else Meta ever adds —
  // never attempted as media, always the same honest fallback body
  // this already used before this change.
  return { body: `[${message.type} message]`, mediaId: null, mediaCaption: null, isUnsupported: false, unsupportedDetail: null };
}
