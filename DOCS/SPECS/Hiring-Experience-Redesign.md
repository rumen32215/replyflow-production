# The Hiring Experience — Redesign Proposal

**Not an architecture document. No database, no components, no implementation.** This is about how a first-time owner *feels*, screen by screen, from the moment they finish signing up to the moment they're ready to hand over their real WhatsApp number. Living proposal — a challenge to every screen, not a decision yet. Promote the agreed parts into `DOCS/CONSTITUTION/04-Owner-Experience.md` once they're settled; until then this stays here, next to `Trust-Track-Implementation-Plan.md`, which it's a direct companion to.

Two passes so far. **Round one** (§0–§6) applied six questions — why am I asking, what's the benefit, could this be conversational, could ReplyFlow infer instead of ask, could it teach through examples, could it celebrate better — mostly keeping each screen's existing shape and improving what surrounds it. **Round two** (§7) applies one sharper standard on top: could this stop being a form at all, and become the owner training someone — including role-play, immediate demonstration, and an honest look at the one real risk that introduces.

---

## 0. The actual diagnosis

ReplyFlow isn't broken. Every guarantee holds, every screen works, the launch-readiness review passed clean. The problem is narrower and more specific than "it feels like software" — **it's that `DOCS/CONSTITUTION/01-Principles.md`'s own second law was never fully carried through into the screens that need it most:**

> **Principle 2 — The owner hires a receptionist, not software.** Everything should feel like training and working with an employee — never configuring AI.

That law is fully realised in Meet Your Receptionist (`03-Trust-Experience.md` §2) — it's the best moment in the product. It is *not* yet realised in the screens that come before it: Business teaching and Receptionist teaching, the two stages `04-Owner-Experience.md`'s journey table calls **Hiring** and currently disposes of in one line — *"Briefing a new hire on their first day, not filling in fields."* That line was always the intent. It was never actually designed at the level of depth Introduction and Proof got. This document is that missing depth.

Two of the ten pain points reported aren't new design problems at all — they're a real gap between what's already been decided and what's actually been built. Naming that precisely, because it changes what kind of work fixes it:

- **"I don't feel confident enough to connect my real WhatsApp after setup"** and **"I want to experience the magic before WhatsApp"** — this is `DOCS/CONSTITUTION/07-Implementation-Roadmap.md` item **A2, Test Conversations**, fully speced in `03-Trust-Experience.md` §3–4 (**"Try to break me,"** the Promise, the whole working-interview design) — and item **A3, the onboarding reorder**, which literally states *"the current sequence asks for WhatsApp before showing any proof."* Both are on the roadmap. Neither is built. Today's testing is the real evidence A3's own text predicted this gap would produce. §4 of this document is about connecting that already-designed moment to the newly-designed Hiring stage below, not inventing it from scratch.
- **"'100% complete' feels like the end of a form"** — this is a real, checkable inconsistency, not a vibe. `03-Trust-Experience.md` §7 already states the law: *"Not a score, not a checklist, not a percentage — document 02's whole judgement standard exists specifically to reject exactly that kind of quantified confidence."* That law was written for the customer-facing Confidence Timeline. The Business and Receptionist teaching screens currently show a live percentage bar ("63% complete," "100% complete") anyway — the exact thing the Constitution already forbade, just never checked against this specific screen. §2 below applies the existing law rather than proposing a new one.

Everything else reported — surveys instead of teaching, not knowing why, no reward, no guidance, FAQ-as-database, booking-rules-as-config — is genuinely new ground. That's most of this document.

---

## 1. The six questions, asked of every current teaching moment

For every question ReplyFlow currently asks during Business and Receptionist teaching:

1. Why am I asking this?
2. What benefit does the owner immediately understand?
3. Could this feel more conversational?
4. Could ReplyFlow infer this instead of asking?
5. Could ReplyFlow teach through examples instead of forms?
6. Could ReplyFlow celebrate this better?

### Business identity, services, areas ("Who we are" / "What we do")

**Today:** name, phone, a description textarea, service chips, area chips — presented as profile fields.

