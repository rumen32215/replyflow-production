# 15 — ReplyFlow Onboarding Experience Architecture

**How the signup wizard — welcome through handoff — should feel, and why.** Companion to [04-Trust-Experience.md](04-Trust-Experience.md) (§2 "Meet Your Receptionist," §4 "Test Conversations," §5 "Shadowing" — the real experience this document's own final screen now hands off *directly into*, rather than rehearsing) and [06-Experience-Architecture.md](06-Experience-Architecture.md) (§8, the eight-stage structural sequence this document zooms into the first stage of). Expands the founder-authored seed document `ReplyFlow_V1_Onboarding_Experience_Architecture.docx` (2026-08-04) into a permanent architecture, at the same standard as the landing page's own V8–V18 body of work.

**Status: approved (2026-08-05), superseded in its specifics by `DOCS/CONSTITUTION/16-ReplyFlow-Employment-Philosophy.md` (frozen, permanent) and made concrete by `DOCS/SPECS/ReplyFlow-Onboarding-Implementation-Architecture.md`.** Three revisions have produced this document's current form. The first rejected an earlier draft that bolted a receptionist-presence layer onto the existing five-screen wizard. The second moved account creation to the end of the flow and retired `/welcome`. The third — this one — reverses this document's own earlier route-per-screen conclusion (previously §2 Pass 3, "the research doesn't support collapsing screens"), after the founder tested the built result and found that a well-written route-per-screen flow *still reads as a wizard*, however good the copy. Desk research said discrete steps were fine; live testing said otherwise, and live testing wins. §2–§5 below are rewritten around one continuous encounter, not a sequence of pages.

**Scope, precisely.** This document governs the signup flow only, from the landing page's "Meet your receptionist" click through the moment the owner is handed into `/dashboard/receptionist/meet`. It does not govern that page or `/dashboard/receptionist/try` — doc 04 §2 and §4 already specify both in full.

---

## 0. The governing law

> **The owner should never feel like they are configuring software. They should feel like they are watching someone they just hired come to life, and every answer they give becomes a reason it gets better at the job.**

Three consequences, all load-bearing for everything after this section:

- **The receptionist is the main character of this flow, not ReplyFlow's UI.** A screen that asks a question without it visibly present, listening, and reacting is — by this test — a form, whatever it looks like.
- **A rehearsal is not the job.** Proving understanding by staging a fabricated conversation, then handing the owner to a second, real introduction one click later, fails this test twice: once by inventing a scenario that didn't happen, and once by making the owner sit through two "watch it prove itself" moments back to back.
- **A sequence of pages is not a conversation, even a well-written one.** The owner should never feel they've moved to "screen 2." They should feel they're continuing the same encounter that started the moment they clicked in. This is the finding that reshaped this revision — see §2.

Per doc 16 §3.14: ReplyFlow is never assigned a pronoun in anything the owner reads. It speaks in first person, or by name.

---

## 1. Diagnosis

**From the original wizard** (still true, motivates §3–§4 below): three of five screens acknowledged input mechanically (a heading changes, a checkmark appears) without responding *as* the receptionist, and a scripted demo conversation on the final screen duplicated a real introduction (`/dashboard/receptionist/meet`) waiting one click later — direct evidence in `lib/receptionist-handover.ts`'s own code comment, which deliberately lowered that page's readiness bar so it works "right after the one-minute setup, before Teach."

**From the V19 rebuild** (this revision's own finding): fixing both of the above — giving each answer a specific, in-voice reaction, and deleting the fabricated demo — produced writing that sounds like ReplyFlow. It did not produce a feeling of having hired someone. The founder's own words after testing it live: *"I never once had the feeling I've just hired someone. I simply felt like I was filling out information."* The remaining cause, isolated by direct testing rather than research: **routing between `/hire/name`, `/hire/trade`, and `/hire/area` — three separate page mounts, three URL changes — reads as a wizard structurally, independent of what the copy says.** Every acknowledgment also vanished the moment its screen unmounted, so nothing ever visibly accumulated; the owner never got to watch a mental model of their business being built in front of them.

---

## 2. Research foundation, and where it was overridden by direct testing

Four research passes fed the V19 revision — flow-structure and interaction-motion principles across Linear/Stripe/Apple/Arc/Notion/Slack, plus autonomous-agent onboarding patterns (ElevenLabs Agents, Cursor, Intercom Fin, Perplexity). Two conclusions from that research still hold and are unchanged by this revision:

- **The demo conversation stays deleted.** None of the agent products studied stage a fabricated "watch me prove I understand you" scenario before real use; ReplyFlow already has the real version of this mechanic (Shadowing, doc 04 §5).
- **Account creation stays at the end of the flow**, framed as itself rather than disguised as another question.

One conclusion from that research is **explicitly overridden** by this revision: the earlier finding that "the most obsessively-designed products studied all still use discrete sequential steps" was read as evidence for keeping a route-per-screen structure. Live testing of the built result contradicts that reading — the products cited (Apple, Linear, Notion) present their steps as one felt continuity even when the URL or view technically changes underneath; ReplyFlow's own build didn't achieve that feeling, it just changed pages with good copy on each one. The fix isn't more research, it's building the continuity directly: one persistent view, one URL, an identity that never leaves the screen, and answers that visibly accumulate instead of disappearing between navigations.

---

## 3. One continuous encounter, not a route per question

The three real questions — business name, trade, service area — now live inside a single view at one URL, not three separate routes. The receptionist's identity mark, the greeting, and every prior acknowledgment stay mounted and visible for the entire encounter; only the active question changes underneath them, in place. Advancing from one question to the next is a local state change, not a page navigation — there is no "screen 2" to arrive at, because nothing is ever left behind and re-entered.

Each real answer produces two things, together, the instant it's given:
1. **A permanent line added to a visible, growing list** — never removed, never replaced by the next one. By the time all three questions are answered, the owner has watched the list build in front of them: a visible record of what's just been learned, not a memory they have to trust happened off-screen.
2. **A brief, restrained micro-interaction on the identity mark itself** — see §5.

Each acknowledgment explains *why* the fact matters, not just that it was received:
- Business name → *"Nice to meet you, {name}. That's the name your customers already trust, so that's the name I'll answer with."*
- Trade selected → *"I'll sound like a [trade], not a call centre."*
- Service area(s) → *"Got it — I'll only ever promise work in the areas you've actually taught me."*

Never gates progress on its own; never louder than the question currently on screen.

---

## 4. Service area is a set, not a sentence

A single free-text field never matched how a tradesperson actually describes where they work — one town, several towns, a named region, a mile radius, or a boundary phrase ("anywhere inside the M25") all need to fit, and a plain sentence like "London, Luton" doesn't scale past two examples. This also corrects a genuine data-model mismatch: the `businesses` table has always stored `service_areas` as an array, and the dashboard's own Business Knowledge editor already collects it as a set of chips — onboarding was the one surface still forcing it through a single string. The onboarding surface now uses the same chip-based multi-entry pattern as the dashboard (add a town, postcode, or area; remove any of them) — one shared component, not two competing patterns for the same fact.

## 5. Micro-interactions replace generic feedback

Every committed answer produces one small, consistent motion on the receptionist's own identity mark — a brief scale-and-glow settle, not a checkmark on the form field. On a phone, the same moment also produces a single, barely-there haptic tick (`navigator.vibrate`, feature-detected, silently absent everywhere unsupported). Nothing louder than this: no confetti, no completion counters, no gamified progress. Apple's own restraint is the reference point — the feedback exists to reassure, never to celebrate.

Trade selection remains the one screen where a single tap is already a complete decision — the card highlights, the acknowledgment commits, and the encounter advances to the next question automatically, with no button. Business name (typing has no natural completion signal) and service area (a genuine multi-entry field) keep an explicit action, worded to state what happens next — never "Continue" (doc 16 §3.4).

Hours default to the same stated line as before ("Open weekdays, 8am till 5:30pm — tell me if that's wrong") and stay collapsed by default. Disclosing them now offers plain-language presets first (the current default, an earlier start, every day, or "set exact hours") — the raw day-grid and time pickers are kept only as the last option, for genuinely custom schedules, not as the first thing shown. A full configuration grid as the immediate response to "tell me if that's wrong" reads as configuration software; a short set of real choices doesn't.

---

## 6. The handoff — account creation, then the real setup

The three real questions are answered first, inside the single continuous view, with no account yet. Immediately after, a real navigation to `/signup` creates the account — honestly framed as itself, "one more thing before I start," never disguised as another question, and reasoned in terms of continuity and ownership ("so everything I've just learned stays with me, and only you can see it") rather than security language. The screen shows a condensed recap of what's already been learned, so arriving there still reads as the same encounter continuing rather than a new page.

Only then does the setup screen run: the one real thing it ever needed to do, the `POST /api/onboarding/prepare` call that creates the business row, with the existing facts panel ("What I've already learned," real and grounded) filling the wait. No demo conversation runs. Once the request resolves, the screen reads *"I know enough to get started"* and offers one action — *"Let's get to work"* — an owner-paced consent moment, not an automatic navigation. Clicking through routes into `/dashboard/receptionist/meet`, unchanged, which already opens correctly the moment a service area exists.

Test Conversations' own readiness gate (`lib/reply-engine/generate-reply.ts`, untouched) still honestly tells the owner if it isn't fully taught yet when they try it for real.

---

## 7. What stays, and what this revision removed

**Removed:** the route-per-question structure itself (`/hire/name`, `/hire/trade`, `/hire/area` as three separate pages) — collapsed into one continuous view at one URL, per §3. The cross-route "persistent presence living in a shared layout" mechanism from the previous revision is retired along with it; there's no route boundary left for it to survive across.

**Stays:**
- `/dashboard/receptionist/meet` and `/dashboard/receptionist/try` — doc 04's territory, not touched.
- The five real facts collected (business name, trade, service area(s), hours, days) — the right five, no more.
- The trade grid's "More soon" tile.
- No separate greeting screen before the first real question; no step counter — both already removed in the previous revision, unaffected by this one.
- The visual language throughout — `rounded-3xl` cards, `primary → success` gradient, `EASE`, the shared CTA's light-sweep.

---

## 8. Concepts this document introduces

- **The governing test, tripled** (§0) — a screen fails it by giving nothing back, by staging a rehearsal, or by feeling like a page change rather than a continuing encounter.
- **One continuous encounter, not a route per question** (§3) — the reversal of this document's own earlier conclusion, made on direct evidence from testing the built result rather than desk research.
- **Visible, accumulating acknowledgment** (§3) — every answer becomes a permanent, visible line explaining why it matters, not a reaction that appears and disappears.
- **Service area as a set** (§4) — chip-based multi-entry, matching the dashboard's own existing pattern and the database's own existing schema, rather than a single sentence.
- **Restrained micro-interaction as the feedback language** (§5) — one consistent motion (plus an optional haptic tick on mobile) on every commit, never louder than reassurance.
- **No hardcoded pronoun** (§0, doc 16 §3.14) — first person or by name, never assigned.

---

## 9. How to use this document

Before adding anything to this flow, check §0 first — does this make the owner feel like they're watching something come to life and continuing one encounter, or does it just make a screen busier or introduce a page change? Then check whether it's real: does this show or claim something that genuinely happened, or does it invent a scenario for effect? A change that fails either question doesn't belong here, however easy it would be to build. Where an implementation decision isn't specified above, pick conservatively toward restraint — feedback that under-reacts is a missed opportunity; feedback that over-reacts, or a proof moment that isn't genuinely real, has already broken §0's test.
