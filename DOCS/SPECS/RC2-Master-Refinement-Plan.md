# RC2 Master Refinement Plan

**Planning document. No implementation.** Synthesises `ReplyFlow-Conversation-Excellence-Plan.md`, `ReplyFlow-Owner-Journey-Review.md`, and `DOCS/CONSTITUTION/00-09` (plus `DOCS/BUILD/07-09`, the sprint principles those consolidate) into one list: every place the two reviews found real evidence that the *implementation* has drifted from the *philosophy* the product already agreed to. Not new findings — this document manufactures nothing; every item below traces to a specific real exchange, a specific real screen, or a specific already-written sentence in the Constitution that the current product contradicts.

Each item states: the principle violated, why the tension exists, the fix category, an honest size estimate, and estimated customer impact. Everything is then sorted into P0 (before pilots) / P1 (high-value) / P2 (after pilots). Once agreed, this is the execution order for RC2 — not a menu to work through in whatever order is convenient.

---

## How to read the fix categories

- **Wording** — copy only, no logic change.
- **Sequencing** — reordering or gating what's already built, no new capability.
- **UX** — layout, interaction, or presentation change to an existing screen.
- **Architecture** — a new capability, data shape, or structural mechanism.
- **Conversation design** — a change to what the reply engine is instructed or permitted to do, distinct from a wording tweak because it changes behaviour, not just phrasing.

---

## M1 — WhatsApp is reachable before any proof has been shown

**Principle violated:** Principle 6, "Proof before permission" — and contradicted almost word for word by the Constitution's own journey table (`04-Owner-Experience.md` §1): *"Going live [Connect WhatsApp] — a formality by now, not a leap of faith — she's already been seen at work."*

**Why the tension exists:** `onboarding_completed` flips true after two screens (business name, trade — see `app/api/onboarding/prepare/route.ts`), and it's the only gate `app/(dashboard)/layout.tsx` checks. Confirmed live: with 0 of 4 Hiring Experience steps done, `/dashboard/whatsapp` was fully reachable — nothing checks whether Meet Your Receptionist or Test Conversations ever happened first.

**Fix category:** Sequencing.

