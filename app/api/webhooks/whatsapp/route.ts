import { NextResponse, type NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { verifyWebhookSignature } from "@/lib/whatsapp/verify-signature";
import { createServiceClient } from "@/lib/supabase/service";
import { generateReplyForMessage } from "@/lib/reply-engine/generate-reply";
import { markMessageAsRead } from "@/lib/whatsapp/graph";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/types";
import { recordErrorEvent } from "@/lib/error-events";
import { buildConnectionHealthAlert } from "@/lib/whatsapp/connection-health-alert";

// Needs the Node.js runtime (not Edge) for node:crypto in verify-signature.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta's one-time verification handshake. When you register this URL
 * as the webhook in your Meta App's WhatsApp settings, Meta calls this
 * with hub.mode=subscribe and a hub.challenge value — echoing the
 * challenge back (as plain text, verbatim) is what confirms the
 * endpoint to Meta. hub.verify_token must match what you typed into
 * the Meta dashboard, which must match WHATSAPP_WEBHOOK_VERIFY_TOKEN
 * here — this is a value *you* choose, not something Meta issues.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token && expectedToken && token === expectedToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  // Never log the token values themselves — only which precondition
  // failed, so a real cause is visible in the logs instead of a bare
  // 403 that looks identical whether the env var is unset, the mode is
  // wrong, or someone is just probing the endpoint.
  if (!expectedToken) {
    console.error("[whatsapp webhook] GET verification failed — WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set in this environment.");
  } else if (mode !== "subscribe") {
    console.warn(`[whatsapp webhook] GET verification failed — unexpected hub.mode "${mode}".`);
  } else if (!token || token !== expectedToken) {
    console.error("[whatsapp webhook] GET verification failed — hub.verify_token did not match WHATSAPP_WEBHOOK_VERIFY_TOKEN.");
  }

  return new NextResponse("Verification failed", { status: 403 });
}

