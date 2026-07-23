# Trust Track — Implementation Plan

**What engineering actually needs to exist to build what document 03 already designed.** Document 03 (`DOCS/CONSTITUTION/03-Trust-Experience.md`) fully specifies the experience — what she says, when, and why. This document is the equivalent of the Work Card object definition (`DOCS/SPECS/Work-Card-Object.md`) for Track A: not new design, just what has to be technically true before any of it can be built. Living spec, expected to change as building proceeds.

---

## A1. Handover ("Meet Your Receptionist") — implemented

**What it needs that doesn't exist yet:** a generation step that turns real taught data into the recap-then-confirm message from document 03 §2 — "here's what I've understood... have I understood you correctly?"

This is not a new kind of capability. It's the same fact-grounding discipline the reply engine already applies to a customer message (document 06 §1), pointed at a different question: not "what should I tell this customer," but "what do I now know about this business, stated back in plain language." Concretely:

- Reuses the same bounded-facts collection the reply engine already assembles from taught business/receptionist data — no new data source.
- ~~One new, small generation call: given the collected facts, produce the recap sentence(s), citing what was actually taught~~ — **built differently than originally planned here, deliberately**: `lib/receptionist-handover.ts`'s `buildHandoverRecap` is a pure deterministic function, not an LLM call at all. No generation step means no risk of a paraphrase drifting from the facts it was supposed to restate — a stronger form of the same `facts_used` discipline, not a weaker one. Same reasoning `lib/work-card.ts` later reused for its own pipeline.
- Needs a "yes / actually, no" response path — a "no" should route back into teaching, not dead-end the flow. Built as-is: "Actually, let me fix something" routes to `/dashboard/receptionist`.

**What it reads from** (Trust Track 01 sprint, `components/dashboard/receptionist/meet-your-receptionist.tsx` + `app/(dashboard)/dashboard/receptionist/meet/page.tsx`): `businesses` (services, service areas, emergency call-out flag, call-out fee, `business_knowledge`) and `ai_configurations` (business rules, escalation rules, FAQs) — the same columns/tables the reply engine's own `collectFacts` grounds replies in, not a second interpretation of any of them. Real per-day hours come from `businesses.availability` via `lib/availability.ts`'s `parseAvailability`/`describeWeeklyHours`/`hasCustomizedHours` — the same Diary data source, not hours re-derived a different way for this one screen. If the owner has never touched their weekly hours (still on the untouched Mon–Fri/weekend-closed default), the recap says so honestly ("I don't yet know your weekend availability") rather than presenting the default as a taught fact.

**Testing:** `lib/receptionist-handover.test.ts` and `lib/availability.test.ts` (`npm test`, Node's built-in test runner via `tsx`) — readiness states, never-invent-an-amount, real-vs-default hours, and every knowledge field's honest-gap-vs-understood branch.

---

## A2. Test Conversations

**What it needs that doesn't exist yet:** a safe sandbox around the real reply pipeline.

The load-bearing decision: **this must run the actual production pipeline (Understanding → Context → Generate → Safety), not a mock or a simplified stand-in** — otherwise "watch how she'd really handle this" is a lie. The adversarial regression suite (`scripts/reply-engine-tests/`, document 06 §5) already proves this pipeline can be driven this way safely; Test Conversations is the owner-facing version of the same idea.

- Test conversations need to be clearly separated from real ones — tagged, not stored in a parallel system, so they never appear on Front Desk, in Approvals, or in a customer's real history. A test customer identity should follow the same convention already used throughout this project's own testing (the UK's reserved fictional number range) so it's unambiguous at every layer, not just in the UI.
- The reasoning trace ("The Why," document 03 §4) needs a plain-language mapping from fact ids to sentences — a first version of this already exists in the AI Draft Card's fact-source labelling and just needs generalising, not building from scratch.
- Correcting her mid-test needs to write to the *same* real teaching tables the Receptionist page already uses — never a parallel, disposable correction store. This is a data-path decision, not a UI one: get it wrong and "watch her learn" becomes a lie the same way a mocked pipeline would be.
- "Try to break me" (document 03 §4) needs starter prompts across the same categories the Decision Categories table already encodes (document 06 §3) — routine, booking, pricing, emergency, complaint — so the suggestions are testing real decision boundaries, not decorative examples.

---

## A3. Onboarding reorder

**What it needs that doesn't exist yet:** mostly nothing new — this is a sequencing change to existing onboarding steps, once A1 and A2 exist to reorder around. The one new piece: **Approval Mode as an explicit, named stage**, not just the auto-send toggle's current default state — the owner should be told plainly, at this point in onboarding, what's manual today and what becomes available to automate later, rather than discovering that later in Settings.

---

## What this plan deliberately doesn't decide

- The exact UI shape of the Test Conversations sandbox (chat interface, layout, etc.) — that's a screen design, and per the same discipline as Work Cards, the experience (document 03) and the technical requirements (this document) come first.
- ~~Whether Handover happens as a distinct screen/step or inline at the end of teaching~~ — **resolved**: a distinct screen (`/dashboard/receptionist/meet`), linked from the Receptionist page rather than forced into the onboarding flow itself. A3 (onboarding reorder) may still fold it into first-run sequencing later — that's still open.
- Whether the weekly-hours grouping heuristic (`describeWeeklyHours` — consecutive identical days collapse into one range) reads naturally for every real business's hours, or needs a different presentation once more real data is seen. Deferred rather than guessed at further; the underlying data and the fact it's genuinely sourced from the Diary aren't in question, only the phrasing.
- Whether "A bit about you" (the `personality` tag list — "Family business," "Fully insured," etc.) deserves its own named section in the recap rather than one line among many, once there's real usage data on how owners react to it.