- *Why am I asking, made explicit:* the owner is never told, in the moment, that this exact sentence is what she'll say word-for-word to a nervous customer. Say it: **"When someone asks what you do, I'll say it back close to how you just told me — customers can tell the difference between a real answer and a generic one."** That sentence, shown once, above the description field, does more work than any placeholder copy.
- *Infer instead of ask:* trade is already picked in onboarding. Services could open pre-populated with the real, common services for that trade (the same list `lib/receptionist.ts`'s trade scenarios already model), framed as **"Here's what most [trade]s offer — untick anything you don't do, add anything I'm missing"** rather than a blank chip field. Confirming a guess is a different, lighter feeling than producing an answer from nothing.
- *Celebrate better:* the moment services + areas are both real, that's not a percentage tick — it's the first moment she could plausibly hold a real conversation. Worth a real line: **"That's enough for me to describe your business properly now."** Said once, not repeated on every subsequent edit.

### "How we work" — payments, guarantees, emergency call-outs

- *Why am I asking:* the call-out fee and emergency toggles are currently just switches. The owner isn't told what happens if she skips them. Say it plainly, once, before the toggles: **"If I don't know the answer to these, I'll tell customers the honest truth — that I need to check with you — rather than guess. Answering now means one less thing that gets bounced back to you later."** This turns "why is software asking me this" into "oh, this is the thing that stops her guessing wrong" — which is Guarantee 1, made legible to the owner instead of only enforced silently underneath.
- *Examples instead of forms:* "Ways to pay" as chips is already close to right — keep it. The guarantees field ("12-month workmanship guarantee") is more natural taught through a spoken example than a blank text box: **"If a customer asked 'is your work guaranteed?', what would you actually tell them?"** — the literal question a receptionist would be asked, not a database field labelled "guarantees."

### FAQ — "questions customers often ask"

This is the sharpest example of the survey-vs-teaching problem, because the current UI (a list of Q/A pairs with an Add button) is, structurally, exactly a database table with two columns.

- *Why this one matters most:* every other section teaches a *fact*. FAQ teaches a *pattern of behaviour* — "when X gets asked, say Y" — which is much closer to what training a real employee actually feels like. The UI should feel closer to it too.
- *Reframe as a conversation, not a list:* instead of "add a question," she asks, one at a time, in her own voice: **"What's something customers ask you almost every day?"** — with the existing common-question suggestion chips as a starting point, not the whole mechanism. Once answered, she reflects it back immediately in context: not "Saved" but **"Got it — next time someone asks about free quotes, I'll say exactly that."** — proving, the same way Meet Your Receptionist already proves things, that the answer landed somewhere real, not just into a table row.
- *Teach through examples:* show the answer once, live, inside a realistic customer bubble — the exact shape `lib/receptionist.ts`'s preview already knows how to render — rather than only as a saved list item underneath a form. Seeing "Do you offer free quotes?" answered inside something that looks like a real WhatsApp exchange is what makes it feel like teaching instead of data entry.

### Receptionist behaviours, rules, escalation

This part is already close to right, and worth naming as a positive pattern to extend, not just critique: one topic per turn, her question first, options as tappable chips, a name-personalised acknowledgement on save ("Got it — I'll go by Steve"). That's the "Hiring, not a form" feeling working. The remaining gap is narrower than it looks:

- *Escalation specifically feels like configuration, not a real situation,* because the options are abstract categories ("a gas leak is mentioned") rather than a moment. Reframe each option as the literal scenario a receptionist would actually face: not a checkbox labelled "Gas leak," but her asking **"If someone messages smelling gas, should I always get you immediately, no matter what?"** — same underlying option, a completely different feeling, because it's a decision, not a setting.
- *Celebrate the whole topic finishing,* not just each toggle. Today, three or four individual "Got it" acknowledgements happen and then the section quietly collapses. The moment all three receptionist topics are genuinely taught deserves one line that doesn't currently exist: **"I know exactly how you'd want me to run things now."** (The string already exists in the codebase, tied to the percentage crossing 100 — the sentence is right; only its dependency on a percentage, per §2, needs to change.)

### Booking rules / diary ("notice periods," "busy days")

Not directly tested in today's walkthrough, but named explicitly in the brief and worth designing now rather than leaving as the one section untouched.

- *Today, structurally:* numeric configuration — a notice-period number, toggles for days off. This is the single clearest case of "feels like software configuration instead of real-world situations" in the whole product, because the underlying thing being configured — *when is it okay to say yes* — is inherently a story, not a parameter.
- *Redesign as situations, not settings:* **"If someone messages tonight at 9pm asking to come first thing tomorrow, what should I say?"** with real, human answer options ("Yes, if it's urgent" / "No, I need more notice than that" / "Depends on the day") instead of a numeric stepper. The number the system actually needs (hours of notice) gets derived from the answer, never asked for as a raw figure.
- *A second situation for busy days:* **"Are there days you never want booked, even if I have space?"** — same underlying data (days off), asked as a real question about her actual week instead of a calendar-editing UI.

---

## 2. Fixing "100% complete"

`03-Trust-Experience.md` §7 already settled this question for the Confidence Timeline; it was simply never applied to the teaching screens. Same law, same reasoning, applied consistently:

- **Remove the percentage.** Not soften it, remove it — a number that goes up as fields get filled is a form's own feedback mechanism, not a receptionist's.
- **Replace it with what's actually true underneath the number:** which real things are known and which real things aren't, stated as sentences — which is precisely what the progress bar's own gap-list already almost does ("I still don't know your house rules"). Lead with that list; drop the bar sitting above it.
- **The finishing feeling isn't "100%."** It's a door opening, not a form closing — see §4. Nothing about *reaching* full teaching should read as an ending; it should read as the exact moment the next, better thing becomes available.

---

## 3. Guidance and reward, generally

Two of the ten pain points are cross-cutting, not tied to one screen:

- **"There isn't enough guidance about what comes next."** Every teaching card already knows, structurally, what the next untaught topic is (`nextTopicId`, already computed) — it just doesn't say so out loud. Add one forward-looking sentence, in her voice, at the moment a topic finishes: **"Next, I'll ask about how you like to be paid."** Small, cheap, and it converts a silent auto-advance into something that reads as *her* leading, which is exactly the "she leads the interview" feeling the current chat-turn design already half-built.
- **"Completing something often doesn't feel like anything happened."** Where this is already fixed (naming, chip additions — "Got it — I'll go by Steve") it works well and should be the template. Where it's missing (the profile-completeness bar's silent percentage tick) is exactly what §2 replaces. The fix isn't a new mechanism — it's applying the one mechanism that already works everywhere it currently doesn't.