/**
 * Incoming message events. Always verify the signature before parsing
 * — this endpoint has no other auth, it's a public URL by necessity.
 * Uses the service-role client because there's no logged-in user here;
 * Meta is calling us server-to-server.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  // Same principle as the GET handler: distinguish "not configured" from
  // "configured but wrong" in the logs (never in the HTTP response, and
  // never logging the secret or signature values themselves) — these
  // used to be indistinguishable, which made this failure silent in
  // practice even though it returned a 401.
  if (!appSecret) {
    console.error("[whatsapp webhook] POST rejected — WHATSAPP_APP_SECRET is not set in this environment.");
    // Critical: every single inbound customer message is blocked while
    // this is true — a total outage of the entire receive path.
    await recordErrorEvent({
      severity: "critical",
      source: "webhook.signature_invalid",
      businessId: null,
      message: "WHATSAPP_APP_SECRET is not set — every inbound WhatsApp message is being rejected.",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
    console.error(
      "[whatsapp webhook] POST rejected — signature did not match. WHATSAPP_APP_SECRET is set but does not match the App Secret Meta signed this request with."
    );
    // Warning, not critical: a public endpoint gets scanned, and a
    // single bad signature is often just noise. A real secret rotation
    // gone wrong shows up as a sustained rate, not one occurrence — see
    // scripts/monitoring/error-summary.mjs. Never logs the signature or
    // secret values themselves.
    await recordErrorEvent({
      severity: "warning",
      source: "webhook.signature_invalid",
      businessId: null,
      message: "A webhook POST had a signature that did not match WHATSAPP_APP_SECRET.",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await recordErrorEvent({
      severity: "warning",
      source: "webhook.invalid_payload",
      businessId: null,
      message: "A webhook POST had a validly-signed but non-JSON body.",
    });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Always ack 200 after this point — Meta retries aggressively (and
  // can disable the subscription) on non-200s or timeouts. Processing
  // errors are logged, not surfaced as HTTP failures, so one malformed
  // event can't block delivery of everything after it.
  try {
    await processWebhookPayload(payload);
  } catch (err) {
    console.error("[whatsapp webhook] processing error:", err);
    // Critical: an uncaught exception while processing a real batch of
    // inbound messages — every message in this batch may be affected.
    await recordErrorEvent({
      severity: "critical",
      source: "webhook.processing_failed",
      businessId: null,
      message: "processWebhookPayload threw an unhandled error while processing a real inbound webhook event.",
      error: err,
    });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function processWebhookPayload(payload: WhatsAppWebhookPayload) {
  if (payload.object !== "whatsapp_business_account") return;

  const supabase = createServiceClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const { metadata, contacts, messages } = change.value;
      if (!messages?.length) continue; // e.g. status updates (delivered/read) — not handled yet

      const { data: connection } = await supabase
        .from("whatsapp_connections")
        .select("business_id, access_token, token_expires_at")
        .eq("phone_number_id", metadata.phone_number_id)
        .maybeSingle();

      if (!connection) {
        console.warn(`[whatsapp webhook] no business found for phone_number_id ${metadata.phone_number_id}`);
        continue;
      }

      // SLI follow-up (ReplyFlow-SLIs-SLOs.md §2) — every real inbound
      // message already reaches this exact point, regardless of
      // whether our own access token can still call the Graph API to
      // send/read-receipt back. That makes it the one chokepoint where
      // a broken connection can be caught without any new polling
      // infrastructure. Best-effort and never blocking (mirrors every
      // other observability call in this handler) — a failed check
      // here must never affect a real customer's message.
      await maybeRecordConnectionHealthAlert(supabase, connection.business_id, connection.token_expires_at);

      for (const message of messages) {
        const customerName = contacts?.find((c) => c.wa_id === message.from)?.profile.name ?? null;
        const body = message.type === "text" ? message.text?.body ?? "" : `[${message.type} message]`;
        const receivedAt = new Date(Number(message.timestamp) * 1000).toISOString();

        const { data: conversation } = await supabase
          .from("conversations")
          .upsert(
            {
              business_id: connection.business_id,
              customer_phone: message.from,
              customer_name: customerName,
              last_message_at: receivedAt,
              last_message_preview: body.slice(0, 140),
              status: "open",
            },
            { onConflict: "business_id,customer_phone" }
          )
          .select("id")
          .single();

        if (!conversation) continue;

        // whatsapp_message_id is unique — Meta retries webhook delivery,
        // so this upsert (rather than insert) makes re-delivery a no-op
        // instead of a duplicate message.
        const { data: insertedMessage } = await supabase
          .from("messages")
          .upsert(
            {
              conversation_id: conversation.id,
              business_id: connection.business_id,
              direction: "inbound",
              whatsapp_message_id: message.id,
              from_number: message.from,
              to_number: metadata.phone_number_id,
              message_type: message.type,
              body,
            },
            { onConflict: "whatsapp_message_id" }
          )
          .select("id")
          .single();

        // Conversation Experience Review §7 — mark it read (and request
        // WhatsApp's typing indicator) the moment it arrives, regardless
        // of message type, rather than leaving the customer at
        // "delivered" with no acknowledgement until the full reply
        // eventually lands. Best-effort and never blocking: a failed
        // read receipt must never hold up the actual reply pipeline.
        if (insertedMessage) {
          waitUntil(markMessageAsRead(metadata.phone_number_id, connection.access_token, message.id));
        }

        // Reply Engine trigger (Sprint 10A) — deferred via waitUntil so
        // the LLM call never delays this handler's ACK to Meta. Real
        // understanding/generation is still text-only (Sprint 9.1 §8) —
        // generateReplyForMessage's own messageType check routes any
        // other type straight to a fixed, honest acknowledgment instead
        // of the LLM pipeline, closing a real, evidenced gap (a
        // non-text message used to get no reply drafted at all).
        if (insertedMessage) {
          waitUntil(
            generateReplyForMessage({
              businessId: connection.business_id,
              conversationId: conversation.id,
              customerMessageId: insertedMessage.id,
              messageBody: body,
              messageType: message.type,
            })
          );
        }
      }
    }
  }
}

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Dedup window: a broken connection stays broken across many inbound
 * messages, and an active business could otherwise generate one
 * critical error_events row (and one incident-alert webhook POST, once
 * INCIDENT_ALERT_WEBHOOK_URL is configured) per message. One row per
 * window keeps the incident visible without flooding whatever channel
 * ends up watching it. Critical (already broken) gets a tighter window
 * than warning (expiring soon, no customer impact yet) since it's the
 * more urgent, more actionable of the two.
 */
const ALERT_DEDUP_WINDOW_MS: Record<"critical" | "warning" | "error", number> = {
  critical: 60 * 60 * 1000,
  warning: 24 * 60 * 60 * 1000,
  error: 60 * 60 * 1000,
};

async function maybeRecordConnectionHealthAlert(
  supabase: ServiceClient,
  businessId: string,
  tokenExpiresAt: string | null
): Promise<void> {
  const alert = buildConnectionHealthAlert({ tokenExpiresAt, now: new Date() });
  if (!alert) return;

  try {
    const since = new Date(Date.now() - ALERT_DEDUP_WINDOW_MS[alert.severity]).toISOString();
    const { data: recent } = await supabase
      .from("error_events")
      .select("id")
      .eq("business_id", businessId)
      .eq("source", alert.source)
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) return; // already recorded (and, if configured, alerted) recently

    await recordErrorEvent({
      severity: alert.severity,
      source: alert.source,
      businessId,
      message: alert.message,
    });
  } catch (err) {
    // Observability, not a pipeline dependency — must never affect the
    // real message this webhook call is otherwise processing.
    console.error("[whatsapp webhook] connection health check failed:", err);
  }
}
