# ReplyFlow Go/No-Go Review

**Master Execution Plan 4.1.** Its own success criteria: *"A named person confirms each Phase 0/1 item's success criteria has actually been met."* That confirmation has to be a real person's, not an AI's — this document is the honest, re-verified input that confirmation needs, not a substitute for it. Where something was safely re-checkable against live production today, it was — read-only checks only; nothing that could create a real side effect (a real Stripe object, a real customer email) was probed. Where it wasn't safely or programmatically checkable, that's stated plainly rather than assumed unchanged.

**Re-verified against live production on 2026-07-30**, not just copied from each task's own completion notes:
- `product_events` table: still does not exist (404) — the 3.2 migration remains unapplied.
- `ai_usage_events`/`error_events`: both live and queryable.
- All 21 real `businesses` rows: `subscription_status = 'active'`, `stripe_customer_id = null`, `trial_ends_at = null` — confirms no real Stripe customer has ever been created (consistent with `STRIPE_SECRET_KEY` still being unset) and no business has yet gone through the real post-3.1 trial flow.
- `SUPPORT_EMAIL`: still unset (Settings' "Get help" section does not render).
- `ADMIN_EMAILS`: still unset (a real authenticated session is still redirected away from `/admin`).
- One real, current `critical` `error_events` row exists: `billing.webhook_signature_invalid` at 2026-07-30T01:25 — this is a known test artifact from this session's own Task 3.1 verification (a deliberately-malformed signature sent to confirm the webhook rejects correctly), not a real incident. Recorded here so it isn't mistaken for one later.
- Four `reply-engine.send_failed` (`error` severity, not `critical`) rows from 2026-07-29 — the same recurring, already-documented QA/SHABZ stale-WhatsApp-token housekeeping item `ReplyFlow-Incident-Response.md`'s own walkthrough already named as a real, low-priority, non-blocking finding. Not new, not a blocker.

---

## Phase 0

| Task | Success criteria | Status |
|---|---|---|
| 0.1 AI cost tracking | Every real OpenAI call's usage/cost queryable per business | **Met.** `ai_usage_events` live and populated, re-confirmed today. |
| 0.2 Onboarding cost bug + rate limiting | Repeat Preparing visits don't refire the demo; every AI route rate-limited | **Met.** Shipped and verified at the time; no reason to believe it's regressed (no reply-engine/onboarding changes since touched this path). |
| 0.3 SLI/SLOs | Written targets exist, referenced by monitoring | **Met.** `ReplyFlow-SLIs-SLOs.md` exists with real baselines; the one flagged gap (WhatsApp-disconnect detection time not measurable) was honest then and remains honest now — no new monitoring capability has since closed it. |
| 0.4 Engineering hygiene | Comment corrected; tier-consolidation recommendation made | **Met.** Both closed; no code changed as a result of the tier investigation, correctly. |

**Phase 0: fully met, no open items.**

---

## Phase 1

| Task | Success criteria | Status |
|---|---|---|
| 1.1 Monitoring/error reporting | A simulated webhook failure and OpenAI error both produce a real alert within minutes | **Partially met.** Capture is real and confirmed still working (re-verified today: `error_events` live, correctly categorising both the test webhook-signature failure and the real send failures). Active alerting itself is **still inert** — `INCIDENT_ALERT_WEBHOOK_URL` was unset as of 1.3; not independently re-checkable today without triggering a real critical event, and nothing since then indicates it's been set. **Needs direct founder confirmation.** |
| 1.2 Backup/recovery | A real restore has been performed at least once | **Not met, honestly, since it was written.** No managed backup capability exists on the Supabase Free plan. A manual snapshot stopgap exists and works; no restore has been performed (correctly — no safe target existed to test one against). **Needs founder confirmation: has the Supabase plan been upgraded since?** Not independently checkable by this session. |
| 1.3 Incident response | Runbook exists, walked through at least once | **Met.** Real runbook, walked through against a real incident (the same QA stale-token pattern re-observed today, confirming the interim process — manually running `error-summary.mjs` — still works). Alerting activation shares 1.1's same open item. |
| 1.4 Security baseline | 2FA confirmed on every shared account; access documented | **Met, as last confirmed.** 2FA was founder-verified directly on all four accounts (Supabase, Vercel, Meta, OpenAI) on 2026-07-29. Not re-checkable by this session (no API access to account 2FA settings) — **stated as last known, not independently re-verified today.** |
| 1.5 Customer support workflow | A real, monitored inbox exists | **Not met, honestly, since it was written.** Runbook and the `SUPPORT_EMAIL`-gated Settings surface are both built and working; `SUPPORT_EMAIL` re-confirmed unset today. **Needs a real address from the founder.** |
| 1.6 Privacy policy/ToS | A reviewed, published privacy policy and ToS exist | **Not met.** The factual input a reviewer needs (`ReplyFlow-Data-Practices-Audit.md`) exists; the actual legal review has not happened. **Needs a qualified reviewer — a founder/external action, not engineering.** |

**Phase 1: two items (1.3, 1.4) fully met; two (1.1) partially met pending one env var; two (1.2, 1.6) genuinely open, both requiring a founder or external action, not more engineering.**

---

## 3.1 Billing (explicit dependency of this gate)

Schema, gating, Checkout/Portal/webhook integration all built and verified working correctly with Stripe unconfigured (every route degrades to a plain "not set up yet" rather than crashing). **Re-confirmed today: zero real Stripe customers exist across all 21 businesses** — consistent with `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_ID` still being unset. **A real card cannot be charged today.** This is the literal, direct blocker on opening billing to real customers — not a documentation gap, the actual missing configuration.

---

## Overall verdict

**NO-GO today**, stated plainly rather than softened. This is not a reflection of engineering readiness — every item above that was engineering's to build is built, tested, deployed, and verified against real production. It reflects real, outstanding **founder-or-external actions**, none of which this session can complete on the founder's behalf:

1. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` — without these, no real card can ever be charged (3.1's own literal success criteria).
2. Confirm whether the Supabase plan has been upgraded for real backup/recovery (1.2) — if not, this is a real, accepted risk that should be a conscious decision before real customer data is at stake, not an oversight.
3. Set `INCIDENT_ALERT_WEBHOOK_URL` — active alerting is fully built and inert without it (1.1/1.3).
4. Set `SUPPORT_EMAIL` to a real, monitored address (1.5) — no real customer should be able to reach a support channel that doesn't exist yet.
5. Complete a qualified legal review of `ReplyFlow-Data-Practices-Audit.md` and publish a real privacy policy/ToS (1.6).
6. (Not a Phase 0/1 blocker, but genuinely needed before `/admin` is usable at all) Set `ADMIN_EMAILS`.
7. **Added 2026-08-03, Owner Attention Architecture V1** (`DOCS/CONSTITUTION/14-ReplyFlow-Owner-Attention-Architecture.md`): set `RESEND_API_KEY`, `ATTENTION_FROM_EMAIL`, `CRON_SECRET` — without them, `app/api/cron/attention` is fully built and inert, the same pattern as item 3. Separately: **upgrade to Vercel Pro (or equivalent infrastructure capable of a minute-level cron)** before the pilot begins if same-day urgency for an escalation-flagged reply genuinely matters — today's Hobby plan caps the cron to once daily, an operational deployment limitation, not a defect in doc 14's design (see its own status line).

Everything on this list is a real decision or a real external action — a Stripe account, a Supabase plan, a webhook URL, an email address, a lawyer, a hosting tier. None of it is more engineering work waiting to be scheduled.

---

## Confirmation

*(Per this task's own success criteria — to be completed by a named person, not by this session.)*

> I, **______________________**, confirm on **______________________** that I have reviewed the items above and either (a) each is genuinely met, or (b) I am knowingly accepting the risk of proceeding with a specific item still open, and why: ______________________