---

## 4. The centerpiece: closing the gap before WhatsApp

This is where the newly-designed Hiring stage (§1) meets the already-designed, never-built Proof stage (`03-Trust-Experience.md` §3–4).

**The sequence today:** Business → Receptionist → Meet Your Receptionist → Connect WhatsApp.

**The sequence already decided, never shipped** (`07-Implementation-Roadmap.md`, items A1–A3): Meet Your Receptionist should flow *directly* into Test Conversations — *"Want to see how I'd actually handle something? Try me"* — before WhatsApp is ever mentioned. The Promise (§3 of doc 03) gets stated plainly first: *"I'll never pretend to know something you haven't taught me... when I'm not sure, I'll bring you in."* Then the owner is explicitly invited to **"Try to break me"** — real, adversarial questions against everything they just taught, with corrections happening live, in front of them, feeding the exact same teaching data the Hiring screens just wrote to.

This is the direct answer to *"before asking me to connect WhatsApp, I want to experience the magic of ReplyFlow working with MY business"* — not a new idea to invent, but the existing, fully-specified A2/A3 finally getting built, now with concrete evidence (this conversation) that it's the single highest-leverage gap left in the product. The "wow, she already understands my business" moment the brief asks for is, almost word for word, what `03-Trust-Experience.md` §4 already promises: *"I trust her with my customers because I watched her..." — with a real, specific ending.*

WhatsApp connection should be the thing that happens *after* that moment lands, framed the way `04-Owner-Experience.md`'s journey table already names it: **"a formality by now, not a leap of faith — she's already been seen at work."**

---

## 5. The redrawn journey

Extending `04-Owner-Experience.md` §1's table with the Hiring stage now designed and the Proof stage's sequencing finally closed:

