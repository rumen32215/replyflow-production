# Coaching Implementation Plan

**Planning document. No code yet.** Turns the agreed decision — one engine, fact confirmation instant, conversation demonstration always real — into a sequence of small, independently implementable and testable milestones. Each one gets the same discipline as an RC2 item: study → design → implement → regression test only what's affected → completion report → stop. This plan runs as its own track, separate from RC2 (currently paused at M8a); once both are through their pause point, sequencing between them is a later decision, not assumed here.

---

## What's already decided, restated once so this document stands alone

- One reasoning core (`generateReplyDraft()` + the real Safety Layer) decides what she'd say and whether it's safe, everywhere — production, Test Conversations, and any future preview or coaching surface. No second engine, ever.
- **Fact confirmation** (reflecting back a specific thing just taught) stays instant and deterministic — but must be honestly framed as that, never dressed up as a simulated customer exchange.
- **Conversation demonstration** (showing what she'd actually say) always goes through the real engine, with real latency, honestly shown as a "thinking" state.
- No new personality data shape. No correction/learning-loop data model. Both stay exactly as deferred.

## Constraints that apply to every milestone below, not just one

- **Safety categories are never adjustable.** Pricing, emergencies, and complaints stay hard-coded, always-escalate, full stop — nothing built here can create a path, direct or indirect, to soften that.
- **No new database tables or columns for teaching data.** Every milestone writes to the exact same places the current Behaviour page already writes to (`tone`, `system_prompt`, `business_rules`, `escalation_rules`) — only the *sequence and framing* of teaching changes, not where it's stored.
- **Reuse before building.** Scenario messages reuse `scenariosForTrade()` (already built, already trade-aware). Safety/confidence display reuses `ConfidenceTag`/`factSourceSummary` (already built for Conversations and Test Conversations). The debounce pattern reuses the existing 700–800ms autosave convention. Nothing here should invent a pattern the product doesn't already have a version of.

---

## C1 — A real, DB-free preview endpoint

**Goal:** expose the real reasoning core for a hypothetical scenario, without a real conversation existing.

**What it is:** a new, small server function (and a thin API route) that accepts the owner's current teaching state — tone, behaviours, rules, escalation, plus the already-saved business profile and diary facts — and a scenario message, builds a `ReplyContext` by hand (no database write, no real conversation row), and calls the real `classifyMessage()` → `generateReplyDraft()` → `evaluateSafety()` sequence exactly as production does. Deliberately skips the Readiness Gate (a preview isn't a real send) and any persistence.

**What it explicitly does not do:** write a `reply_drafts` row, require a real conversation or customer, or invent a faster/fake version of classification or generation. Both real model calls happen, honestly, every time.

**Depends on:** nothing — purely additive plumbing, no UI changes, no existing call site touched yet.

**How it's tested in isolation:** call it directly with a range of real teaching-state combinations (untaught, partially taught, fully taught) and confirm: it returns a real, sensible generated reply; it never touches `reply_drafts`, `conversations`, or `messages`; it works identically whether the business is "ready" or not; safety/confidence output matches what the same inputs would produce through the real webhook path.

---

## C2 — The Receptionist page's live phone preview becomes real

**Goal:** retire the single highest-visibility instance of the fake simulator.

**What changes:** the main phone preview (currently `buildPreviewConversation`, recomputed on every keystroke) now calls C1's endpoint instead — debounced on the same ~700–800ms rhythm already used for autosave elsewhere on this page, with an honest "thinking" state (reusing the existing `TypingDots`/`useTypedMessage` pattern) while the real call is in flight.

**What stays the same:** the scenario tabs, the surrounding teaching UI, the chip/free-text mechanisms underneath — untouched.

**Depends on:** C1.

**How it's tested in isolation:** teach a fresh business through each topic and confirm the preview updates to real, sensible replies after each settled change; confirm it reflects real confidence/escalation info now available (a new, genuine improvement — the old simulator never showed this); confirm a slow or failed call shows a graceful, non-blocking state rather than breaking the page.

---

## C3 — Tone comparison becomes real

**Goal:** retire the second call site of the fake simulator.

