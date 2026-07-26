# ReplyFlow Coaching Experience — Design Proposal

**Study only — no code, no implementation, RC2 remains paused pending a decision on this.** Evaluates the proposal made after extended real-phone use: replace the Behaviour page's configure-then-preview model with a single coach-by-demonstration loop (Teach → Demonstrate → Coach → Trust), unified with Test Conversations, on the strict condition that there is only ever one receptionist — one engine behind coaching, testing, manual drafts, and real WhatsApp, never a separate "practice" version.

**Verdict up front, argued in full below:** the direction is right and should be adopted. The "one brain" requirement is not just a good principle for a new feature — it is currently being *violated*, today, by the existing Behaviour page, independent of whether this proposal goes ahead. But the specific mechanism described for "teaching becomes part of the receptionist's understanding" is, structurally, the same unbuilt capability this project already agreed to defer pending real pilot evidence — and needs to be scoped down sharply before this becomes an implementation plan, not accepted as described.

---

## 1. The most important finding: there are already two receptionists

Before evaluating anything else, one fact has to be on the table, because it changes the whole discussion: **the "practice AI vs. real AI" problem this proposal is trying to prevent already exists in the shipped product.**

Test Conversations is exactly what it claims to be — `app/api/receptionist/test-conversation/route.ts` calls `generateReplyForMessage()`, the literal real production function, in-process. One engine, confirmed.

The Behaviour page's own live phone preview is not. `components/dashboard/receptionist/receptionist-playground.tsx` drives its preview entirely through `buildPreviewConversation()` in `lib/receptionist.ts` — a hand-written, deterministic template function, whose own doc comment says so plainly: *"still 100% deterministic, never a guessed time slot."* Every "watch your teaching become conversation" moment on that page — the tone picker's three example replies, the live phone preview as chips are toggled — is a simulation, not the receptionist. It was very likely built this way deliberately (instant, free, never says something embarrassing mid-teaching), but it means the Behaviour page has been quietly training owners on a *stand-in*, not the employee who actually answers their customers.

This matters for the decision at hand for one reason: **whatever gets decided about the coaching proposal, this specific violation should be fixed regardless.** It's a smaller, already-scoped, already-agreed-with change (Principle 7 already says the model proposes and code decides — a fake model standing in for the real one was never the intended shape of that rule) and doesn't require resolving any of the harder questions below.

---

## 2. Reconciling the new principle with the one that already exists

`Teach → Demonstrate → Coach → Trust` is not a competing framework to the North Star's `Learn → Work → Escalate → Improve` (`00-Vision.md`) — it's a zoomed-in account of what **Learn** (and eventually **Improve**) actually looks like during onboarding, specifically for personality and behaviour, not a replacement for the whole loop. Work and Escalate are unaffected — they describe live operation, which this proposal doesn't touch. Worth stating explicitly in any future spec so the product doesn't end up with two loop-diagrams that look like they disagree.

Framed this way, the proposal is asking for something narrower and more defensible than "a new philosophy": it's proposing that **Learn**, for behaviour/personality specifically, should happen by watching the real engine respond and correcting it — rather than by picking labelled options and inferring the effect.

---

## 3. Checked against the Constitution, Hiring Experience, and both recent reviews

**Constitution, Principle 1 ("trust demonstrated, never asserted") and Principle 6 ("proof before permission"):** strongly supported. This is arguably a *stronger* instance of both than the current Meet Your Receptionist → Test Conversations sequence, because proof starts at the first teaching interaction instead of after a separate configuration phase.

**Constitution, Principle 2 ("hire a receptionist, not software"):** strongly supported, and directly answers the Owner Journey Review's M5 finding (Business teaching's unresolved survey-vs-conversation tension) — but only for the *Behaviour* page. M5 itself is about the *Business Knowledge* page (services, areas, description, FAQs), which this proposal doesn't touch. Adopting this direction does not close M5; it's a separate, still-open question.

**Constitution, Principle 7 ("judgement belongs where it matters... a rule owns the outcome" for anything genuinely costly):** this is where the proposal needs the most scrutiny, and where §5 below focuses. Coaching must never be able to talk the receptionist out of a hard safety rule.

**Hiring Experience Redesign:** directly continuous with its own "three-tool model" and "prove continuously, not just at the end" — this proposal is close to that document's own logical endpoint, just applied specifically to Behaviour rather than Business Knowledge.

**Conversation Excellence Plan:** a real coupling, not a conflict, worth naming plainly — if coaching runs on the real engine, every known rough edge that document found (the greeting-reflex-vs-Voice-Standard tension, the paraphrase gap in repetition detection, the unkept-promise pattern) will be directly visible *during coaching*, not just in production. That's arguably a feature (owners will now be able to correct some of these live) but it does mean the coaching experience's quality is coupled to conversation quality that RC2 paused mid-fix. Worth factoring into sequencing (§6).

