import "server-only";
import type { SendTextMessageResponse, TokenExchangeResponse, WabaPhoneNumberInfo } from "@/lib/whatsapp/types";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v20.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. WhatsApp Embedded Signup needs this set in .env.local — see .env.example.`
    );
  }
  return value;
}

/**
 * Thrown instead of a generic Error when the Graph API's own response
 * carries error.code === 190 ("Error validating access token") — the
 * stable, long-documented Facebook/Graph API contract for a token that
 * is expired, malformed, or has had its access revoked (by the
 * merchant, or by Meta). Callers that hold a Supabase service client
 * catch this specifically to mark the connection revoked
 * (lib/whatsapp/connection-health-alert.ts's markConnectionRevoked)
 * rather than treating it as an ordinary transient send/refresh
 * failure that's worth retrying later.
 */
export class WhatsAppAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppAuthError";
  }
}

function isGraphAuthErrorCode(data: unknown): boolean {
  const code = (data as { error?: { code?: number } } | undefined)?.error?.code;
  return code === 190;
}

/**
 * Exchanges the short-lived authorization `code` returned by the
 * Embedded Signup popup for an access token. This must happen
 * server-side — it requires the App Secret, which can never be sent
 * to the browser.
 */
export async function exchangeCodeForToken(code: string): Promise<TokenExchangeResponse> {
  const appId = requireEnv("WHATSAPP_APP_ID");
  const appSecret = requireEnv("WHATSAPP_APP_SECRET");

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString(), { method: "GET" });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Graph API token exchange failed: ${data?.error?.message || res.statusText}`);
  }
  return data as TokenExchangeResponse;
}

/**
 * Extends a still-valid access token's life via Meta's documented
 * long-lived-token exchange (`grant_type=fb_exchange_token`) — the
 * same standard Facebook Login/Graph API mechanism every product built
 * on Graph API tokens uses, not something specific to (or invented
 * for) WhatsApp. This is what keeps a connection alive indefinitely
 * without ever re-running Embedded Signup: called periodically, well
 * before the current token's expiry, each call yields a fresh token
 * with a renewed expiry.
 *
 * Only works on a token that hasn't already expired or been revoked —
 * see app/api/cron/whatsapp-token-refresh, which is why it runs days
 * ahead of expiry rather than reactively.
 */
export async function refreshLongLivedToken(currentAccessToken: string): Promise<TokenExchangeResponse> {
  const appId = requireEnv("WHATSAPP_APP_ID");
  const appSecret = requireEnv("WHATSAPP_APP_SECRET");

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", currentAccessToken);

  const res = await fetch(url.toString(), { method: "GET" });
  const data = await res.json();

  if (!res.ok) {
    if (isGraphAuthErrorCode(data)) throw new WhatsAppAuthError(data?.error?.message || "Access token is invalid or revoked.");
    throw new Error(`Graph API token refresh failed: ${data?.error?.message || res.statusText}`);
  }
  return data as TokenExchangeResponse;
}

/**
 * Resolves a media id (from an inbound image message's `image.id`) to
 * a short-lived, authenticated download URL — Meta's standard two-step
 * media retrieval (GET /{media-id} first, then a separate authenticated
 * fetch of the URL it returns; the URL itself is not public and still
 * requires the same Bearer token). Same request/error shape as every
 * other function in this file.
 */
