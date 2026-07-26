# ReplyFlow Conversation Excellence Plan

**Proposed standard, not yet adopted.** No prompts, no models, no APIs — this document describes what makes a customer finish a WhatsApp conversation believing they were talking to an excellent receptionist, not how the code produces that feeling. Once agreed, this is the standard every future conversation gets measured against; until then, it's a draft for discussion, which is why it lives in `DOCS/SPECS/` rather than `DOCS/CONSTITUTION/` — its natural home once ratified would be alongside `02-Conversation-Philosophy.md`.

Everything below is built from three sources, in this order of weight: **real production conversations** (§2), **the philosophy already agreed** (`DOCS/CONSTITUTION/01-03`, `DOCS/BUILD/07-09`), and only then judgement calls where evidence was thin. Every claim below is either a quoted, timestamped real exchange, or explicitly marked as a judgement call rather than dressed up as evidence.

---

## 1. The governing test

Document 02 already has a test for a single sentence: *would a customer believe this was ChatGPT, or a real receptionist?* Document 03 has one for the owner's trust: *what would make the owner trust ReplyFlow one little bit more than five minutes ago?* Neither is quite the question for a whole conversation, end to end, from the customer's side. This document proposes the missing one:

> **If this customer were asked, the moment the conversation ended, "did you just speak to software, or to someone who actually works there?" — would they hesitate?**

This isn't hypothetical. It already happened. A real customer, mid-conversation with SHABZ, said exactly this, unprompted:

> *"To much repetition I don't like it, you sound like an AI"* — 2026-07-22, 17:51

That sentence is the single most important piece of evidence in this whole document. It's not a theory about what might erode trust — it's a customer stating, in their own words, the exact moment ReplyFlow failed the governing test. Everything below traces back to understanding why that moment happened and where else it's quietly happening without anyone saying so out loud.

---

## 2. Method — what was actually studied

Per instruction, not assumptions: five real (non-test-phone) conversations were pulled directly from production, all against SHABZ, spanning 2026-07-21 to 2026-07-26 — one of them 154 messages long, clearly the product of deliberate, sustained real-device testing, including exactly the kind of adversarial probing ("try to confuse it") the observation phase asked for. SHABZ's actual taught configuration (tone, system prompt, business rules, business knowledge) was pulled alongside it, so every finding below could be checked against what was really taught, not assumed. This is real evidence, not scenario fixtures — the adversarial regression suite (`scripts/reply-engine-tests/`) already covers synthetic edge cases; this document is grounded in what an actual person actually experienced.

---

## 3. What the real conversation shows — annotated

A few representative moments, verbatim, with what they reveal:

**The thread-loss moment.** Customer is mid-rebooking, confirms their niece will be home:
> Customer: *"Yes"* (confirming the niece)
> ReplyFlow: *"Hi Rumen! 😊 Yes, we're available today until 17:30. Just let me know if you can be home in the next couple of hours, and we can arrange a visit!"*
> Customer: *"You've got me confused?"*

This is the single most damaging real exchange in the data. The reply doesn't just fail to demonstrate understanding — it demonstrates the opposite, visibly, to the customer, by answering a question nobody asked instead of the one just in front of it.

**The unkept promise.** Customer asks for an earlier slot:
> Customer: *"can you find anything that's more soon"*
> ReplyFlow: *"...I'll get back to you shortly with the next available slot!"*
> Customer, two minutes later: *"You still there what happen ???"*
> ReplyFlow: *"I'm here! Just checking on the next available appointment for you. I'll update you shortly."*

The promised slot is never actually given, anywhere in the rest of this 154-message thread. This is real, live proof of the exact gap named in the prior conversation ("initiative") — not a hypothesis, an observed outcome, complete with the customer visibly chasing it twice.

**The taught-tone mismatch.** SHABZ's stored tone is `professional`. The actual delivered voice, across nearly every message: *"Hi Rumen! 😊"*, *"Awesome thank you"*, *"Haha, I'll make sure to pass that message to Yuri! 🌅"*. Whatever "professional" was supposed to change about how she writes, in practice it changed almost nothing observable. Related: SHABZ taught two real personality facts — *"20+ years experience"* and a *"No fix, no fee"* guarantee — neither of which appears anywhere in 150+ real replies. They sit in the profile; they never become personality in the voice.

**The reflexive greeting.** *"Hi Rumen! 😊"* opens replies deep into an already-established conversation, not just at first contact — directly against document 07's own rule ("skip it entirely mid-conversation... that reflex, more than almost anything else, is what makes a conversation read as generated"). Root cause, found by checking what was actually taught: SHABZ's own `system_prompt` includes the owner's own instruction, *"Always greet the customer warmly."* The owner's teaching and the Voice Standard are in real, unreconciled tension here — nothing today notices or resolves it, so the model tries to satisfy both and the greeting wins almost every time.

**The paraphrase gap.** The deterministic stock-phrase check exists and works — but it matches exact strings. *"If you have any other questions, just let me know!"* and *"feel free to ask!"* appear dozens of times across this one thread and are never caught, because neither is a literal match for the nine phrases on the banned list, even though both are the same idea as the phrases that are. This is the exact gap the Conversation Experience Review flagged as theoretical — here it is, real, and much more frequent in practice than the review guessed.

**What's already working — worth protecting, not just fixing.** *"I can't view images, but if you could describe what you need help with..."*, *"I can't provide the current time or date..."*, *"I can't make calls, but I can help you here..."* — three real moments of a plain, honest, un-defensive "no" to something outside her real capability. No apology spiral, no invented workaround. This is Judgement (`08`) working exactly as designed, and any future change to conversation quality has to be careful not to trade this away for something that sounds warmer but is less honest.