**Owner Journey Review:** M3 (personality's effect shown in only one of three places) is close to fully resolved by this proposal, if built — coaching would make personality's effect visible everywhere it's taught, not just the tone picker. Real, direct win.

---

## 4. What "teaching becomes part of the receptionist's understanding" actually requires

This is the single largest open question, and the proposal doesn't yet specify a mechanism — which matters, because the two plausible mechanisms have very different costs:

**Mechanism A — write to the existing free-text fields.** A coaching correction becomes an appended instruction in `business_rules` or `system_prompt` (the same columns the current chip UI already writes to). Cheap, no new data model, ships fast. Real risk: these fields are already going to accumulate real prose from the existing teaching flow; adding a steady stream of coaching-derived instructions on top, with no way to review, prune, or see what's accumulated over time, risks exactly the kind of unbounded, potentially self-contradicting instruction blob a large system prompt tends to become. Given the Conversation Excellence Plan already found the *current, much shorter* set of instructions producing real, measurable problems (the greeting-reflex tension), growing that same free-text surface faster is worth being cautious about.

**Mechanism B — a real, structured correction record.** Each "coach" interaction becomes a genuine, reviewable, revocable unit — closer to a real memory than an appended paragraph. This is materially better, and also **is, structurally, the correction/learning loop** — `recordCorrection()`/`recordOutcome()`, the `reply_outcomes`/`reply_corrections` tables, explicitly named as unbuilt in `06-Engineering-Principles.md` §6, and explicitly deferred in the RC2 Master Refinement Plan on the stated grounds that it needs real pilot outcome data to design against honestly, not a pre-pilot guess.

**The honest tension to name directly:** this proposal, taken at face value, asks to build the harder version of something the project already agreed, two documents ago, to wait on real evidence for. That's not a reason to reject the direction — it's a reason to recommend starting with Mechanism A in a *deliberately bounded* form (a visible, reviewable list of what's been coached, not silent accumulation into a prompt blob), and treating a real Mechanism B as the same later decision the personality data shape already is, rather than backing into it accidentally through this feature.

---

## 5. Where the six rewrite options quietly assume a personality system that doesn't exist yet

"More friendly / more professional / more confident / more reassuring / shorter / ask another follow-up question" are six largely independent axes. The current data model has exactly one: a flat, three-value `tone` enum. `07-Receptionist-Personality-and-Conversation-Architecture.md` §4 already named this precisely — a real personality system needs distinct, independently-teachable axes (sentence length, warmth, confidence, question style), and flagged it as a genuine schema decision, not yet made.

Offering all six rewrite options as described silently requires that richer data shape to exist, or the six choices collapse into overwriting the same one flat value repeatedly — which would mean "more confident" tapped today and "shorter" tapped tomorrow can't both be remembered as distinct, real things the receptionist now does. This is the same deferred decision as the personality data shape, arriving through a different door. Recommend either: scoping the first version down to fewer, genuinely independent options the current model can actually represent, or treating "ship this properly" as the trigger for finally making that data-shape decision on purpose — not by accident, mid-build.

---

## 6. Other real risks worth naming before this becomes a spec

- **Safety categories must be non-negotiable.** Coaching is the right metaphor for tone, warmth, and which business-specific situations need a human — it must never be able to talk the receptionist out of the hard-coded, always-escalate categories (pricing, emergencies, complaints). This needs to be an explicit, stated boundary in any real design, not an assumed one.
- **Coverage risk.** A purely reactive "type what a customer might say" loop only teaches what the owner happens to think to type. Today's structured chip UI guarantees every safety-critical topic (house rules, escalation) gets deliberately asked about. Test Conversations already solved an equivalent problem with categorised starter chips (a routine question, a booking, a pricing question, an emergency, a complaint) — any coaching redesign should reuse that pattern rather than relying on the owner's imagination to reach every important scenario.
- **Honesty about latency.** A real rewrite, on the real engine, is a real model call — a few seconds, not instant. The existing typing/pause/retype pattern (`useTypedMessage`) already exists and should be reused rather than the UI implying an instantaneous swap it can't actually deliver.
- **Honesty about consistency.** FAQs already carry a legitimate word-for-word guarantee, because they're grounded facts the model is instructed to cite verbatim. Coached tone/style is different — it shapes probability, not a fact lookup, so it can never honestly promise "she'll say it exactly like that next time," only "she'll lean this way." Worth being deliberate about which kind of promise any given piece of UI copy is making.
- **Sequencing question, not yet answered:** if coaching-as-demonstration starts from the very first teaching interaction, does Meet Your Receptionist's later recap-and-confirm moment still make sense in its current form, or does it need to move, shrink, or become the natural "graduation" point out of coaching? Real, open, and worth deciding deliberately rather than discovering as an afterthought mid-build.
- **Cost.** Today's Behaviour preview is free and instant because it's a deterministic simulator. Running the real engine for every coaching exchange and every rewrite tap is a real, recurring LLM cost during onboarding specifically — not a reason to reject the direction, but a real input to how liberally rewrite-and-retry gets designed.

---

## 7. Recommendation

**Adopt the direction.** Coach-by-demonstration is more honest, more aligned with Principle 2, and closes a real gap the Owner Journey Review already found. Retiring `buildPreviewConversation` in favour of the real engine should happen regardless of anything else decided here — it's already a violation of "one brain," today, on its own.

**Do not adopt the six-option rewrite palette or the rich "becomes part of her understanding" memory model as described, yet.** Both quietly require decisions (the personality data shape, the correction/learning loop) this project already, deliberately, chose to make only once real pilot evidence exists. Recommend a first version scoped to what the current data model can honestly represent, with coaching corrections written somewhere *visible and reviewable* rather than silently accumulated — and the richer versions of both treated as the same future decisions they already were, arrived at on purpose.

**This does not replace the RC2 Master Refinement Plan.** If this direction is agreed, it becomes its own scoped item, sequenced deliberately — and given §3's coupling to conversation quality, likely sequenced *after* M8a and M9 land, so the first real coaching sessions aren't immediately spent on the exact rough edges RC2 already knows about. RC2 resumes at **M8a**, then **M11**, exactly where it was paused, once a decision is made here.