| From | The stage | What changed |
|---|---|---|
| Sign up | **Arrival** | Unchanged. |
| Business + Receptionist teaching | **Hiring** | Every question now says why it's being asked; forms become situations and examples where a real one exists (FAQ, booking rules); percentage progress replaced by honest gap statements (§2); each finished topic gets a real, specific acknowledgement, including a forward-looking line about what's next (§3). |
| Meet your receptionist | **Introduction** | Unchanged — already fully designed and shipped. |
| *(new placement)* Test Conversations | **Proof** | Moved to happen immediately after Introduction, before WhatsApp is ever mentioned — closing roadmap items A2/A3. *"Try to break me."* |
| Connect WhatsApp | **Going live** | Unchanged in design, materially easier to say yes to — by this point she's been watched working, not just described. |
| *(rest of table unchanged)* | | |

---

## 6. What this deliberately does not do

No new screens beyond Test Conversations, which was already planned. No new database fields beyond what teaching already writes. No navigation change. Nothing here is a new capability — it's the existing capability (the reply pipeline, the scenario preview, the teaching tables, the chat-turn card pattern) presented as hiring instead of configuring, in the order already decided, with the one already-forbidden percentage finally removed from the one place it was still showing up.

---

## 7. Round two — one more rule: could this be a conversation, not just a better-explained form?

Round one mostly kept the existing shape (a labelled field, a chip list, a toggle) and improved what surrounds it — a "why" line, a better acknowledgement, a removed percentage. That's real progress, but it leaves the actual mechanism unchanged: the owner is still *answering ReplyFlow's questions about their business*, which is closer to a well-mannered interview than to training someone. The sharper standard: **the owner should feel like they're helping someone become brilliant at their job, not filling in what that person needs to know about them.** A good trainee doesn't ask "what services do you offer" — they watch, they try things, they get corrected. This section pushes every screen from round one through that lens a second time.

### 7.1 Three tools, not one mandate

Turning everything into a role-play would be its own new failure — chatty for the sake of chatty is exactly as tiring as a form, just wordier. Every fact ReplyFlow needs during Hiring falls into one of three honest categories, and each has a right tool:

| Kind of fact | Right tool | Why |
|---|---|---|
| **A fact revealed by how the owner would naturally respond to a real customer** — services, tone, pricing behaviour, FAQ answers, emergency judgement, booking judgement | **Role-play.** Show a real customer message, ask "what would you say back?", extract the fact from the natural answer. | The fact and the voice come out together, in one exchange, because that's genuinely how the information exists in the owner's head — not as a list, as a reflex. |
| **A fact with no natural "customer moment"** — business name, phone number, specific postcodes covered | **A plain, direct, conversational question.** No role-play, no theatre — asking felt right in onboarding's "What should I call your business?" already, and forcing a scenario onto a fact like this would be the contrived, annoying kind of conversational. | Not every question needs dramatising. Honesty about that is what keeps this from becoming exhausting. |
| **A fact ReplyFlow can already reasonably guess** — likely services for a known trade, likely tone from how the owner phrases their own answers elsewhere | **Silent inference, offered for confirmation, never asked as a blank question.** | Confirming is a lighter emotional lift than producing — already round one's point (§1), restated here because it's the third leg of the same stool, not a separate idea. |

Every screen below gets re-examined against this table, not against "make it a conversation" as a blanket instruction.

### 7.2 What upgrades, screen by screen

