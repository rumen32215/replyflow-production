# 02 — Conversation Philosophy

**How the receptionist thinks, decides, and speaks.** This document synthesises four separate design sprints (`DOCS/BUILD/05` Reply Engine Architecture, `06` Understanding Engine Architecture, `07` Voice, `08` Judgement) into one coherent account, and resolves a terminology tension between them that was never previously written down in one place. The full historical depth and reasoning behind each part still lives in the archive — this is the consolidated, current answer, not a replacement for that depth.

---

## The pipeline, in one sentence per stage

**Understand → Assemble → Judge → Generate → Verify.**

1. **Understand** — a small, cheap model call classifies what a message actually wants (`06`), extracts real entities deterministically where possible, and decides how much context this specific message actually needs — never everything, never nothing.
2. **Assemble** — deterministic code gathers exactly the facts Understanding asked for: bounded business facts (sent in full, they're small), unbounded history and customer memory (windowed, never sent whole) (`05`).
3. **Judge** — a deterministic table, not a model guess, decides which category this falls into and what confidence bar it has to clear before anything could ever be automatic (`06`, and see document 06 of this folder for how this plays out in practice).
4. **Generate** — the one point a larger model call actually writes the reply, following the Receptionist Writing Standard (`07`).
5. **Verify** — deterministic safety checks run against the draft before it goes anywhere: does it cite real facts, does it overclaim, does it match the confidence and escalation rules Judge already decided.

The discipline underneath every stage: **retrieval and safety are code; only the sentence itself is ever delegated to a model.** The model proposes. Deterministic code decides. This is Principle 7 (document 01), and it's the single idea everything below elaborates on.

---

## Three things that sound alike and are not the same thing

This is the terminology tension this document exists to resolve. Three different "what stage is this" concepts exist in the real system, built at different times, answering genuinely different questions — conflating any two of them is the single most likely way a future engineer misreads this codebase.

| Concept | Question it answers | Scope | Where it lives |
|---|---|---|---|
| **Intent** | What does *this message* want? | Per-message, re-evaluated fresh every time | The Understanding Engine's classification (`06`) — twelve categories, e.g. `BOOKING_REQUEST`, `EMERGENCY`, `COMPLAINT` |
| **Stage** | Where is *this conversation* in reaching its outcome? | Per-conversation, carried forward, never re-evaluated from scratch | Conversation State (see below) — `understand → diagnose → collect → quote_or_book → confirm → waiting → completed → closed` |
| **Goal** | What is *the customer* fundamentally here for? | Per-conversation, more stable than Stage — a side-question doesn't change it | Conversation State — `book_appointment`, `get_pricing`, `make_complaint`, and similar |

A single conversation might see Intent shift message to message (a booking enquiry, then a `PRICING_INQUIRY` aside, then back to booking) while Goal stays `book_appointment` throughout and Stage advances once, from `collect` to `quote_or_book`, without ever moving backwards. All three are real, all three are necessary, and none of them should ever be used as a stand-in for one of the others.

---

## Conversation State — the architecture `05` and `06` didn't yet know it needed

Documents `05` and `06` designed a system that re-read a windowed slice of raw conversation history every turn and asked the model to infer everything from it — where the conversation was, what had already been asked, what was already known. Live testing later showed exactly what that document's own "think beyond prompts" section predicted it would: repeated greetings, re-asked questions, and facts that quietly drifted. A fact the model has to infer from scratch every turn is a fact it will eventually get wrong, at scale.

The fix, built afterward and never previously consolidated into a design document until now: **a persisted Conversation State**, carried forward turn by turn rather than re-derived, holding:

- **Stage** and **Goal** (above)
- **Slots** — a small, fixed set of collected values (issue, location, preferred time, customer name)
- **Open question** — exactly what's currently being waited on, corrected *after* generation runs (the pre-generation guess and the actual written reply can disagree; the reply is always the authoritative source)
- **Commitments** — an append-and-update ledger of facts and questions that don't fit the four fixed slots ("niece will be home," "already asked about the call-out fee"), each tracked outstanding → resolved
- **Greeting given** and **last topic** — small deterministic guards against re-greeting and topic loss

This is computed by extending the Understanding Engine's existing classification call, not by adding a new one — the same "small, cheap call, not a duplicate of generation" discipline `06` already argued for. Everything in this section is real, shipped, and adversarially tested; it simply predates this consolidated document by several sprints.

---

## Judgement — how she decides (from `08`)

Judgement is a temperament, not a checklist: cautious about commitments, confident about facts; treats the owner's attention as the scarcest resource she has; more afraid of a confident mistake than an honest "I'm not sure"; never mistakes activity for helpfulness. Seven concrete questions this temperament answers:

**Interrupt the owner?** Rarely, earned — real danger, genuine complaints, money decisions that aren't hers, anything she's honestly unsure about. **Solve it herself?** Whenever the answer is fully knowable and routine — the bulk of a real day. **Wait?** When she doesn't have an answer yet, rather than inventing one to fill silence. **Proactively follow up?** The one capability described here that doesn't exist yet — ReplyFlow only ever responds today. **Collect information without asking?** Whenever the customer already said it — never ask twice. **Admit uncertainty?** Whenever the honest answer is "I don't know," stated plainly, no apology longer than the admission. **Deliberately do nothing?** Whenever a conversation has genuinely finished — silence is a decision, not a gap.

The test for all seven: *would a genuinely experienced human receptionist make this exact call, under normal time pressure?*

---

## Voice — how she speaks (from `07`)

Plainspoken, warm-but-efficient — a competent person texting between jobs, never an email. Contractions always. One short sentence is the default; two only when there's a real reason; three or more only for genuine complexity or an emergency. She greets when greeted first or genuinely opening a thread, never every message. She never asks something already answered. Repetition is tracked and avoided, not just discouraged — see the phrase-memory mechanism below. Emojis are rare enough that most replies have none. And the single biggest tell separating her from a chatbot: **she stops talking the moment the immediate need is met.** A forced sign-off, tacked on by reflex, is exactly what a real person doesn't do.

Two mechanisms make this reliable rather than aspirational: a deterministic scan of the conversation for stock phrases already used (so "don't repeat yourself" is a fact she's given, not a request she might ignore), and a deterministic silence override for exact-match acknowledgements ("ok," "cheers," "thanks so much") when nothing is genuinely outstanding — added after live testing showed the model's own judgement, while usually right, wasn't reliable enough on its own for that one narrow, high-value guarantee. Consistent with Principle 7: wherever a guarantee actually matters, a rule owns it.

---

## What's designed but still open

- **Business Personality** (`07` §4) — a genuine architecture recommendation, not yet implemented. The current tone setting is a flat enum; a real personality system (distinct sentence-length ceilings, greeting frequency, question style per business) needs a richer data shape that doesn't exist yet. Flagged here, not solved — see document 07 of this folder for where it sits in priority.
- **The correction/learning loop** (`05` §7) — designed in detail, never built. `recordCorrection()` and `recordOutcome()` remain unimplemented; there is no `reply_outcomes` or `reply_corrections` table. This is the "Improve" stage of the Learn → Work → Escalate → Improve loop (document 00), and it's currently the least mature part of the whole pipeline. See document 06 of this folder.
