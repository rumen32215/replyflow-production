# RC2-M1 Completion Report

**Item:** M1 — WhatsApp reachable before any proof has been shown.
**Principle restored:** Principle 6, "Proof before permission" — matching Constitution 04's own line: *"Going live [Connect WhatsApp] — a formality by now, not a leap of faith — she's already been seen at work."*

## What was wrong

`onboarding_completed` (the only gate on the whole `/dashboard/*` tree) flipped true after just two screens — business name and trade. Nothing else checked whether Business, Receptionist, or Meet Your Receptionist had happened before allowing a real WhatsApp connection. Confirmed live during the Owner Journey Review: with 0 of 4 Hiring Experience steps done, `/dashboard/whatsapp` was fully reachable and rendered the real connect flow.

## What changed

One file: `app/(dashboard)/dashboard/whatsapp/page.tsx`. The *unconnected* path now redirects to Front Desk (`/dashboard`) unless `businesses.handover_confirmed_at` is set. That field is only ever written once Meet Your Receptionist's own readiness gate (RC1's own fix) has already required Business Knowledge and every Receptionist topic to be taught, and the owner has explicitly confirmed a real recap was accurate — a genuine, already-trustworthy proof signal, not a new one invented for this fix.

An already-connected business is never affected — the guard only applies when `!connection`, so revisiting this page to check connection status always works regardless of how or when the business originally connected.

No new gating logic was written for "what's the correct next step" — Front Desk's existing `SetupJourney` already computes that correctly, so redirecting there was sufficient rather than duplicating its logic in a second place.

## Why this is the smallest solution

- One condition, one file, no new data, no new tables, no new UI.
- Reuses a signal (`handover_confirmed_at`) that already exists, is already correct, and is already the exact bar the Constitution names for this moment.
- No change to Front Desk, Meet Your Receptionist, Test Conversations, or any other screen.

## Verification

- `tsc --noEmit`, `next lint`, unit tests (64/64), `next build` — all clean.
- Deployed, then verified live against three real cases:
  1. **Fresh, untaught business** → navigating directly to `/dashboard/whatsapp` redirects to `/dashboard`. *(confirmed)*
  2. **Handover confirmed, never connected** → reaches the real connect flow normally. *(confirmed)*
  3. **SHABZ, already connected** → stays on the page, shows the connected state, completely unaffected. *(confirmed)*

## Regression scope

Only the WhatsApp connect route was touched. No changes to the reply engine, Conversation State, prompts, or safety layer — the adversarial regression suite was not run, as nothing in its scope was touched.

## Status

**M1 complete.** No other RC2 items were started. Stopping here per instruction, for review from an owner's perspective before deciding on M8a or M11 next.
