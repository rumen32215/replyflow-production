# Conversation Experience Review

**Study only — no code changed for this document.** Scope, per the owner's direct instruction: the conversation itself is the product. Not the UI, not new systems — the actual Reply Engine pipeline (`lib/reply-engine/`), the Voice and Judgement philosophy already frozen in `DOCS/BUILD/07` and `08`, and what a real customer would actually read on WhatsApp.

## 0. Starting point: this is a stronger foundation than it might feel like from a phone

Before any findings, one thing worth being honest about, because it changes how the findings below should be read: ReplyFlow's Reply Engine is not a thin prompt wrapper. Reading `lib/reply-engine/prompt/build.ts`, `facts.ts`, `understanding/classify.ts`, and `safety/evaluate.ts` in full turned up a genuinely mature pipeline, already carrying fixes for real problems found in prior live testing:

- Conversation **stage, goal, and a commitments ledger** are carried forward turn-by-turn as explicit facts (never re-derived from raw history) — this is exactly the "stage tracking should become structural, not inferred" fix that `07_Receptionist_Personality_and_Conversation_Architecture.md` §5 called for, and it's live.
- A **deterministic phrase-repetition check** (`detectUsedStockPhrases` in `facts.ts`) scans real outbound history for nine banned stock phrases and feeds back exactly which ones are already used — the same doc's other §5 recommendation, also live.
- The **Safety Layer** (`safety/evaluate.ts`) has real, specific, comment-documented fixes for booking-overclaim, reschedule-overclaim, uncited price/instruction claims, and a payment-question fact-grounding gap — each one clearly the product of a real bug found in testing, not a hypothetical.
- **Judgement** (`08_Receptionist_Judgement.md`) — caution about commitments, honest uncertainty, escalation of anything genuinely serious — is already how the safety layer actually behaves, not aspirational.

So the honest framing for what follows: this isn't a pipeline with foundational gaps. It's a pipeline where the *correctness* work is largely done, and the remaining distance to "the best digital receptionist for tradespeople, not a chatbot" is concentrated in a small number of specific, addressable places. Findings are ordered by impact, highest first.

---

## 1. The single highest-impact gap: personality is one adjective, not a person

This is the one already-diagnosed-but-unbuilt gap, and it's very likely the biggest lever available.

`ai_configurations.tone` is a flat three-value enum (`friendly` / `professional` / `concise`). The live prompt (`build.ts:49`) passes it to the model as one line: `Tone: professional.` That's the entire personality specification the generation model receives. Everything else — sentence length, how often she greets, how she asks a question, whether she reflects back what she heard — is left to the model's own judgement, undifferentiated across every business regardless of what tone was picked.

`07_Receptionist_Personality_and_Conversation_Architecture.md` §4 diagnosed this exactly, a document that appears to predate the current pipeline: personality needs to be **structurally different values across concrete axes** (default sentence length, greeting frequency, emoji ceiling, acknowledgement style, question style, closing style) — not a single adjective the model has to reinterpret consistently every time. The doc's own worked table (§4) is still accurate to today's code; nothing in the current `tone` column or prompt has superseded it.

Why this matters more than any other single finding: this is very plausibly *the* thing that makes two businesses on different tones still read as "the same underlying chatbot wearing a different word." A Quick & Direct plumber and a Warm & Reassuring boiler-care business should not just use different adjectives — a customer reading both threads side by side shouldn't be able to tell they're the same software. Today they can.

This is a real scope decision, not a copy tweak — flagging it as the top priority for a **future, explicitly scoped** piece of work, not something to fold into this review's "highest-impact, low-risk" bucket below (a genuinely new data shape and onboarding change is exactly the kind of "large new system" the owner asked this review to *identify*, not implement).

---

## 2. Repetitive replies

**Already meaningfully handled — check the ceiling, not the mechanism.** The deterministic stock-phrase check is a good, cheap, correctly-engineered fix, and it's live. The gap that remains is narrower than "no repetition handling exists": the banned list is nine fixed, exact phrases ("let me know if you need anything else", "no problem at all", etc.) matched as literal substrings. It won't catch a paraphrase of the same idea ("just shout if you need anything" the second time), or the same *acknowledgement pattern* recurring with different words each time. This is a small, cheap extension of a system that already works — not a new mechanism — if it turns out to matter in real usage. Given real Test Conversations / pilot feedback hasn't surfaced this specifically yet, it's worth watching rather than acting on pre-emptively.

## 3. Replies exposing implementation details / staying in character

**No evidence of a real leak, and the design actively prevents one.** `lib/reply-engine/send.ts` confirms only the generated `draft_reply` text ever reaches the real WhatsApp API — no intent labels, confidence scores, or fact ids are ever in the outbound payload. The system prompt explicitly instructs against narrating internal process ("let me check that for you" is explicitly forbidden) and against ever claiming to be an AI unless directly asked. If this was observed in practice, it's more likely the model occasionally narrating its own reasoning in-character ("checking my diary...") rather than a literal data leak — worth a specific example if this comes up again in testing, since nothing in the current instructions permits it and nothing in the pipeline structurally causes it.

