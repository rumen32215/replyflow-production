import "server-only";
import type { TokenExchangeResponse, WabaPhoneNumberInfo } from "@/lib/whatsapp/types";

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

export type { WabaPhoneNumberInfo };