**What changes:** the three tone-example cards (Friendly/Professional/Concise) fire three real, parallel calls through C1 — on-demand (when the tone section is opened, or on a deliberate refresh action) rather than on every keystroke elsewhere on the page, since comparing tones is a discrete, infrequent action, not a continuous one.

**Depends on:** C1. Independent of C2 — different UI surface, can be built and shipped in either order.

**How it's tested in isolation:** confirm the three examples are now genuinely different generated replies (not just three canned openers), confirm they don't re-fire on unrelated keystrokes elsewhere on the page, confirm a failure in one doesn't block the other two.

---

## C4 — Fact confirmation, made honest

**Goal:** every remaining instant acknowledgment on the Behaviour page reflects a specific taught fact in its own words, and none of them pretend to be a simulated customer exchange.

**What changes:** copy and acknowledgment logic only — no engine call, no latency, nothing new to fail. The model to match is already built and working (the FAQ editor's "Got it — next time someone asks X, I'll say exactly that"); this extends the same discipline to the behaviour/rule/escalation chip toggles, which currently only get a generic ack ("Perfect," "Got it") with no reflection of the specific thing just taught.

**Depends on:** nothing technically — can run in parallel with C1–C3.

**How it's tested in isolation:** toggle each chip and confirm the acknowledgment names the specific thing just taught, not a generic phrase; confirm nothing here is mistaken for a conversation preview.

---

## C5 — Retire the simulator

**Goal:** make "one brain" checkable, not just true in the surfaces that matter.

**What changes:** once C2 and C3 have replaced its only two call sites, delete `buildPreviewConversation`, `toneOpener`, and any now-dead supporting code in `lib/receptionist.ts`. Grep for zero remaining references as the literal acceptance criterion.

**Depends on:** C2 and C3 both shipped and verified first.

**How it's tested in isolation:** the existing unit test suite for `lib/receptionist.ts` (whatever still applies to the surviving code) passes; a full-text search confirms no remaining caller of the deleted functions anywhere in the codebase.

---

## C6 — The coaching sequence itself

**Goal:** the actual experience shift — demonstrate before configuring, matching "Teach → Demonstrate → Coach."

**What changes:** the Behaviour page's entry sequence reorders around C1's now-proven real preview. Instead of opening on a list of things to configure, the owner is offered a scenario first (reusing the same starter-message pattern already built for Test Conversations), sees a real reply generated from whatever's taught so far — including sensible defaults where nothing's been taught yet — and is invited to react. A reply that's already good needs nothing further. A reply that isn't prompts the *existing* teaching mechanisms contextually: "add a rule," "change my tone," "tell me when to hand this off" — each one opening the exact same chip/free-text control that exists today, just reached from "here's why this needs adjusting" instead of a cold settings list.

**What explicitly does not change:** where anything is stored, what the safety layer can be told to ignore, or the underlying data shape of tone/behaviours/rules/escalation. This milestone is a sequencing and framing change built entirely on mechanisms C1–C5 already proved real.

**Depends on:** C1–C5 all shipped. This is deliberately last — the riskiest, most design-involved milestone, built only once the underlying plumbing has already been proven correct and reliable in production.

**How it's tested in isolation:** a fresh business can reach a real, sensible reply from message one; every adjustment path still writes to the same columns the current page writes to; nothing here creates a way to weaken a hard-coded escalation category; the sequence still fits naturally ahead of Meet Your Receptionist, which is unaffected by this milestone.

---

## Relationship to RC2

This plan, once C1–C6 ship, fully resolves RC2's **M3** (personality's effect shown in only one of three places) — M3 should be considered superseded rather than executed separately afterward. It doesn't touch M8a, M9, M10, or M11 (all in the reply engine's live production behaviour, not the teaching UI) — those remain exactly where RC2 paused them.

## How this gets executed

One milestone at a time, in the order above (C2 and C3 may swap; everything else is a real dependency, not a preference). Each milestone: study → design → implement → regression test only what it touched → completion report → stop, exactly the RC2 discipline already in use. No milestone starts until the previous one is reviewed and confirmed working from a real device, same as RC2's own cadence.