## 4. Workflow-feeling vs. natural-conversation-feeling

The structural side of this (stage never moving backwards, never re-asking, always carrying forward what's already known) is genuinely well solved — `08_Receptionist_Judgement.md`'s "collect information without asking" section is live behaviour, not aspiration. Where this most plausibly still shows through: a diagnostic sequence (issue → postcode → time) can still read as a form being filled in one field at a time, purely because each answer is followed immediately by the next question with nothing in between. See §6 below — this is the same gap as "demonstrating understanding," just viewed from a different angle, and the fix is the same one.

## 5. Follow-up question thoughtfulness

The Writing Standard already enforces "one meaningful question, serving Diagnose/Quote/Book/Escalate/Close only" — this is a real, correctly-scoped constraint and it shows in the doc's own before/after examples. The remaining opportunity isn't asking *fewer* or *better-targeted* questions (already handled) — it's making the question feel like it followed from genuinely listening to the specific answer just given, rather than the next slot in a fixed sequence. Concretely: doc 07's own worked radiator example goes straight from "cold at the top, warm at the bottom" to "can I get your postcode" with nothing in between acknowledging what that answer actually meant. See §6.

## 6. Demonstrating understanding instead of simply answering — the second highest-impact, low-risk fix

This is the most concrete, addressable finding in this review, and it's genuinely small.

The current system prompt (`build.ts`) is entirely, correctly optimised for brevity and never padding — that's right, and shouldn't change. But there's no instruction anywhere encouraging the one thing that would make understanding *visible* without adding filler: briefly reflecting back what a diagnostic answer actually meant, before moving on. Doc 07's own worked example shows the gap directly — after "cold at the top, warm at the bottom," a genuinely good receptionist would think out loud for half a sentence ("Sounds like trapped air") before asking for the postcode, not because it's required information, but because it's the one-clause proof that she actually understood the specific thing just described, not just extracted a slot value from it.

This is different from padding (which the Writing Standard correctly forbids) because it's not decorative — it's information the customer didn't have before (a read on their actual problem), delivered in the same breath as moving the conversation forward, not as a separate sentence. A single added instruction along these lines — *"when a diagnostic answer genuinely reveals something (a likely cause, a specific implication), say so in one short clause before asking the next thing — this is not filler, it's proof you understood, so only do it when the diagnosis itself was actually informative, never as a habit"* — would address §4, §5, and §6 together with one small, low-risk prompt addition, not a new system.

## 7. Waiting messages could feel more human — a concrete, currently-missing lever

`lib/whatsapp/graph.ts` has no read-receipt or typing-indicator call anywhere. Right now a real customer's message sits at "delivered" (grey ticks) with zero acknowledgement from ReplyFlow until the actual reply text arrives — which, given the current manual-approval flow (every reply, even confident ones, waits for the owner to approve before sending), could genuinely be minutes. WhatsApp's Cloud API supports marking a message read (blue ticks) with a single call, and — since late 2024 — an optional typing-indicator alongside it. This is the single most concrete, structurally-simple fix available for "waiting feels more human": a real customer seeing their message marked read within moments already signals "someone's there" long before the reply itself is ready, at essentially zero product risk (it's a passive signal, not a claim about anything).

Worth flagging honestly: a typing indicator specifically implies "someone is actively typing right now," which wouldn't be strictly true while a reply is sitting in an approval queue — the read receipt alone is the safer, still-meaningful half of this to consider first.

## 8. Confidence and trust — already a strength, not a gap

`ConfidenceTag` (Confident / Fairly sure / Worth a check) and `factSourceSummary` (grouping cited fact ids into a plain-language "based on your diary and your pricing" line) are already exactly the right shape: honest, non-technical, never a raw percentage — consistent with the Constitution's explicit ban on percentage-based confidence display. This is a real strength worth protecting, not changing. The only opportunity here is consistency: making sure this same honest signal appears everywhere a draft is shown to the owner (Conversations, Test Conversations, anywhere else a draft surfaces), never just in one place — worth a quick audit, not a new mechanism.

---

## Summary — highest-impact, lowest-risk, in order

1. **Reflect back understanding on informative diagnostic answers** (§6) — one small, targeted system-prompt addition. Addresses "workflow-feeling," "follow-up question thoughtfulness," and "demonstrating understanding" simultaneously. Lowest risk, likely highest immediate feel-improvement of anything in this review.
2. **Mark customer messages as read on receipt** (§7) — one new, narrow Graph API call. Directly addresses "waiting messages could feel more human," at essentially zero product risk.
3. **Personality as structured axes, not a flat tone enum** (§1) — the single biggest lever long-term, but a real scope decision (new data shape, onboarding change) that deserves its own explicitly-scoped design pass, not a fold-in here. Flagged as the clear next priority once ready to take on a real, bounded piece of new work.

Everything else in the original seven study questions (repetitive replies, character consistency, confidence/trust) came back either already well-handled or without concrete evidence of a real gap — noted honestly above rather than invented to fill out the list.