export async function getMediaUrl(
  mediaId: string,
  accessToken: string
): Promise<{ url: string; mimeType: string; fileSize: number | null }> {
  const url = `${GRAPH_BASE}/${mediaId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();

  if (!res.ok) {
    if (isGraphAuthErrorCode(data)) throw new WhatsAppAuthError(data?.error?.message || "Access token is invalid or revoked.");
    throw new Error(`Graph API media lookup failed: ${data?.error?.message || res.statusText}`);
  }
  if (typeof data.url !== "string") {
    throw new Error("Graph API media lookup succeeded but returned no download URL.");
  }
  return { url: data.url, mimeType: typeof data.mime_type === "string" ? data.mime_type : "application/octet-stream", fileSize: typeof data.file_size === "number" ? data.file_size : null };
}

/**
 * Downloads the actual media bytes from the URL getMediaUrl resolved.
 * Still requires the Bearer token — Meta's media URLs are not public.
 */
export async function downloadMedia(mediaUrl: string, accessToken: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const res = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Failed to download media from Meta: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  return { bytes: new Uint8Array(arrayBuffer), mimeType };
}

/**
 * Confirms the phone number's details directly with Meta rather than
 * trusting whatever the client-side SDK reported — the server should
 * treat the browser as untrusted input, even for IDs.
 */
export async function getPhoneNumberDetails(
  phoneNumberId: string,
  accessToken: string
): Promise<{ display_phone_number: string; verified_name: string }> {
  const url = `${GRAPH_BASE}/${phoneNumberId}?fields=display_phone_number,verified_name`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Graph API phone number lookup failed: ${data?.error?.message || res.statusText}`);
  }
  return data;
}

/**
 * Subscribes our app to receive webhook events for this WhatsApp
 * Business Account. Without this call, messages will never reach
 * app/api/webhooks/whatsapp — the webhook URL configured on the Meta
 * App only receives events for WABAs that have been subscribed.
 */
export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<void> {
  const url = `${GRAPH_BASE}/${wabaId}/subscribed_apps`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();

  if (!res.ok || data?.success !== true) {
    throw new Error(`Failed to subscribe app to WABA webhooks: ${data?.error?.message || res.statusText}`);
  }
}

/**
 * The one outbound send capability Sprint 10A needs: a plain text
 * reply to a customer who has already messaged in (within Meta's
 * 24-hour customer-service window — no template message support here,
 * that's future work for messages initiated outside that window).
 * Same request/error-handling shape as every other function in this
 * file — Bearer auth via the connection's stored access_token, throw
 * with the Graph API's own error message on failure.
 */
export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  body: string
): Promise<SendTextMessageResponse> {
  const url = `${GRAPH_BASE}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  const data = await res.json();

  if (!res.ok) {
    if (isGraphAuthErrorCode(data)) throw new WhatsAppAuthError(data?.error?.message || "Access token is invalid or revoked.");
    throw new Error(`Graph API send message failed: ${data?.error?.message || res.statusText}`);
  }
  return data as SendTextMessageResponse;
}

/**
 * Marks an inbound message as read (blue ticks) and, in the same call,
 * requests WhatsApp's built-in typing indicator — Conversation
 * Experience Review §7: today a customer's message sits at "delivered"
 * with zero acknowledgement until the full reply eventually lands,
 * which can genuinely be minutes given the approval-queue flow. Meta
 * expires the typing indicator itself (~25s or once the next message
 * sends, whichever first) — this code never has to track or clear it,
 * and it never claims anything false: it just signals "seen" the
 * moment it's true.
 *
 * Deliberately best-effort, unlike every other function in this file:
 * a failed courtesy read-receipt must never block the real reply
 * pipeline, so this never throws — but it does report back whether the
 * failure was specifically an auth error (code 190), since this call
 * fires on every single inbound message and is therefore the fastest
 * real signal available that a connection has been revoked. The caller
 * (the webhook handler, which already holds a service client) decides
 * what to do with that; this function stays a pure best-effort network
 * call, matching every other convention in this file.
 */
export async function markMessageAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string
): Promise<{ ok: boolean; authError: boolean }> {
  const url = `${GRAPH_BASE}/${phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
        typing_indicator: { type: "text" },
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      console.error(`[whatsapp] mark-as-read failed: ${data?.error?.message || res.statusText}`);
      return { ok: false, authError: isGraphAuthErrorCode(data) };
    }
    return { ok: true, authError: false };
  } catch (err) {
    console.error("[whatsapp] mark-as-read request failed:", err);
    return { ok: false, authError: false };
  }
}

export type { WabaPhoneNumberInfo };
