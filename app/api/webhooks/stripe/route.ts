import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { mapStripeSubscriptionStatus } from "@/lib/billing";
import { recordErrorEvent } from "@/lib/error-events";

// Needs the Node.js runtime, same reason as the WhatsApp webhook —
// Stripe's signature verification uses node:crypto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Master Execution Plan 3.1 — Stripe's subscription lifecycle events.
 * Mirrors app/api/webhooks/whatsapp/route.ts's exact discipline: verify
 * the signature before parsing anything, always ack 200 once verified
 * (Stripe retries aggressively on non-2xx), log processing failures to
 * error_events rather than surfacing them as HTTP failures.
 *
 * Unlike the WhatsApp webhook, no upsert-on-conflict dance is needed
 * for idempotency — every handler here is a plain status/id UPDATE,
 * which is naturally idempotent: applying the same update twice (a
 * real Stripe retry) leaves the row in the same correct state either
 * time, not a duplicate row.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    console.error("[stripe webhook] rejected — STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not set in this environment.");
    await recordErrorEvent({
      severity: "critical",
      source: "billing.webhook_signature_invalid",
      businessId: null,
      message: "Stripe webhook rejected — billing is not configured in this environment.",
    });
    return NextResponse.json({ error: "Not configured" }, { status: 401 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    // Warning, not critical — same reasoning as the WhatsApp webhook's
    // signature-mismatch case: a public endpoint gets scanned, and a
    // single bad signature is routine noise, not evidence of a real
    // secret mismatch on its own.
    await recordErrorEvent({
      severity: "warning",
      source: "billing.webhook_signature_invalid",
      businessId: null,
      message: "A Stripe webhook POST had a signature that did not verify.",
      error: err,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await processStripeEvent(event);
  } catch (err) {
    console.error("[stripe webhook] processing error:", err);
    await recordErrorEvent({
      severity: "critical",
      source: "billing.webhook_processing_failed",
      businessId: null,
      message: `Unhandled error processing a real Stripe webhook event (${event.type}).`,
      error: err,
      context: { stripeEventType: event.type, stripeEventId: event.id },
    });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function processStripeEvent(event: Stripe.Event): Promise<void> {
  const supabase = createServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const businessId = session.client_reference_id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

      if (!businessId || !customerId || !subscriptionId) {
        await recordErrorEvent({
          severity: "error",
          source: "billing.webhook_missing_reference",
          businessId: businessId ?? null,
          message: "checkout.session.completed had no client_reference_id, customer, or subscription id.",
          context: { stripeEventId: event.id },
        });
        return;
      }

      const { error } = await supabase
        .from("businesses")
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: "active",
        })
        .eq("id", businessId);
      if (error) throw error;
      return;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const status =
        event.type === "customer.subscription.deleted" ? "canceled" : mapStripeSubscriptionStatus(subscription.status);

      const { error } = await supabase
        .from("businesses")
        .update({ subscription_status: status })
        .eq("stripe_subscription_id", subscription.id);
      if (error) throw error;
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // Newer Stripe API versions moved this off invoice.subscription
      // directly — it now lives under the invoice's "parent" (what
      // generated it), only present when that parent is a subscription.
      const subscriptionRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
      if (!subscriptionId) return;

      const { error } = await supabase
        .from("businesses")
        .update({ subscription_status: "past_due" })
        .eq("stripe_subscription_id", subscriptionId);
      if (error) throw error;
      return;
    }

    default:
      // Stripe sends many event types this product doesn't act on yet
      // (invoices being created, upcoming renewals, etc.) — silently
      // ignoring anything not explicitly handled above is correct, not
      // a gap: acting on every event type Stripe can send would be
      // scope far beyond "one flat plan, gated gracefully."
      return;
  }
}
