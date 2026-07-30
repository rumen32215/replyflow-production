# ReplyFlow Billing and Subscription Lifecycle

**Master Execution Plan 3.1.** Constitution: *"Could this business confidently operate without ReplyFlow?"* — Operations Blueprint §6: one flat plan, Stripe (keeps payment credentials off ReplyFlow's own systems), status values `trialing/active/past_due/canceled`, "gated gracefully and honestly... a lapsed payment communicates plainly before restricting anything."

Investigation before building found zero billing infrastructure of any kind — no `stripe` package, no schema, no gating, and no marketing/pricing page in this repo (confirmed to live outside it, per `app/page.tsx`'s own comment). Only the pricing *model* (flat, one plan) had ever been decided; no actual price point exists anywhere in the docs. **This codebase never needs to know that number** — it's set independently in the Stripe dashboard as a Price, referenced here only by its id (`STRIPE_PRICE_ID`).

One real, already-live fact shaped the design directly: `components/auth/signup-form.tsx` already promises *"Start your 7-day free trial. No credit card required"* — unbacked by any logic until now. That promise, not a new decision, is what a new business's trial window is built to honour.

---

## Schema (migration 0020)

`businesses` gained `subscription_status` (`trialing`/`active`/`past_due`/`canceled`, checked), `trial_ends_at`, `stripe_customer_id`, `stripe_subscription_id`. Every business that existed before this migration was **grandfathered to `active`** with no trial window — none of them were ever shown the trial promise or asked to pay, so none should retroactively start a countdown toward a gate. Verified directly against production after the migration ran: every existing row (SHABZ included) came back `active` with `trial_ends_at: null`.

New signups get a real `trial_ends_at` (now + 7 days), computed fresh at the moment of creation — never a column default, which would freeze at migration time rather than reflect when a specific business actually signed up. Two real business-creation paths needed this: `lib/business.ts`'s `ensureBusinessRow` (the documented "one place a businesses row is created"), and a second, genuinely separate insert found during investigation in `app/api/whatsapp/connect/route.ts` (used when WhatsApp connects before onboarding has created a row) — both now set it.

---

## Gating (`lib/billing.ts`, unit tested)

Matches the Blueprint's own instruction literally: **trialing and past_due never block** — they only ever produce a plain-language message. Only an expired trial or a fully cancelled subscription blocks.

| Status | Blocked? | What's shown |
|---|---|---|
| `trialing`, >2 days left | No | Nothing |
| `trialing`, ≤2 days left | No | Banner: "N days left in your trial…" |
| `trialing`, expired | **Yes** | Full-page: "Your 7-day trial has ended." |
| `active` | No | Nothing |
| `past_due` | No | Banner: "Your last payment didn't go through — update your card…" |
| `canceled` | **Yes** | Full-page: "Your subscription has been cancelled." |

Enforced in `app/(dashboard)/layout.tsx`, which now selects the two new columns it needs and renders `SubscriptionGate` in place of the page content when blocked — but **never for `/dashboard/settings`**, so billing can always be reached and fixed; the current path is made available to this Server Component via a small `x-pathname` request header set in `middleware.ts` (the standard, documented way to read the current pathname outside a Client Component). The non-blocking warning (`SubscriptionBanner`) renders above the page content everywhere except Settings, reusing `ConnectionAlert`'s exact visual language.

---

## Real money, handled entirely by Stripe's hosted surfaces

No card number is ever handled by ReplyFlow's own code — the same choice already named in the Blueprint:

- **`/api/billing/checkout`** — creates a Stripe Checkout Session (`mode: "subscription"`) for `STRIPE_PRICE_ID`. Reuses an existing `stripe_customer_id` if one exists; creates and stores one immediately otherwise, so a retry never creates a duplicate Stripe customer. Rejects with a plain 400 if the business is already `active` (Checkout is for starting a subscription, not duplicating one).
- **`/api/billing/portal`** — Stripe's own hosted Customer Portal, for updating a card or cancelling. No custom management UI is built — the same "reuse Stripe's own surface" choice already made for WhatsApp connection management (Meta's Embedded Signup).
- **`/api/webhooks/stripe`** — mirrors the WhatsApp webhook's exact discipline: verify the signature before parsing anything, always ack 200 once verified (Stripe retries aggressively on non-2xx), log processing failures to `error_events` rather than surfacing them as HTTP failures. Handles `checkout.session.completed` (first activation), `customer.subscription.updated`/`.deleted`, and `invoice.payment_failed`. No upsert-on-conflict dance is needed for idempotency the way the WhatsApp webhook needed it for message rows — every handler here is a plain status/id `UPDATE`, which a Stripe retry simply reapplies harmlessly.

**Settings** (`components/dashboard/settings-billing.tsx`) shows the real current status and one honest action: "Subscribe now" (trialing, cancelled) or "Manage billing" (active or past_due, and only once a real Stripe customer exists). A grandfathered `active` business with no Stripe customer at all sees neither — there's nothing for a button to honestly do, and showing one that always fails is worse than showing none. (Found and fixed before this reached production: an early version showed "Manage billing" for a cancelled subscription too, even though Stripe's Customer Portal manages a *live* subscription, not restarting a cancelled one — cancelled now correctly routes to Checkout, same as trialing.)

---

## What's deployable today versus what needs a real Stripe account

Every billing route is built to the same "inert until configured" pattern already established for `INCIDENT_ALERT_WEBHOOK_URL` (1.3) and `SUPPORT_EMAIL` (1.5): `lib/stripe.ts`'s `getStripeClient()` returns `null` rather than throwing when `STRIPE_SECRET_KEY` is unset, and every caller responds with a plain "billing isn't set up yet" instead of crashing. Verified directly against production: unauthenticated checkout/portal both correctly 401; the webhook correctly 401s with "Not configured" against a real request with no keys set, rather than attempting (and failing) signature verification.

**What this means concretely:** the schema, gating, and UI are live in production today, safely, for every real business. **Actually charging a real card** needs a real Stripe account and three real values — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and a `STRIPE_PRICE_ID` (a Price created in the Stripe dashboard, where the actual amount is decided) — none of which this session can create. Once set, the feature works end-to-end with no further engineering.
