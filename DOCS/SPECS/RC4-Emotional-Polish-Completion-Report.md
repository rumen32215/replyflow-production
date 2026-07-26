# RC4 — Emotional Polish (Owner First Impression): Completion Report

Builds on RC3's structure. No flow, architecture, or new-step changes — every item below is presentation, copy, motion, or (for item 7) a new *caller* of the one existing reasoning pipeline, never a second one.

---

## 1. Welcome — the outcome word

"Let's get you ready for your first customer." now gradient-highlights **customer** using the exact same treatment already established for typed names (`bg-gradient-to-r from-primary to-success bg-clip-text text-transparent`), pulled out into a small shared `GradientText` component (`components/shared/gradient-text.tsx`) so Welcome, Business name, and the typed-name moment all draw from one definition instead of three copies of the same three classes. No new animation — the word simply renders with the gradient as part of the line's existing fade-in.

## 2. One motion language

Every onboarding file (`welcome-greeting`, `business-name-step`, `trade-step`, `service-area-step`, `preparing-receptionist`, the onboarding `layout`) now imports `EASE` from `components/shared/motion.tsx` instead of re-declaring `const EASE = [0.22, 1, 0.36, 1]` locally in five separate places. That file is the same one the rest of the dashboard (Receptionist, Business Knowledge, Front Desk) already draws from — so "one motion language" is now literally true, not five files that happen to agree. Trade-card and day-chip tap feedback now uses the same shared `press` spring (500 stiffness / 30 damping) the rest of the product already uses for tap acknowledgement, instead of ad hoc `whileTap={{ scale: 0.97 }}` values invented per screen. The premium CTA (`OnboardingCTA`) itself was intentionally left untouched, per instruction — it's the thing everything else is now unified *toward*, not something to change.

## 3. Business name

"What is your business called?" → "What's your business called?" — chosen over the alternative because it now matches the Trade screen's own "What's your trade?" (same contraction pattern, one voice across both screens), which reads as more natural and confident than the original's slightly stiffer phrasing. "**business**" gets the same `GradientText` treatment as Welcome's "customer." Placeholder, typing behaviour, and input styling are unchanged.

## 4. Trade — the disabled card, made intentional

