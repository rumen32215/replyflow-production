# RC3 — First Impression Polish: Completion Report

Scope, per instruction: Verification → Welcome → Business name → Trade → Service area & hours → Transition → arrival at Meet Your Receptionist. No flow, architecture, or feature changes. Meet Your Receptionist's own content and everything beyond it were not touched.

---

## What changed, screen by screen

### 1. Shared premium button (new)

`components/onboarding/onboarding-cta.tsx` — one component now used by every onboarding CTA (Welcome, Business name, Trade, the merged Service area & hours screen). Keeps the lift-on-hover / press-on-tap feedback every screen already had, and adds a slow, infrequent light sweep (1.5s pass, ~3.2s rest between passes) clipped inside the button's rounded corners. The sweep is deliberately quiet — meant to read as quality on a second glance, never as something competing with the question on screen. This replaces five separate copies of near-identical inline button markup with one decision, so "the button feels alive" is one consistent product choice instead of a per-screen effect.

### 2. Welcome

- Removed the waving emoji from the greeting; the time-aware "Good morning / afternoon / evening" logic is unchanged — it still makes the product feel like it noticed something real.
- Tightened "Let's get everything ready for your first customer" to "Let's get you ready for your first customer" — same meaning, shorter, more direct address.
- CTA now uses the shared `OnboardingCTA`.

### 3. Business name

- "What should I call your business?" (ReplyFlow speaking about itself) → "What is your business called?" — same question, owner-focused instead of self-referential.
- Placeholder, typing behaviour, and input styling untouched, as instructed.
- CTA now uses the shared `OnboardingCTA`.

### 4. Trade

- "What kind of work do you do?" → "What's your trade?" — shorter, more direct, less conversational filler.
- The 5-trade set is unchanged. Added a 6th card, disabled, dashed border, muted "More soon" label and icon, `aria-disabled`, no hover/tap motion — the grid now reads as a deliberately curated set of six slots (one reserved) rather than five cards that happen to leave a gap in the grid.
- CTA now uses the shared `OnboardingCTA`.

### 5. Service area + Opening hours → merged into one screen

Two screens and one navigation became one. `components/onboarding/service-area-step.tsx` now renders all three groups — service area, days open, hours — under one heading ("Where and when can customers reach you?") with small section labels, and one Continue button that validates all three together. `/onboarding/hours` (route and component) is deleted; `/onboarding/service-area` now owns this step and its Continue goes straight to `/onboarding/preparing`. This is a real reduction in clicks in the last stretch of the one-minute setup, not just a copy change.

### 6. The transition into ReplyFlow ("Preparing")

`components/onboarding/preparing-receptionist.tsx` was rebuilt from the ground up. Removed entirely:
- The full-bleed dark scene (`bg-[#080d17]`) and its two ambient glow animations.
- The scripted four-line rotating sequence ("Meeting your business," "Learning your hours," "Getting ready to say hello," "Almost ready") and its fixed 1.6s-per-line pacing — this was manufacturing the feeling of work happening on a fixed schedule, independent of whether the real request had actually finished.

Replaced with the same bright card chrome every other onboarding screen already uses (`rounded-3xl border border-border bg-card shadow-elevated`), showing the same logo mark used on Welcome and a single honest line, "Setting up your receptionist," for exactly as long as the real `POST /api/onboarding/prepare` call is in flight — no scripted minimum. The only fixed duration left in the file is a 550ms hold on the success checkmark once the real request resolves, so it's perceivable before navigating — not a wait manufactured to look like work, just enough time for a human eye to register a checkmark that would otherwise flash and vanish. If the real request happens to resolve in 200ms, the whole screen (aside from that 550ms confirm beat) is done in 200ms. The previous version held for roughly 7.5 seconds regardless of real latency; this version holds for as long as the API genuinely takes, plus that one small confirm beat.

The error/retry state was rebuilt to match (light card, same copy, same shared CTA for "Try again") rather than the old dark-themed retry button.