- **Services, re-opened.** Round one proposed a pre-filled, confirm-or-edit chip list. Round two adds the role-play version *in front of* it, because it does more in the same single exchange: **"A customer messages asking 'Do you do bathroom refits?' — what would you actually say back?"** A free-text reply like *"Yeah we do full bathroom fits, plus general plumbing"* teaches services **and** demonstrates real voice at the same time — two round-one steps (services chips, tone selection) collapsing into one natural answer. The pre-filled chip list from round one still appears immediately after, already ticked from what was just said, as the confirm-or-edit step — nothing extra added, the guess is just better-informed now.
- **Emergency call-outs and call-out fee, merged into one scenario.** Round one kept these as two toggles with a "why" line above them. Round two replaces both with one situation: **"It's 11pm and someone messages saying their boiler's leaking badly. Would you go out, or would that wait until morning?"** — a real answer here settles `offersEmergency` outright. A natural, un-prompted follow-up in the same breath — **"And if you did go out for something like that, is there a call-out fee on top?"** — settles the second. Two form controls become one short exchange, not two.
- **Tone, re-opened — the strongest single change in this round.** Today, tone is a pill-picker (Friendly / Professional / Concise) with a separate live-preview panel that updates afterward — two things, seen at two different moments. Replace both with one: show the *same* real customer message answered three ways, side by side, in her three tones, and ask **"Which of these sounds most like you?"** Picking *is* the demonstration — there's no gap between choosing and seeing the consequence, because they're the same tap. This is shorter than today's flow (one interaction instead of pick-then-scroll-to-preview), not longer, and it retires round one's separate "explain why" line for tone entirely — the examples make the why self-evident.
- **Pricing behaviour, newly surfaced.** Not previously its own topic — currently just a rule chip ("Never give exact prices"). A role-play question surfaces it far more honestly than a checkbox ever could: **"A customer asks how much it'd cost to fix a dripping tap — what would you say?"** If the owner's natural answer dodges a specific number (as most trades' honestly would), she can reflect that back rather than ask for a rule in the abstract: **"Sounds like you'd rather not commit to a number over chat — should I always do the same?"** The rule is *discovered* from a real answer, not requested as a setting.
- **Escalation, sharpened further.** Round one already reframed each category as a scenario ("if someone messages smelling gas, should I always get you immediately?"). Round two adds the immediate demonstration (§7.4) directly after the answer, rather than only banking it silently.
- **Booking rules, unchanged from round one** — "if someone messages at 9pm asking for tomorrow morning" was already this round's kind of thinking. What round two adds is §7.4's immediate playback after the answer.
- **FAQ — already the right shape.** Worth saying plainly: FAQ's existing mechanic (a customer's real question, the owner's real answer, reflected back in context) is what every other section above is now being pulled toward. Round one already reframed it as conversation; round two's contribution is recognising FAQ as the *template*, not just one more section to fix.

### 7.3 Prove continuously, not just at the end

Round one's "celebrate better" (§1, §3) asked for a real acknowledgement per topic. Round two sharpens what that acknowledgement should contain: not just a warm sentence, but the actual, live consequence of what was just taught, shown immediately, every time — reusing the exact moment an acknowledgement already fires, never a new screen or an extra step:

- Not *"Got it — I'll remember that,"* but *"Got it — so if someone asks about a dripping tap now, I'd say: '[the real generated sentence].'"*
- Not *"Saved,"* after an escalation scenario, but a one-line replay of the scenario resolving correctly: *"Good to know — if that happens, I'll get you straight away and tell them help's coming."*

This is what makes Meet Your Receptionist (already fully designed, §4) feel like a culmination instead of the *first* time proof appears — by then, the owner has already watched this happen a dozen small times on the way there.

### 7.4 The real risk this introduces — and the existing fix for it

Worth challenging the idea itself, not just the screens: a role-play answer is free text, and free text is genuinely harder to turn into a reliable fact than a tapped chip. Guarantee 1 — *never invent a business fact* — applies just as much to ReplyFlow mis-hearing what an owner meant in a natural-language answer as it does to the reply engine mis-stating something to a customer. Getting this wrong would trade one honesty problem for a different one.

The fix already exists in the product, just needs to run one stage earlier: the same *"have I understood you correctly?"* pattern that already governs Meet Your Receptionist (`03-Trust-Experience.md` §2) applies to every role-play answer the moment it's parsed, not just at the end. **"Sounds like you do bathrooms and general plumbing, and you'd rather not give exact prices over chat — is that right?"** — shown immediately, correctable immediately, exactly like round one's FAQ reflection already does in miniature. Nothing gets stored as a taught fact until it's been read back and confirmed, the same discipline as everywhere else in this product, just applied to a new input method rather than invented for it.

### 7.5 Why this doesn't make Hiring longer

The same number of topics as today (identity, services, payments, emergency, tone, pricing behaviour, escalation, booking rules, FAQ) — no new sections added. Role-play *replaces* the field it used to take to answer the same topic; it doesn't sit in front of one. The confirm-back step (§7.4) reuses the exact acknowledgement moment that already exists on save, just with real content in it instead of "Saved." The tone redesign (§7.2) is measurably *shorter* than today's pick-then-preview. Where role-play wouldn't earn its place (business name, phone number, specific areas), §7.1's table says plainly: don't use it. The goal was never more conversation for its own sake — it's the minimum conversation that makes the answer feel like it came from training someone, not informing something.