Replaced the static `MoreHorizontal` icon on the "More soon" card with `TypingDots` — the exact same three-dot "she's thinking" motif already used elsewhere in the product (Receptionist's live preview, the WhatsApp proof conversation on this same build). The card now reads as "something's in progress" rather than "this tile wasn't finished," using a motif the owner will recognise rather than a new one invented for this single spot. Still fully disabled — `aria-disabled`, no click handler, no hover/tap motion.

## 5. Interaction polish

- Selecting a trade now shows a small `GrowingCheck` badge (the shared "success moment" component, already used elsewhere) in the card's corner, in addition to the existing colour change — a genuinely satisfying confirmation rather than just a border-colour swap.
- Day-open chips: the checkmark now animates in with a small spring (scale + fade) instead of appearing instantly.
- Focus and completion behaviour (input focus scale, the business-name greeting swap) were already good per RC3 and are unchanged, per "avoid unnecessary animations."

## 6. Service area + hours — presentation and order

- **Heading de-emphasised**: the old 24px extrabold hero heading is now a quiet 16px section label ("A little about how you work"), so the controls — not the headline — are what the eye lands on first.
- **Reordered**: Days open → Hours → Service area (was Service area → Days → Hours). The owner is teaching availability; days naturally precede hours, and reordering this way was a genuine improvement, not change for its own sake — confirmed by the fact the resulting reading order now matches how the Meet Your Receptionist recap itself describes it moments later ("Monday–Friday: 08:00–17:30" — see item 7).
- **Location, future-proofed**: Service area now lives in its own bordered "slot" (a small card with a `MapPin` icon + label, distinct from the plain label-and-input treatment of the other two sections). No map today — deliberately, per instruction, since that's real engineering complexity for no onboarding value yet — but this slot is where one could be introduced later without reshaping the screen around it.

## 7. The Preparing screen — the emotional payoff

This is the substantial piece. The old screen (RC3) said "Setting up your receptionist" and, once the real `/api/onboarding/prepare` call finished, redirected to Meet Your Receptionist almost immediately. Functionally correct, emotionally flat — exactly the gap RC4 called out.

**What it does now**, in two genuinely different phases:

1. **While the business row is being created** — unchanged from RC3: the same brief, honest "Setting up your receptionist" moment, lasting exactly as long as the real `POST /api/onboarding/prepare` call takes.

2. **Once that row exists** — a summary card reveals the five just-collected facts (business name, trade, service area, opening days, opening hours) as a staggered checklist, using the exact phrasing style already established in the real Meet Your Receptionist recap ("Monday–Friday", "08:00–17:30"). Underneath, a WhatsApp-style phone mock-up (`components/shared/phone-preview.tsx` — the same component Receptionist's own live coaching preview and Test Conversations already use) plays out three genuine customer questions, built from what the owner just entered:
   - "Hi, are you free tomorrow?" — answered from the real opening days/hours.
   - "Do you cover {the real service area}?" — answered using the owner's own words.
   - "Are you a {the real trade}?" — answered using the real business name and trade.

   **This is not a scripted demo.** Each question is sent to `/api/receptionist/live-reply` — the same route, calling the same `lib/reply-engine/live-reply.ts` function, that Receptionist's own live coaching preview already uses. That function runs the literal production pipeline (`classifyMessage` → `generateReplyDraft` → `evaluateSafety`), the same two real model calls a real webhook message would trigger, just without persistence or the Readiness Gate. Given this engagement's standing architectural principle — one receptionist, one brain, one conversation engine, adopted specifically to retire an earlier fake deterministic simulator — building a second, hand-scripted "proof" conversation for this screen would have quietly reintroduced exactly what that principle exists to prevent. Calling the real pipeline again, from a new place, was the only choice consistent with it. Verified directly: the two production test runs in this pass returned genuinely different reply phrasing for the same questions, confirming these are live model outputs, not cached or templated text.

   Once all three exchanges have arrived and the last one has finished its existing type-out effect, the screen shows "**✓ Receptionist ready.**" and a "**Meet your receptionist**" button (`OnboardingCTA`, the same shared component every other screen uses). Reaching Meet Your Receptionist is now an explicit tap, not a timer — the owner reads the proof at their own pace and chooses to move on. This was a deliberate choice: it avoids the "how long do we hold this screen" problem entirely (no duration is invented — the owner decides), and it's also more consistent with the rest of onboarding, where every other screen already advances via an explicit Continue tap.

**Never fakes a delay.** The only fixed timing anywhere in this file is a ~2.4s hold after the final reply arrives, so its existing type-out animation (borrowed unchanged from `PhonePreview`, already used elsewhere) has time to finish playing before the closing line appears — a choreography beat for content that has already arrived, not an invented wait for something to happen. If a demo reply call fails for any reason, the conversation stops gracefully at whatever point it reached and the screen still proceeds to "Receptionist ready" — the proof conversation is an enhancement, never a gate blocking a real business from finishing onboarding.

---

## What did not change

No new onboarding steps, no new data model, no architecture change. The five onboarding facts, the `/api/onboarding/prepare` endpoint, the 5-trade restriction, and every safety/escalation rule in the real reply engine are untouched. `PhonePreview`, `TypingDots`, `GrowingCheck`, `Reveal`, `press`, and `EASE` are all pre-existing shared components/constants already used elsewhere in the product — RC4 is entirely reuse, not new primitives (aside from the small `GradientText` wrapper, which is itself just a named extraction of markup that already existed).

---

## Regression testing performed

1. **Full local verification**: `tsc --noEmit`, `next lint`, `npm test` (64/64 passing), `next build` — all clean.
2. **Full fresh-account journey against production**, at both desktop (1280×1000) and mobile (390×844), using a freshly created real Supabase user each time (magic-link session injection): Welcome → Business name → Trade → the reordered/reworded merged screen → Preparing (summary reveal → real proof conversation → ready) → explicit tap into Meet Your Receptionist. Confirmed at each step: gradient spans render on the correct words, the reworded copy is live, the "More soon" card renders with its dots motif, the day-open/service-area ordering is correct in the DOM, the proof conversation genuinely contains the real service area and trade reflected back, and the flow lands correctly on Meet Your Receptionist. No console or page errors on either run.
3. **A first verification pass caught my own mistake, not a product bug**: the very first run was executed before the Vercel deploy had actually finished propagating, so it correctly showed the *previous* (RC3) copy and ordering — a script-timing artifact, confirmed by waiting properly and re-running, which then showed every RC4 change live.
4. **Real-content confirmation**: the two production runs (desktop, then mobile) produced *different* phrasing for the identical three demo questions — direct evidence the proof conversation is calling the real model each time, not returning cached or templated text.

## Accessibility notes

`GrowingCheck` badges used as decoration next to real text labels (the trade-selection badge, the summary checklist ticks, the "Receptionist ready" line) are wrapped in `aria-hidden` spans at each call site, since the component itself doesn't accept a passthrough prop — the adjacent visible text already carries the meaning. The disabled trade card retains `aria-disabled` from RC3. No new reduced-motion handling was added in this pass (none existed before RC4 either) — this is a pre-existing gap across onboarding's animation, not something RC4 introduced or worsened, and is noted here rather than silently expanded into a separate initiative.

## Would a busy plumber understand this in under a minute?

Every screen still answers exactly the same questions as RC3, in the same order (aside from the deliberate Days→Hours→Service-area reorder) — RC4 changed how it feels, not what's being asked. The one new moment (the proof conversation) adds real information — "she already understands what I just told her" — rather than a new question to answer.

---

## Status

**Complete, deployed, and verified.** Commit `c5a3e46` is live on `main`/`front-desk-v3`. Stopping here per instruction, without continuing into Receptionist. Ready for review.
