# RC6 — Onboarding Final Craftsmanship Pass: Completion Report

Emotional/motion polish pass, per instruction — no redesign, no new flows, no new architecture. One section (the demo conversation) required extending an *existing* reply-engine capability to a new caller; every other section is presentation and timing.

---

## 1. Welcome logo

The mark now keeps breathing after its entrance settles: a slow vertical float (±4px, 3.6s), an ambient glow that never fully rests (breathing between 15%–45% opacity, 4s), and an occasional tiny scale pulse (3.5%, once every ~4s) — all layered so they compose rather than compete. The one-shot entrance flash from RC3–5 is untouched; these loops begin only after it settles.

## 2. Trade selection

Reviewed per instruction — no redesign. The one change that reaches this screen is §6 below (`GrowingCheck`'s calmer spring), which is exactly the kind of "smoother transition, no layout change" refinement this section asked for.

## 3. "A little about how you work"

- **Days open**: rebuilt from an all-green selected state into a genuine colour hierarchy — green border + green tick for confirmation, blue label text for content, white/neutral surface throughout (no more `bg-success/10` tint). Selecting a day now reads as *confirmed*, not just *highlighted*.
- **Opening hours**: the Opens/Closes inputs swapped their large blue focus glow for a small, soft green-tinted ring (`shadow-[0_0_0_3px_rgba(34,197,94,0.10)]`) — restraint over a loud outline.
- **Service area**: pushed well past "faint contour lines." The slot now has a slow-breathing ambient glow (a blurred green radial, 7s cycle) plus two layered contour rings at different spacing for depth — still entirely CSS, still not a literal map, but reads as genuine "location intelligence" ambience rather than a barely-visible texture.

## 4. "What I've already learned"

Rebuilt the reveal from "everything appears in the same instant" into a deliberate per-fact rhythm: a small pause, the check animates in, the label and value fade in shortly after it (not simultaneously) — a new `LearnedFact` component staggers this explicitly rather than relying on one flat fade. Groups now dwell 2.1s (was 1.15s) before crossfading, giving each pair of facts room to actually be read rather than glimpsed.

## 5. Demo conversation — the substantial change

This was the one section where "polish what exists" required *using more of what already exists*, not writing anything new from scratch.

**The finding**: `lib/reply-engine/live-reply.ts` was calling the real classify → draft → safety pipeline with `EMPTY_CONVERSATION_STATE` and no history, on every single call — by design, since it exists for one-off scenario previews (Teach's live coaching, Test Conversations). But the underlying pipeline already has a complete, production-grade conversation-memory system (`lib/reply-engine/understanding/state.ts` — stage, slots, open question, commitments, goal) that a *real* conversation carries forward turn by turn via `conversations.ai_state`. That memory system was simply never wired into this one caller.

**The fix**: `generateLiveReply` and `/api/receptionist/live-reply` gained optional `priorState`/`recentHistory` parameters, both defaulting to today's exact behaviour when omitted — every existing caller (Receptionist's live coaching, Test Conversations) is provably unaffected, since nothing about their call sites changed. Onboarding's demo conversation is now the one caller that opts in, threading the real `conversationState` returned from each call into the next one, sequentially.

**The demo itself was rewritten** from four independent trivia questions ("are you free tomorrow?", "do you cover X?", "are you a Y?") into one continuous, natural thread: a trade-appropriate opening problem ("Hi, I've got a leak under the kitchen sink" / "I've noticed a few tiles missing after the storm" / etc., keyed off the real selected trade), then three follow-ups that never restate what's already been said ("Would tomorrow work?", "Do you cover {the real area}?", "Great — what do I need to do now?"). Verified directly against production: the real engine correctly tracks an outstanding "need your postcode" question across three unrelated follow-up turns and a topic detour, and the final "what's the next step?" question gets a specific, contextually-grounded answer ("I'll just need your postcode to proceed with the booking for tomorrow") rather than a generic clarifier — genuine evidence of memory, not a scripted imitation of it.

Because later replies now genuinely depend on earlier ones, the four calls are necessarily sequential rather than fired in parallel (a real change from RC4/RC5's approach) — memory can't be parallelised without breaking it.

## 6. Demo timing

Reviewed holistically alongside §4–5: `BETWEEN_EXCHANGE_PAUSE_MS` raised 650ms → 750ms (a touch more breathing room between exchanges), fact-group dwell raised to 2.1s, `GrowingCheck`'s spring calmed (below). Nothing was shortened — everything genuinely slow already (the type-out estimate) was left as is, since it was already tied to real content length, not arbitrary.

## 7. "Setting up your receptionist"

Added a very slow diagonal light sweep (5.5s pass, long rest between) and four tiny drifting particles behind the breathing logo — ambient environment, not a loader. No change to real duration; this stage still lasts exactly as long as the real `/api/onboarding/prepare` call takes.

## 8. Motion language audit

`GrowingCheck` — used on Trade selection, the learning checklist, and "Receptionist ready" — was calmed from a livelier spring (stiffness 320/damping 20, noticeably underdamped) to a near-critically-damped one (260/30), so every use of it reads as quiet confidence rather than a small bounce. It also gained an optional `delay` prop (default 0, so every other caller is unaffected) so the new staggered checklist rhythm could use it directly instead of wrapping it in a second, redundant motion layer.

## 9. Final design goal

The emotional arc this section describes — curiosity → confidence → intelligence → trust → excitement — is what §5 in particular was built to serve: the demo conversation is the one moment in onboarding that can actually earn the "I'd trust this with my customers" reaction, and it now does more of that work honestly (via real memory) rather than through stronger copywriting alone.

---

## What did not change

No new onboarding screens, no new data model, no map. `generateLiveReply`'s existing callers are unaffected — confirmed both by code inspection (new parameters are optional with identical defaults) and by running the full adversarial regression suite against the live production webhook after deploying (see below). The onboarding store, the 5-trade restriction, and every safety/escalation rule are untouched.

---

## Regression testing performed

1. **Full local verification**: `tsc --noEmit`, `next lint`, `npm test` (64/64), `next build` — all clean.
2. **The full reply-engine adversarial regression suite**, run against the live production webhook after deploying (required specifically because this pass touched `lib/reply-engine/live-reply.ts`, per the suite's own README instruction to run it before/after real reply-engine changes): **18/18 scenarios, 0 failed checks** — sarcasm handling, repeated-question dampening, booking flows, silence-on-acknowledgement, the gas-emergency regression, the payment-fact regression, the reschedule-overclaim regression, and every other existing scenario behaved identically to before this change.
3. **Full fresh-account journey against production**, twice (desktop, trade: Roofer; mobile, trade: Electrician), each with a freshly created real Supabase user: confirmed the Welcome gradient phrase and idle logo animation, the day-chip colour hierarchy, the service-area ambient texture, the full four-exchange demo conversation, and a clean landing on Meet Your Receptionist. Zero console errors on either run.
4. **The memory claim specifically verified, not assumed**: read the full conversation thread from both runs in order and confirmed the receptionist correctly tracked an outstanding follow-up question across multiple unrelated turns and a topic change, and gave a contextually-specific (not generic) answer to the closing "what's the next step?" question — the exact behaviour §5 exists to produce, not just present.

## Accessibility

No new interactive elements. The `GrowingCheck`/`TypingDots` prop extensions are additive and decorative-only, matching the existing `aria-hidden` treatment already applied at each call site. No change to the pre-existing gap around `prefers-reduced-motion` noted in prior reports — still not addressed in this pass, still not a regression it introduced.

## A scope note worth stating plainly

Section 5 asked for the single biggest change in this pass, and the honest way to deliver it required touching a real, safety-relevant file (`live-reply.ts`) rather than staying purely in presentation components. This was a deliberate call: the alternative — hand-scripting replies that *sound* like they remember things — would have reintroduced exactly the kind of fake conversation engine this whole engagement has repeatedly ruled out. Extending an existing, already-designed, already-tested memory system to a caller that simply never used it stayed inside "polish what exists," and the regression suite result is the evidence that the decision didn't cost anything elsewhere.

---

## Status

**Complete, deployed, and verified.** Commit `2914aa6` is live on `main`/`front-desk-v3`. Onboarding is now frozen per instruction — stopping here, ready for the shift to the Receptionist experience.
