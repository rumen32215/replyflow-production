# 15 — ReplyFlow Onboarding Experience Architecture

**How the signup wizard — welcome through handoff — should feel, and why.** Companion to [04-Trust-Experience.md](04-Trust-Experience.md) (§2 "Meet Your Receptionist," §4 "Test Conversations," §5 "Shadowing" — the real experience this document's own final screen now hands off *directly into*, rather than rehearsing) and [06-Experience-Architecture.md](06-Experience-Architecture.md) (§8, the eight-stage structural sequence this document zooms into the first stage of). Expands the founder-authored seed document `ReplyFlow_V1_Onboarding_Experience_Architecture.docx` (2026-08-04) into a permanent architecture, at the same standard as the landing page's own V8–V18 body of work.

**Status: approved (2026-08-05), superseded in its specifics by `DOCS/CONSTITUTION/16-ReplyFlow-Employment-Philosophy.md` (frozen, permanent) and made concrete by `DOCS/SPECS/ReplyFlow-Onboarding-Implementation-Architecture.md` (the buildable version of what's described below).** Two revisions produced this document's current form. The first (2026-08-04) rejected an earlier draft that bolted a receptionist-presence layer onto the existing five-screen wizard without challenging its structure, its demo conversation, or its Continue-button rhythm — the redesign below is that rejection's result. The second, later the same day, asked a sharper question than "which software patterns are left": *if this philosophy were a real receptionist five years into working at a plumbing business, what would still feel fake?* That pass produced doc 16 and, downstream of it, moved the account-creation step from the front of this flow to its end (§4, §6) and retired `/welcome` as a separate screen (§3, §7) — both real structural changes this document's §3–§7 now reflect, not just copy.

**Scope, precisely.** This document governs the signup flow only, from the landing page's "Meet your receptionist" click through the moment the owner is handed into `/dashboard/receptionist/meet`. It does not govern that page or `/dashboard/receptionist/try` — doc 04 §2 and §4 already specify both in full, and §6 below exists specifically to hand off into them cleanly, not to redesign either.

---

## 0. The governing law

> **The owner should never feel like they are configuring software. They should feel like they are watching someone they just hired come to life, and every answer they give is a reason she gets better at the job.**

Two consequences, both load-bearing for everything after this section:

- **The receptionist is the main character of this flow, not ReplyFlow's UI.** A screen that asks a question without her visibly present, listening, and reacting is — by this test — a form, whatever it looks like.
- **A rehearsal is not the job.** Proving she understands by staging a fabricated conversation, then handing the owner to a second, real introduction one click later, fails this test twice: once by inventing a scenario that didn't happen, and once by making the owner sit through two "watch her prove it" moments back to back. This is the finding that reshaped this document — see §2 and §6.

---

## 1. Diagnosis

Evaluated as one continuous experience, not screen-by-screen. Two real gaps, and they compound each other.

**Gap one — three screens give the owner nothing back.** `/onboarding/business-name`, `/onboarding/trade`, and `/onboarding/service-area` acknowledge input (a heading changes, a checkmark appears) but never respond *as her*. She is absent from three of the wizard's five screens. Welcome already passes §0's test; these three don't. The founder's own seed-document principle — "every answer makes the receptionist smarter" — was true only on the last screen.

**Gap two — the wizard stages a performance the product doesn't need, in front of an architecture already built to skip it.** `/onboarding/preparing` runs a scripted four-message demo conversation before showing "Meet your receptionist" as its own CTA — which then routes to `/dashboard/receptionist/meet`, a *second*, real introduction (doc 04 §2) built specifically to open the moment onboarding finishes. Direct evidence this was never meant to coexist with a demo: `lib/receptionist-handover.ts`'s own code comment states the "Meet Your Receptionist" readiness bar was deliberately lowered so that page works "right after the one-minute setup, before Teach" — it only requires a service area, which the wizard always provides. The fabricated demo was added in a later pass without being reconciled against this. The owner currently gets two "watch her prove she understood" moments, one invented and one real, one click apart.

This produces the shape the founder's seed document already named: "too many Continue moments... a final conversation that repeats trust already earned." The mechanism is more specific than the seed document could have known before this audit: it's not just that Continue moments repeat, it's that the *wizard's own ending duplicates the real thing waiting right after it.*

---

## 2. Research foundation

Four research passes fed this document: two from the previous (rejected) revision — flow-structure principles across Linear/Stripe/Apple/Arc/Notion/Slack, and interaction/motion design across the same six — and two new passes run specifically to answer the founder's challenge.

**Pass 3 — continuous surface vs. discrete screens** (Apple, Linear, Arc, Notion, Stripe, Superhuman, Typeform). Finding: the evidence does not support collapsing onboarding into one morphing single-page canvas. Apple, Linear, and Notion — the most obsessively-designed products studied — all still use discrete sequential steps, sometimes auto-advancing on a single decisive input, never eliminating steps wholesale. Typeform's own completion-rate data (~47% vs. an industry ~21.5%) is real evidence *for* conversational, auto-advancing single-decision screens specifically — not for abandoning screens altogether. The credible pattern that recurs (Stripe's activation checklist living in the real dashboard; Notion dropping a user into the real, pre-populated workspace after a short survey) is: **a short sequential intake, after which onboarding stops being a separate wizard and becomes the real product** — not a longer rehearsal, not a single infinite canvas.

**Pass 4 — the demo conversation, specifically for autonomous AI agents** (ElevenLabs Agents, Cursor, Intercom Fin, Perplexity). Finding: none of them stage a fabricated "watch me prove I understand you" demo before real use. The recurring pattern is real-data-grounded verification for the *builder's* confidence (Intercom's batch-testing runs against the business's own real content, never a generic script), followed by staged real exposure — supervised, then broader. A documented critique recurs across multiple sources: a scripted demo reads as "cherry-picked theater" to a sophisticated user, and — per GitLab's own agent-trust research — trust is "not built through dramatic breakthroughs, but through countless small [real] interactions." ReplyFlow already has the real version of this mechanic: Shadowing (doc 04 §5), where every drafted reply to a real customer message requires the owner's approval before sending.

**What changed a decision, concretely:**
- Pass 3 is why the route-per-screen structure is *kept* (§4) rather than rebuilt — a considered decision, not an unexamined one.
- Pass 3's "onboarding becomes the real product, not a rehearsal of it" is the direct source of §6's redesign.
- Pass 4, combined with the `receptionist-handover.ts` finding (§1), is why the demo conversation is deleted rather than reframed.
- Apple/visionOS's "some steps auto-complete on valid input, no button tap needed" (a biometric scan succeeding advances automatically) is the direct precedent for §5's trade-screen auto-advance.

---

## 3. The receptionist presence

Across the three real questions — business name, trade, service area — a small, restrained presence lives in the shared layout for that group of screens (the same non-remounted component instance across all three, since Next.js keeps a layout's own tree mounted while only the page segment changes) and reacts once, specifically, to each real answer:

- Business name valid → *"Business learned."*
- Trade selected → *"Trade understood — I'll sound like a [trade], not a call centre."*
- Service area + hours + days all valid → *"Availability remembered. Service area mapped."*

These are the seed document's own named examples, given a permanent home. Never gates progress. Never louder than the question on screen. The first of these three screens *is* the greeting now — there is no separate "she speaks first" screen before it (§7) — and the setup screen at the end of the flow doesn't get a second instance of this presence; it no longer needs one once the demo is gone (§6).

---

## 4. Routes stay, but the account boundary moves

Per §2 Pass 3, the route-per-screen structure is kept deliberately — rebuilding it into a single client-side stepper would cost real, working infrastructure (back-navigation, deep-linking) for a structural change the research doesn't actually support; the most premium products studied all still use discrete steps. What *does* change, and what doc 16's own five-year-employee test (§0 of that document) forced a second look at: **the three real questions are answered before any account exists**, not after. Nothing in a real hiring conversation stops midway to ask for the owner's email and password — that ask belongs at the natural end of "let's get to know each other," framed as protecting what's already been said, never as a gate in front of it. The account is created once, at that point, and the setup screen after it inherits a session that already exists rather than creating one itself. This is a genuine structural change from the earlier draft of this document, not a copy adjustment — see `DOCS/SPECS/ReplyFlow-Onboarding-Implementation-Architecture.md` §3.1 for how this is achieved without weakening anything already protected.

---

## 5. Trade selection auto-advances

A single tap on a trade card is a complete decision — there is nothing left to confirm. The card highlights, the presence reacts (§3), and the screen advances to the next question automatically, with no button on that screen at all. This is the one screen in the flow where a button was pure ceremony around an already-finished decision. Business-name (typing has no natural completion signal) and service-area (a genuine multi-field screen — area, with hours and days defaulted and disclosed on request rather than always shown) keep an explicit action button — never labelled "Continue" (doc 16 §3.4), always stating what actually happens next. Auto-advance is applied where the research supports it, not applied uniformly for its own sake.

---

## 6. The handoff — the demo is deleted, the setup screen ends in her starting, not a launch

The three real questions are answered first, with no account yet (§4). Immediately after, one screen creates the account — honestly framed as itself, "one more thing before she starts," never disguised as another question. Only then does the setup screen run: the one real thing it ever needed to do, the `POST /api/onboarding/prepare` call that creates the business row, with the existing facts panel ("What I've already learned," real and grounded, not fabricated) filling that real wait. No demo conversation runs. Once the request resolves and the facts finish settling, the screen reads *"She's ready."* and offers one action — *"Let's put her to work"* — a genuine, owner-paced consent moment, not an automatic navigation that removes their chance to read what's on screen. "Launch ReplyFlow," this document's own earlier suggestion, was rejected on review: *launch* is what happens to software, not to a person starting a shift (doc 16 §9's own test). Clicking through routes straight into `/dashboard/receptionist/meet`, unchanged, which already opens correctly the moment a service area exists (§1's `receptionist-handover.ts` finding). The owner now gets exactly one "watch her prove she understood" moment — the real one — instead of an invented one followed by a real one.

Test Conversations' own readiness gate (`lib/reply-engine/generate-reply.ts`, untouched) still honestly tells the owner if she isn't fully taught yet when they try her for real — that safety net was never provided by the deleted demo and doesn't depend on it.

---

## 7. What stays, and what this revision removed

**Removed, not just relocated:** a separate "she speaks first" screen before the first real question — doc 16 §0's own five-year-employee test asked what it would mean for a real employee to greet you, then ask you to click through a second screen before actually starting the conversation. Nothing does that. The greeting merges into the first real question instead. The numbered progress indicator ("Step X of 5") is also gone outright, not simplified — doc 16 §3.3 bans step counters permanently; a three-question conversation was never going to need one anyway.

**Stays:**
- `/dashboard/receptionist/meet` and `/dashboard/receptionist/try` — doc 04's territory, already correctly built for this handoff, not touched.
- The five real facts collected (business name, trade, service area, hours, days) — the right five, no more.
- The trade grid's "More soon" tile.
- The visual language throughout — `rounded-3xl` cards, `primary → success` gradient, `EASE`, the shared CTA's light-sweep — matches the landing page precisely already.

---

## 8. Concepts this document introduces

- **The governing test, doubled** (§0) — a screen fails it either by giving nothing back, or by staging a rehearsal in front of an architecture already built to skip straight to the real thing.
- **The persistent receptionist presence** (§3) — a small, consistent character element, genuinely non-remounted across the three real-question routes (a Next.js layout mechanism, not a simulated persistence), reacting once per real answer.
- **Routes kept on evidence, the account boundary moved on principle** (§4) — the research was checked before the route structure was preserved; the credential screen's *position* in that structure changed anyway, once doc 16's own test was applied to it.
- **Auto-advance where a decision is truly complete** (§5) — applied to exactly one screen, for a reason specific to that screen, not as a general pattern.
- **The demo is deleted, not reframed** (§6) — the flow's ending stops rehearsing an introduction the product already delivers for real, one click later; "she's ready, put her to work" is owner-paced consent into that real handoff, not a second performance, and not a launch.
- **No separate greeting screen, no step counter** (§7) — both removed outright once checked against doc 16, not carried forward out of habit.

---

## 9. How to use this document

Before adding anything to the wizard, check §0 first — does this make the owner feel like she's coming to life, or does it just make a screen busier? Then check whether it's real: does this show or claim something that genuinely happened, or does it invent a scenario for effect? A change that fails either question doesn't belong here, however easy it would be to build. Where an implementation decision isn't specified above (exact reaction copy beyond the three named phrases, exact timing of the presence's entrance), pick conservatively toward restraint — a presence that under-reacts is a missed opportunity; one that over-reacts, or a proof moment that isn't genuinely real, has already broken §0's test.