### 7. Motion language unification

- `app/(onboarding)/onboarding/layout.tsx`'s page-to-page transition was using a different easing curve (`[0.4, 0, 0.2, 1]`) than every step component's own internal entrance animation (`[0.22, 1, 0.36, 1]`). The layout now uses the same curve, named the same way, so the motion feels like one continuous system rather than a page-level effect layered on top of a different per-screen one.
- Every CTA now shares one button component, so hover/press/sweep timing is identical everywhere instead of five near-identical hand-tuned copies.

### 8. A gap found during visual verification, fixed in a follow-up commit

Screenshotting the deployed flow surfaced a real inconsistency that wasn't part of the original seven directives but falls squarely under "every screen in onboarding": `app/(onboarding)/onboarding/loading.tsx`, Next.js's route-level fallback shown for a brief moment during every step-to-step navigation, was still the shared generic `PageSpinner` — a spinner ring plus "Setting things up..." text. That's exactly the generic, could-be-any-product loading chrome the rest of this pass removed, and it now stood out as the one visibly inconsistent moment against the rebuilt Preparing screen. Replaced with a quiet pulse of the same brand mark inside the same card chrome every step uses, so a brief flash reads as "the brand breathing," not a loading widget. Scoped narrowly to onboarding's own `loading.tsx` — the shared `PageSpinner` component and its use in `(auth)` and `(dashboard)` were not touched, since those are outside RC3's scope.

---

## What did not change

No architecture, no data model, no new screens beyond the merge (net screen count went down by one), no copy or behaviour change to Meet Your Receptionist or anything beyond it. The 5-trade restriction, the onboarding store, the `/api/onboarding/prepare` endpoint, and every readiness gate are untouched — this was a presentation-layer pass over an already-approved flow.

---

## Regression testing performed

1. **Full local verification** after every change: `tsc --noEmit`, `next lint`, `npm test` (64/64 passing throughout), `next build` — all clean, both for the main polish commit and the follow-up loading-state fix.
2. **Full fresh-account journey against production**, twice (once before the loading-state fix, once after), at both desktop (1280×900) and mobile (390×844) viewports, using a freshly created real Supabase user each time (magic-link session injection, same technique used throughout this engagement): Welcome → Business name → Trade → the merged Service area & hours screen → Preparing → landed correctly on `/dashboard/receptionist/meet`. Confirmed at each step: correct copy, all 6 trade cards present (5 real + 1 disabled), all three merged-screen field groups present and functional, no console or page errors, correct final redirect. Test accounts and their business rows were deleted after each run.
3. **A visual false alarm, investigated and ruled out**: an early screenshot of the merged screen on mobile appeared to show the Saturday/Sunday day-chips clipped at the viewport edge. A direct `getBoundingClientRect`/`scrollWidth` check against the live page showed `scrollWidth === clientWidth === 390` and both chips fully within bounds — the appearance was a low-contrast unselected chip rendering small in a screenshot, not a real overflow. Confirmed via a fresh, correctly-timed screenshot showing both chips clearly. No fix needed.
4. **A real timing-only script artifact**: two of my own first-pass screenshots (the trade screen's disabled card, the Preparing screen) were captured mid-animation by my own script's fixed wait times, not because anything was broken — re-captured with appropriate waits and confirmed both render correctly. This surfaced the real `loading.tsx` gap described above as a side effect of taking a closer look, not because the functional test failed.

---

## Would a busy plumber understand this in under a minute?

Every screen still answers exactly one question (or, for the merged screen, three related ones asked together to save a click), in under a minute, with no new concepts introduced. Nothing here changed what's being asked — only how it looks and feels while being asked.

---

## Status

**Complete, deployed, and verified.** Both commits (`dfcc3ee` — the main polish pass, `156106e` — the loading-state follow-up) are live on `main`/`front-desk-v3`. Stopping here per instruction, without continuing into Receptionist. Ready for review.
