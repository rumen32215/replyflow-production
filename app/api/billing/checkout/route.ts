import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripeClient } from "@/lib/stripe";
import { recordErrorEvent } from "@/lib/error-events";

export const runtime = "nodejs";

/**
 * Master Execution Plan 3.1 — starts a real Stripe Checkout session
 * for the one flat plan. Never touches a card number directly (Stripe
 * Checkout is hosted, PCI compliance stays entirely on Stripe's side —
 * the same "keep payment credentials off ReplyFlow's own systems"
 * choice the Operations Blueprint already named).
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const stripe = getStripeClient();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripe || !priceId) {
    return NextResponse.json({ error: "Billing isn't set up yet — try again shortly." }, { status: 503 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, business_name, subscription_status, stripe_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return NextResponse.json({ error: "No business found for this account." }, { status: 404 });

  if (business.subscription_status === "active") {
    return NextResponse.json({ error: "You already have an active subscription." }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const service = createServiceClient();

  try {
    let customerId = business.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: business.business_name,
        metadata: { business_id: business.id },
      });
      customerId = customer.id;
      // Stored immediately, before the checkout session even resolves —
      // a retry after this point reuses the same Stripe customer rather
      // than creating a new one every time someone clicks "Subscribe".
      await service.from("businesses").update({ stripe_customer_id: customerId }).eq("id", business.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: business.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/settings?billing=success`,
      cancel_url: `${appUrl}/dashboard/settings?billing=cancelled`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing checkout] failed:", err);
    await recordErrorEvent({
      severity: "error",
      source: "billing.checkout_failed",
      businessId: business.id,
      message: "Failed to create a Stripe Checkout session.",
      error: err,
    });
    return NextResponse.json({ error: "Something went wrong starting checkout — please try again." }, { status: 500 });
  }
}