**Estimated size:** Small–Medium. The gate condition already exists as computed data (`handover_confirmed_at`, the Brain's receptionist-domain completeness) — this is adding one check to one route, not new capability.

**Estimated customer impact:** Indirect but real — an owner who connects WhatsApp before ever seeing proof is exactly the owner most likely to panic at the first imperfect reply, because the product skipped the step designed to prevent that.

---

## M2 — Completing a step rarely says what it unlocks

**Principle violated:** Principle 5, "ReplyFlow should remove uncertainty." Independently flagged three times before this review ever ran: `05-Experience-Architecture.md` §5 ("why each question matters, stated in-page next to the field, not just a label"), and `07-Implementation-Roadmap.md`'s own backlog ("Receptionist 'why it matters' copy — presentation-only, cheap"). This review found the same gap live, at the highest-visibility moment in the product: Front Desk's own setup checklist.

**Why the tension exists:** `SetupJourney` (`components/dashboard/home/home-experience.tsx`) renders step labels and a bare "X of 4 steps done" — no line anywhere stating what finishing "Business" or "Receptionist" actually changes. The Business page's own gap list ("Where things stand") has the identical shape.

**Fix category:** Wording.

**Estimated size:** Small. This has been sitting in the backlog as "cheap" for a reason — it is.

**Estimated customer impact:** Medium-high for the cost. First-impression, highest-traffic screen in the whole onboarding path.

---

## M3 — Personality's effect is proven in one place, only asserted in two others

**Principle violated:** Principle 5 again, plus Principle 1 ("trust demonstrated, never asserted") applied to the owner's own teaching, not just the customer-facing recap.

**Why the tension exists:** the Receptionist page's tone picker shows three real example replies side by side before the owner chooses — genuine proof. The Business page's "What makes you different" chips and the free-text personality field ask for the same kind of input with no visible link to any output. The mechanism that would fix this already exists and already works elsewhere on the same product.

**Fix category:** UX (surfacing an existing pattern in two more places, not inventing one).

**Estimated size:** Small–Medium. Reuses `buildPreviewConversation`/tone-example machinery already built for the Receptionist page.

**Estimated customer impact:** Medium. Doesn't block anyone, but is the direct, named cause of "I don't understand how that changes the receptionist."

---

## M4 — Booking Rules starts as a conversation and ends as a form

**Principle violated:** Principle 2, "the owner hires a receptionist, not software," specifically for the lower half of `/dashboard/availability`.

**Why the tension exists:** the top of the page ("If someone asks 'are you free today?'...") is the redesigned, scenario-framed pattern working correctly. Scroll further on the identical page and it reverts to plain parameter labels ("How much notice do I need? / Travel time between jobs / Working radius") with no scenario framing at all — confirmed live, same page, same session.

**Fix category:** Wording (reframing existing controls as scenario questions — the pattern is already proven at the top of the same page).

**Estimated size:** Small.

**Estimated customer impact:** Medium. A real, if narrower, version of the "feels like a form" complaint, with an unusually cheap fix because half the work is already done on the same screen.

---

## M5 — Business teaching sits in a real, unresolved tension between two already-agreed goals

**Principle violated:** Principle 2 (not software) in tension with the Sprint 8.7 finding that a chat/avatar metaphor tested as "psychologically perceived as a questionnaire."

**Why the tension exists:** the current progressive-disclosure document format successfully avoids the chatbot-interrogation feeling, but delivers a form with narration, not a back-and-forth — mechanically still label, fill, advance. Forward-guidance acknowledgements help without resolving the underlying mechanic.

**Fix category:** Conversation design / UX — genuinely undecided; this needs a real design pass, not a copy tweak, and risks re-breaking the Sprint 8.7 finding if handled carelessly.

**Estimated size:** Medium–Large.

**Estimated customer impact:** Medium, diffuse (an ambient feeling across a whole page, not one failure moment) — real, but lower urgency than items with a specific, nameable break.

---

## M6 — Progress is celebrated inconsistently, not never

**Principle violated:** Principle 5 and the general spirit of Principle 10 (the product should feel like it's working with the owner, not just recording their input).

**Why the tension exists:** Business and Receptionist teaching both already have real celebration and forward-guidance moments. Front Desk's `SetupJourney` — the very first thing a fresh owner sees — has none of it: a checkmark updates silently, with no acknowledgement anywhere.

**Fix category:** UX (extending an existing, proven pattern to one more surface).

**Estimated size:** Small.

**Estimated customer impact:** Medium. Cheap, and closes the gap at the single highest-visibility screen in the product.

---

## M7 — The business logo doesn't become the WhatsApp Business Profile photo

**Principle violated:** Principle 9, "every customer interaction protects the owner's reputation" — a customer's actual first visual impression of the business, on the actual channel, doesn't reflect what the owner uploaded.

**Why the tension exists:** the Business page's logo upload is honestly scoped — its own copy says "Shown throughout your dashboard." Confirmed against `lib/whatsapp/graph.ts`: no code anywhere calls WhatsApp's Business Profile endpoint. A real customer sees no photo, or Meta's default, regardless of what the owner uploaded.

**Fix category:** Architecture (a real, new, but well-precedented Graph API integration).

**Estimated size:** Medium. One new Graph API call (`/{phone-number-id}/whatsapp_business_profile`) plus wiring the already-uploaded logo to it — no new upload UI needed, the asset already exists in Supabase Storage.

**Estimated customer impact:** Medium-high relative to cost. A one-time, highly visible professionalism signal for every future customer conversation.

---

## M8 — Replies sometimes promise a future action ReplyFlow cannot currently perform

**Principle violated:** Principle 5 ("every interaction should increase confidence") and Principle 9 (reputation) — a broken specific promise is worse than an honest vague one.

**Why the tension exists:** confirmed live and real (not synthetic): *"I'll get back to you shortly with the next available slot"* — never delivered anywhere in the rest of a 154-message thread, with the customer visibly chasing it twice. ReplyFlow has no proactive-messaging capability today (`08-Receptionist-Judgement.md` names this explicitly as unbuilt).

**Two separate fixes here, deliberately not one item:**
- **M8a — stop making the promise.** Conversation design: an instruction constraining the model to either answer immediately or use time-neutral phrasing that implies no specific future action ("I don't have an earlier slot to hand right now" rather than "I'll check and get back to you"). Small. High impact relative to cost — this is available today, without new capability.
- **M8b — build real proactive follow-up.** Architecture: genuinely new capability (an outbound-initiated message mechanism), already flagged as unbuilt and explicitly deferred pending real usage evidence. Large. Deliberately out of scope for RC2.

---

## M9 — A taught instruction can silently override the Voice Standard, with nothing to reconcile them

**Principle violated:** Principle 7, "judgement belongs where it matters... wherever a mistake would be genuinely costly, a rule owns the outcome" — applied here to a lower-stakes but real and measured case: repetition, not safety.

**Why the tension exists:** SHABZ's own taught instruction, *"Always greet the customer warmly,"* is a completely reasonable thing for an owner to write. The Voice Standard's *"skip it entirely mid-conversation"* is also correct. Nothing today treats the Voice Standard as a floor the owner's own words can't accidentally undercut — confirmed by a real transcript with "Hi Rumen! 😊" opening messages deep into an already-running thread.

**Fix category:** Conversation design — the deterministic `greeting_given` fact already exists (Conversation State); this is extending its authority to take precedence over a taught instruction, rather than leaving both as competing prompt text.

**Estimated size:** Small. The mechanism exists; this is a priority rule, not new infrastructure.

**Estimated customer impact:** Medium. Real, measured, frequent in the one real transcript studied — directly cited by name in a real customer complaint ("you sound like an AI").

---

## M10 — The repetition check catches exact phrases, not paraphrases

**Principle violated:** Principle 7's own stated discipline — "a prompt instruction is a request; a safety-layer check is a guarantee" — the guarantee here is real but narrower than it looks.

**Why the tension exists:** `detectUsedStockPhrases` matches nine literal strings. *"If you have any other questions, just let me know!"* and *"feel free to ask!"* are functionally the same idea as phrases already on the list and appear dozens of times, uncaught, in the one real thread studied.

**Fix category:** Architecture (small extension to an existing deterministic mechanism — either a longer phrase list or a lightweight semantic-similarity check, not a new subsystem).

**Estimated size:** Small–Medium.

**Estimated customer impact:** Medium-high. This is the single most quantifiable finding in the Conversation Excellence Plan — measured, not estimated.

---

## M11 — A real conversation lost its thread and answered the wrong question with total confidence

**Principle violated:** the North Star directly — *"the owner should never wonder what ReplyFlow is doing"* — extended here to the customer's version of the same idea, plus Principle 1 (trust demonstrated, not asserted) violated by the confidence with which the wrong answer was delivered.

**Why the tension exists:** a real customer confirmed a rebooking detail ("Yes," re: their niece being home) and received a reply about same-day availability — a complete non-sequitur — followed immediately by the customer saying *"You've got me confused?"* This is Conversation State (already a genuinely sophisticated mechanism — stage, goal, slots, commitments, all carried forward) evidently still breaking under real, compound conversational complexity: multiple live threads (rebooking, a fee question, a third-party confirmation) at once.

**Fix category:** Architecture — this needs real investigation before a size estimate can be trusted; it is not a copy fix.

**Estimated size:** Unknown, deliberately not guessed at. Recommend a scoped investigation (reproduce against the adversarial suite, isolate whether this is a Conversation State gap or a Context Assembly windowing gap) as its own small task before committing to a fix size.

**Estimated customer impact:** High. This is the most damaging single real exchange found across both reviews — direct evidence of the exact failure mode the governing test in the Conversation Excellence Plan exists to catch.

---

## Explicitly catalogued, explicitly not re-opened here

Two real, principle-relevant gaps were found and are deliberately **not** being scored or sized in this plan, because they were already, separately decided:

- **Personality as a flat tone enum** (Conversation Excellence Plan §1; also `07-Receptionist-Personality-and-Conversation-Architecture.md` §4, `02-Conversation-Philosophy.md`, `06-Engineering-Principles.md` §6) — already explicitly deferred, by direct instruction, pending real pilot evidence. Restated here only so this catalogue is honest about its own scope, not to reopen it.
- **The correction/learning loop** ("Improve," the fourth stage of Learn → Work → Escalate → Improve, `00-Vision.md`) — genuinely unbuilt, genuinely large, and structurally *needs* real pilot outcome data to design against honestly. Deferring this isn't avoidance; building it before real corrections exist to learn from would mean guessing at its own shape.

---

## Priority

### P0 — must fix before pilots

- **M1** — WhatsApp reachable before proof. Direct contradiction of an already-written principle, cheap to close, and the one item here with the clearest "a pilot business could genuinely get hurt by this" story (connecting real customers before the product has proven anything to the owner).
- **M8a** — stop promising follow-ups ReplyFlow can't keep. Small, immediately available, and this is the exact failure mode a real customer already lived through, uncorrected, in the data studied.
- **M11** — the thread-loss investigation (not necessarily the fix — the investigation). Size is unknown, but *not knowing* whether this is common or a one-off is itself a pilot risk worth closing before real customers are exposed to it at scale.

### P1 — high-value improvements

- **M2** — unlocks not stated (cheapest item in this whole document relative to its visibility).
- **M3** — personality's effect shown consistently.
- **M4** — Booking Rules' lower half reframed.
- **M6** — progress celebration extended to Front Desk's setup checklist.
- **M7** — WhatsApp Business Profile photo.
- **M9** — taught instructions vs. Voice Standard precedence rule.
- **M10** — repetition check widened.

### P2 — nice refinements after pilots

- **M5** — Business teaching's survey-vs-conversation tension (needs a real design decision first, not just implementation time).
- **M8b** — real proactive follow-up capability (needs the capability to exist before the wording can ever be more ambitious again).
- Personality data shape and the correction/learning loop (catalogued above, deliberately not re-opened) — revisit only once real pilot evidence exists to design them against.

---

## How this gets used

This is the RC2 execution order. Work top to bottom within P0 before touching P1; don't start P2 opportunistically just because an item looks easy — that's exactly the drift this document exists to stop. Each item, when it's actually implemented, should get the same discipline every other change in this project has had: typecheck/lint/test/build, deploy, verify against real data, and — for anything touching the reply engine specifically (M8a, M9, M10, M11) — a clean run of the adversarial regression suite before and after.
