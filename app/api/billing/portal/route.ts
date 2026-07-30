import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";
import { recordErrorEvent } from "@/lib/error-events";

export const runtime = "nodejs";

/**
 * Master Execution Plan 3.1 — Stripe's own hosted Customer Portal for
 * managing or cancelling a subscription and updating a card. No custom
 * billing-management UI is built here — the smallest production-ready
 * choice is to reuse Stripe's own surface, the same way WhatsApp
 * connection management is handled entirely through Meta's Embedded
 * Signup rather than a custom flow.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Billing isn't set up yet — try again shortly." }, { status: 503 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, stripe_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return NextResponse.json({ error: "No business found for this account." }, { status: 404 });
  if (!business.stripe_customer_id) {
    return NextResponse.json({ error: "You don't have a billing account yet — subscribe first." }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: business.stripe_customer_id,
      return_url: `${appUrl}/dashboard/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[billing portal] failed:", err);
    await recordErrorEvent({
      severity: "error",
      source: "billing.portal_failed",
      businessId: business.id,
      message: "Failed to create a Stripe Customer Portal session.",
      error: err,
    });
    return NextResponse.json({ error: "Something went wrong opening billing management — please try again." }, { status: 500 });
  }
}
