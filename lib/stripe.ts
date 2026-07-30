import "server-only";
import Stripe from "stripe";

/**
 * Master Execution Plan 3.1 — the one chokepoint every billing route
 * goes through, matching the same "one instrumented chokepoint"
 * discipline already used for the LLM client (lib/reply-engine/llm/client.ts)
 * and error events (lib/error-events.ts).
 *
 * Returns null rather than throwing when STRIPE_SECRET_KEY is unset —
 * the same "inert until configured" pattern already established for
 * INCIDENT_ALERT_WEBHOOK_URL (1.3) and SUPPORT_EMAIL (1.5). Every
 * caller handles the null case explicitly and responds with a plain
 * "billing isn't set up yet" rather than a crash.
 */
let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!cachedClient) cachedClient = new Stripe(secretKey);
  return cachedClient;
}
