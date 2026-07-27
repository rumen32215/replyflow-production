# RC5 — Final Onboarding Experience Polish: Completion Report

Refinement pass only, per instruction — no redesign, no new flows, no new architecture. Two of the fourteen sections turned out to be real, reproducible bugs (not just presentation); both are fixed and verified against production with direct evidence, not assumption.

---

## 1. The double-login bug — investigated, reproduced, and fixed

`/auth/callback/route.ts` already existed and already does the right thing *when* Supabase's confirmation link redirects with a `?code=` param — but real production testing (a genuine signup + a real Supabase-issued confirmation link, followed exactly as a browser would) showed the link instead redirecting with the session in a **URL hash fragment** (`/login?error=auth_callback#access_token=...&refresh_token=...`). A hash fragment is never sent to the server — `/auth/callback`'s code exchange never fires for this shape of link, so the owner landed on a bare login form despite having just proven ownership of their email, exactly matching the reported friction.

Fixed in `components/auth/login-form.tsx`: on mount, if the URL hash contains `access_token`, the form completes that session client-side via `supabase.auth.setSession()`, clears the hash from the address bar, and redirects straight to `/welcome` — the login form itself is never shown for this case (a lazily-initialised state check means a normal login visit never even flashes it for one frame). Verified with a before/after test using a real Supabase-issued signup-confirmation link against production:

- **Before**: landed on `/login` with an unused password field, `access_token` sitting inert in the hash.
- **After**: same link, same flow — lands authenticated on `/welcome`, no password field ever shown, verified via the actual auth cookie being present.

## 2. Welcome

The gradient now highlights **"first customer"** as one phrase instead of just "customer" — the milestone being celebrated is the *first* customer, not customer in the abstract. Same `GradientText` component, same entrance timing, no new animation.

## 3 & 13C. The intermittent pre-fill bug — investigated and fixed at the root

Both the business-name and service-area reports turned out to share one root cause: the onboarding draft (`hooks/use-onboarding-store.ts`) persists to `localStorage` so a refresh mid-flow doesn't lose progress — but that same persistence meant an **abandoned earlier attempt on the same browser** (a previous incomplete signup, a different test account) silently pre-filled a brand new one, since the store was previously only ever cleared on successful completion. Fixed once, at the true entry point: `WelcomeGreeting` now resets the store on mount, so arriving at Welcome always means "start fresh" — verified directly (`.inputValue()` checked as empty on both Business name and Service area on a freshly-created account, both runs).

## 4. Nice to meet you

No changes, per instruction.

## 5. Trade selection

- **A)** "trade" in "What's your trade?" now carries the same gradient treatment as "business" and "first customer."
- **B)** Selecting a trade now turns the icon circle ReplyFlow green (`bg-success`) instead of blue, with a white icon — in visual harmony with the existing green `GrowingCheck` badge. The card's own border/shadow (which card is active) stays blue, per the colour-language distinction in section 14: selection-as-interaction stays blue, selection-as-confirmation is now green.
- **C)** The disabled "More soon" card's `TypingDots` now animate in green instead of neutral grey — `TypingDots` gained an optional `dotClassName` override for this (default unchanged, so the real "she's thinking" indicator used in the demo conversation and elsewhere in the product still renders its normal neutral grey).

## 6. "Setting up your receptionist"

The logo mark now breathes — a synchronized glow pulse, a few pixels of vertical float, and a hair of scale, all on the same 2.2s cycle — instead of sitting static with only a glow. No change to how long this stage actually lasts; it's still bound entirely to the real `/api/onboarding/prepare` request.

## 7. "What I've already learned"

Now reveals two facts at a time (three groups: 2/2/1), crossfading between groups using the existing `GentleSwap` primitive, settling on the final group rather than looping. This is a pure presentational stagger over facts that are already fully known client-side — it doesn't wait on anything, and runs alongside (not before) the demo conversation below it.

## 8. Demo conversation — rebuilt

This was the real work of the pass. Previously, only the *last* of three replies animated in; the first two were committed instantly, and a new customer message could appear in the same tick as the previous reply — which read exactly as reported: mechanical, bursty, not believable.

Rebuilt so **every** reply now types itself in turn, with a natural pause (`BETWEEN_EXCHANGE_PAUSE_MS`, 650ms) between exchanges. To do this without the "deletion glitch" that a shared single typing-slot produces when its target text changes mid-conversation, each exchange's reply now mounts a fresh, uniquely-keyed `TypedReply` component (`useTypedMessage` starting clean from `""` every time) rather than reusing one continuously-updated slot. `components/shared/phone-preview.tsx` gained an additive `PhoneFrame` export — the same header/background chrome, extracted so this screen's multi-exchange thread can render inside the *exact* same frame without a lookalike reimplementation; `PhonePreview`'s own behaviour for its three existing callers (Receptionist's live coaching, Test Conversations, and the doc reference in Business Knowledge) is unchanged.