---

## 4. The eight standards

Each of the questions this phase was asked to challenge, answered against the real evidence above — not aspiration.

### Does she acknowledge people naturally?
**Currently: reflexively, not naturally.** The greeting fires on a schedule (a taught instruction), not on a read of whether this moment calls for one. A natural acknowledgement varies with what's actually happening — the real data shows the same opener regardless of whether this is message one or message ninety of the same thread.

### Does she demonstrate understanding before solving?
**Currently: inconsistent, with at least one real, visible failure.** The "You've got me confused?" exchange is direct proof this isn't reliable yet. When it works, it's usually because the answer was structurally simple (a straight fact lookup); it breaks under real conversational complexity — several turns deep, multiple open threads (rebooking, a fee question, a third-party confirmation) at once.

### Does she ask thoughtful follow-up questions?
**Currently: functional, rarely thoughtful.** Every question in the real data is a legitimate, necessary one (postcode, time, confirmation) — never filler. But none of them ever reference the specific thing the customer just said in a way that would prove she was actually listening to the content, not just extracting a slot value from it. Functionally correct, emotionally flat.

### Does she sound like someone who works for this business?
**Currently: no — she sounds like a competent generic assistant, not SHABZ's receptionist specifically.** This is the sharpest, most evidenced finding in this whole document. Real, specific facts were taught — 20+ years of experience, a "no fix, no fee" guarantee, a professional tone — and none of them are audible anywhere in how she actually talks. A customer reading this thread cold would learn almost nothing about SHABZ as a specific business from the *way* the replies are written, only from their literal factual content.

### Does she avoid sounding procedural?
**Currently: not reliably.** The "confirm you'll be home," "confirm access is clear," "confirm the stopcock" sequence — every individual instruction is real and grounded (all genuinely taught), but delivered back-to-back it reads exactly like a checklist being worked through, not a person having a conversation. Being grounded and being procedural are not opposites; this data shows a reply can be both.

### Does she avoid repeating herself?
**Currently: no, measurably.** The exact-match stock-phrase check catches nine specific phrases and none of their equivalents. Real count from one thread: some form of "let me know if you need anything else" appears well over a dozen times in barely-varied phrasing. This is the clearest, most quantifiable finding in the whole document.

### Does every reply reduce effort for the customer?
**Currently: mostly, with one real counterexample class.** Most replies genuinely move things forward with minimal friction. The counterexample is the unkept-promise pattern (§3) — a customer who has to actively chase a promised follow-up is doing *more* work than if they'd simply been told the honest wait, or given an answer immediately instead of a promise to look one up.

### Does every reply increase trust?
**Currently: the honest declines do; the confident-sounding non-answers actively don't.** *"I can't make calls, but I can help you here"* is a trust deposit. *"Your booking for the 29th of July at 4:00 PM is confirmed as long as your niece will be home"* stated with total confidence, seconds after visibly losing the thread of the conversation, is closer to a withdrawal — not because the underlying fact was necessarily wrong, but because confidence delivered right after a visible mistake reads as not having noticed the mistake at all.

---

## 5. The two structural tensions this evidence exposes

Neither of these is solved here — they're named because the evidence makes them impossible to un-see, and because the next phase needs to know they exist before touching the engine.

**Taught instructions can silently override the Voice Standard, and nothing today reconciles the two.** "Always greet the customer warmly" is a completely reasonable thing for an owner to type, and the Voice Standard's "skip it mid-conversation" rule is also completely reasonable. Today, when they conflict, the owner's literal words tend to win, because there's no mechanism that treats the Voice Standard as a floor the owner's own teaching can't accidentally undercut. This is bigger than one phrase — any future personality or teaching work has to answer: when a business's own taught instruction and the baseline Voice Standard pull in different directions, which one is the ceiling and which is the floor?

**"I'll get back to you" is a promise the product cannot currently keep unassisted.** Named already in the last conversation, now with direct, real proof it's not theoretical. A reply that defers an answer needs either (a) to actually contain the answer in the same breath, or (b) an honest acknowledgement that doesn't imply a specific future action ReplyFlow has no mechanism to perform. Today's data shows option (c) happening instead — a confident-sounding promise, followed by nothing, followed by the customer having to chase it.

---

## 6. The Excellence Rubric

The distilled, reusable form of everything above — not a percentage score (Principle 8, `02` §7 both already forbid that), a set of real yes/no questions to hold any future conversation against, in the customer's own likely order of noticing them:

1. **Does the opening line respond to *this* moment, or fire on a schedule?**
2. **Does the very next message prove she read the specific content of the last one, not just its category?**
3. **If she asks a question, could a stranger tell it's about to help her do something specific — not just "sound thorough"?**
4. **Read five consecutive replies in this thread — do any two of them share a load-bearing phrase, even paraphrased?**
5. **Strip the business name out of this thread — could you still tell which real business this is, from how it talks, not just what it says?**
6. **Does any reply promise a future action ReplyFlow cannot actually perform on its own?**
7. **Where she declines or admits a limit, is it plain and short — or does it apologise more than it informs?**
8. **At the moment this conversation ends, would this customer, asked honestly, hesitate before saying "person"?**

A conversation that would embarrass the business if the owner read it back is a failure regardless of how technically correct every individual fact was. That's the standard.

---

## 7. Explicitly out of scope here

No prompt changes, no personality data model, no proactive-messaging capability, no new safety checks — all of that is implementation, and implementation was explicitly deferred until this standard is agreed. The two structural tensions in §5 are flagged, not resolved; resolving them is real, scoped follow-on work once this document is accepted, not a hidden action item smuggled into a "study" document.
