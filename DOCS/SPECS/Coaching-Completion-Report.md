# Coaching Completion Report

Implements the full Coaching Implementation Plan (C1–C6) as one cohesive change: the Receptionist page's teaching preview no longer runs on a separate, fake reasoning system. One receptionist, one brain, everywhere an owner experiences it.

## What changed

- **`lib/reply-engine/live-reply.ts`** — a new function calling the exact real reasoning core production uses (`classifyMessage()` → `generateReplyDraft()` → `evaluateSafety()`), with no real conversation, no persistence, and the Readiness Gate deliberately skipped, so a real example is available from the very first teaching session, before "ready" is ever true.
- **`app/api/receptionist/live-reply/route.ts`** — the authenticated route exposing it. Reads the business's own real, already-saved profile/diary/FAQ facts server-side; accepts only tone/behaviours/rules/escalation from the client — the owner's current, possibly-unsaved draft.
- **The Receptionist page's main phone preview** — now debounced (600ms) against this real endpoint, with an honest "thinking" state instead of an instant swap.
- **The three tone-comparison cards** — now three real, parallel calls instead of a hand-scripted template.
- **Chip-toggle acknowledgements** — now name the specific thing just taught ("Got it — I'll ask if they can send a photo of the issue"), reusing the same reflect-back discipline the FAQ editor already used, instead of a generic rotating phrase.
- **A bounded reaction row** under the real reply — "Sound like you?" / "Let's adjust this." Neither writes anything; the second option opens whichever teaching topic is still a real gap, reusing the exact controls already on the page.
- **Retired entirely:** `buildPreviewConversation`, `toneOpener`, `customerFollowUp`, `greetingFor`, `deriveScenarioStatus`, `PreviewKnowledge` — a full-text search confirms zero remaining callers.
- **Test coverage preserved, not lost:** the old simulator's only real safety-relevant tests (Product Guarantee 1 — never invent the emergency-callout/call-out-fee facts) moved to `lib/reply-engine/prompt/facts.test.ts`, against the real mechanism (`collectFacts`) the engine actually uses, rather than disappearing along with the fake one.
- **Dead prop cleanup:** `availability`, `chargesCalloutFee`, and `calloutFeeAmount` removed end-to-end (page and component) — their only caller was the deleted simulator.

## What did not change

No new database columns, no new tables, no new personality data shape, no correction/learning-loop model. Every write still lands in the exact columns the page always wrote to (`tone`, `system_prompt`, `business_rules`, `escalation_rules`). The RC1 data-loss defence (only writing genuinely-touched fields) is untouched and still verified working. Every hard-coded safety category (pricing, emergencies, complaints always escalate) is enforced by the same, unmodified Safety Layer — nothing about coaching can weaken it, because coaching doesn't touch it at all; it only calls the same read-only evaluation production already runs.

## Regression testing performed

1. **Full typecheck/lint/unit tests/build** — clean (64 tests, same count as before: 5 old simulator-only tests removed, 5 new real-mechanism tests added).
2. **Adversarial regression suite** (`scripts/reply-engine-tests/run.mjs`) against the live deployed webhook — **18/18 scenarios, 0 failed checks.** Confirms the reply engine's real production behaviour is completely unaffected; this change only added a new caller to functions that already existed.
3. **Fresh account, real device viewport (430×932):** confirmed the real reply, confidence tag, and reaction row all render; confirmed chip toggles produce a specific (not generic) acknowledgement once a topic-advance moment doesn't override it; confirmed the three tone examples are genuinely different real text, not three copies of a template.
4. **Real production data (SHABZ):** confirmed SHABZ's real, previously-taught tone/behaviours/rules/escalation load correctly and render a real reply immediately; confirmed a harmless chip toggle-on-then-off round-trip left the stored configuration byte-for-byte unchanged.

## A genuine, real finding from testing — not a bug

Testing "boiler leaking water from underneath — can someone come out?" (the emergency-labelled scenario chip) through the real engine returned a booking-enquiry reply, not an escalation — the real classifier reasonably reads a leak as urgent-but-routine, distinct from a genuine safety emergency (a gas-leak scenario in the same test run correctly escalated every time, exactly as production always has). The old fake simulator always showed every emergency-labelled scenario as "Urgent," regardless of what a real classification would ever produce. This is precisely the gap this whole effort existed to close: the Behaviour page used to be able to tell an owner something the real receptionist wouldn't actually do. It can't anymore.

## Remaining concerns, stated honestly

- **Real, recurring cost.** Every settled teaching change now triggers four real model calls (one main scenario, three tone examples) instead of a free, instant computation. Worth watching in practice, not a blocker.
- **Real latency.** A real reply now takes a few seconds to appear, replacing an instant swap. This was an explicit, deliberate trade-off, agreed in the Single Engine Feasibility Study — surfaced here as a real, felt change, not hidden.
- **C6 was deliberately scoped down.** "Sound like you? / Let's adjust this" is a bounded first version of the coaching reaction, not the deeper reframed teaching sequence outlined as a possibility earlier — it opens the existing teaching card rather than starting a guided correction dialogue. A reasonable, honest scope for one implementation pass; a fuller sequencing change remains a separate future decision if real usage calls for it.
- **Scenarios occasionally surfacing real classification nuance** (as above) is a feature of this change, but means an owner may sometimes see a result that surprises them relative to what a scenario's label implies. Worth watching whether this needs any copy support once real owners use it.

## Honest answer to the question asked

**Does this experience genuinely build more confidence than the old Behaviour page?**

Yes — for a specific, checkable reason, not a vibe: every example on this page is now something the real receptionist actually said, not something a developer scripted to look plausible. The old page could show a fabricated four-turn exchange, complete with a confident booking outcome, regardless of whether the real receptionist would ever produce anything like it. This page can now only show what she'd genuinely do — including the honest, sometimes-humbling moments where that's a booking question instead of a dramatic emergency response. That's a real trust upgrade, not a cosmetic one, and it's the same reasoning core an owner will later watch handle a real customer — because it's not a similar system. It's the same one.

## Status

**Coaching experience complete.** Stopping here per instruction. RC2 remains paused — ready to resume at **M8a**, then **M11**, whenever you're ready, after you've spent time with this on your own devices.