Added a **fourth exchange** — "That sounds great — what's the next step?" — so the conversation now demonstrates availability, service area, trade, *and* moving the conversation forward, per the brief's explicit four-beat structure. All four messages are still answered by the exact same real `/api/receptionist/live-reply` → `lib/reply-engine/live-reply.ts` pipeline as RC4 — never a second, scripted engine. Verified with two different trades (Builder, Roofer) against production: the trade-specific reply genuinely differs ("Yes, RC5 desktop Co. is a building business..." vs "Yes, we are a roofing business..."), and the "next step" question got an honest clarifying reply asking what service is needed — a real demonstration of the engine's fact-grounding discipline (it doesn't invent services that were never taught) rather than a canned "sure, let's book you in."

Total visible duration for the four-exchange reveal is roughly 8–10 seconds (four replies' worth of real type-out animation plus three breathing pauses) — longer than RC4's version, and a deliberate trade-off: every part of it is either genuine network latency (all four calls fire in parallel at the start, so the wall-clock cost is close to one call's latency, not the sum of four) or a bounded reveal of content that has already arrived, never an invented wait.

## 9 & 10. Final state and motion review

Held every earlier screen to the same bar the ending already met (this is what most of sections 1–8 and 13 are). Watched the full flow end-to-end on both viewports as a last pass before shipping — see Verification below.

## 11. Constraints

Respected throughout: no new onboarding steps, no new data model, no map, no loading time added anywhere (the one screen explicitly told to stay fast — "Setting up your receptionist" — has identical real duration to RC4; only the demo conversation's total time changed, and that's Section 8's explicit trade-off, not Section 6's).

## 13. About How You Work

- **A) Days open**: selected state now reads as confirmation rather than "highlighted" — `border-success bg-success/10 text-success`, replacing the blue border/background/text combination. The existing `transition-colors` class means the change from unselected to selected genuinely animates through the colour shift rather than snapping.
- **B) Opening hours**: the Opens/Closes time inputs now get the same soft branded focus glow (`shadow-[0_0_0_4px_rgba(37,99,235,0.08),...]`) every other input on this screen already uses, replacing a bare `focus:border-primary` with no glow — one consistent premium focus language across the whole screen instead of two different ones.
- **C) Service area**: root-cause bug fixed (see §3 above — same fix, same root cause). The slot now carries a faint concentric-contour background texture (a low-opacity `repeating-radial-gradient`, the same inline-style technique `PhoneFrame`'s own background already uses) — signalling "this is where she learns where you work" without building a map, exactly as instructed not to.

## 14. Colour-language review

Held every changed screen against the rule explicitly: blue stayed reserved for interaction and primary actions (every `OnboardingCTA`, every text-input focus glow, the "active" trade card's own border); green was used only where something is confirmed or succeeded (the selected trade's icon circle, the day-chip confirmed state, every `GrowingCheck`, the green `TypingDots` on "More soon" specifically because it's signalling anticipation, not the neutral "she's thinking" indicator, which correctly stayed grey by default). Nothing was made green just because it was easy to.

---

## What did not change

No architecture, no new onboarding steps, no new data model. `PhonePreview`'s public behaviour is unchanged for its existing three callers — the only change there is additive (`PhoneFrame` extracted, `TypingDots` gained an optional unused-by-default prop). The reply engine, the onboarding store's field shape, and every safety/escalation rule are untouched.

---

## Regression testing performed

1. **Full local verification**: `tsc --noEmit`, `next lint`, `npm test` (64/64), `next build` — all clean.
2. **The double-login fix, verified with a real signup-confirmation link** (not the magic-link shortcut used for the rest of onboarding testing) against production, before and after deploying the fix — see §1.
3. **Full fresh-account journey against production**, twice, at desktop (1280×1000, trade: Builder) and mobile (390×844, trade: Roofer), each with a freshly created real Supabase user: confirmed the Welcome gradient phrase, empty business-name and service-area fields on first load, the gradient "trade" word, the green trade-selection state, the green day-chip confirmation state, the map-textured service-area slot, all four demo exchanges rendering with genuinely different real replies (confirmed trade-specific phrasing differs between Builder and Roofer runs), and a clean landing on Meet Your Receptionist. Zero console errors on either run.
4. **Visual confirmation over the automated bubble-text scrape**: the verification script's keyword filter for capturing demo-conversation bubbles missed two of the eight real bubbles (a regex artifact — some real replies didn't happen to contain the specific keywords it searched for), so screenshots were reviewed directly to confirm all four exchanges rendered correctly rather than trusting the narrower automated check.

## Accessibility

No new interactive elements were added. The `TypingDots` colour override is decorative only (the "More soon" card retains `aria-disabled` from RC3/RC4). No change to the pre-existing gap around `prefers-reduced-motion` noted in the RC4 report — still not addressed in this pass, still not a regression introduced by it.

## Would a busy plumber understand this in under a minute?

Nothing asked changed. What's being asked is identical to RC4; two real bugs were fixed and every screen's confidence-building presentation was extended to match the strongest parts of the journey, per the brief's own framing in §9.

---

## Status

**Complete, deployed, and verified.** Commit `ec0e07c` is live on `main`/`front-desk-v3`. Stopping here per instruction, without continuing into Receptionist. Ready for review.
