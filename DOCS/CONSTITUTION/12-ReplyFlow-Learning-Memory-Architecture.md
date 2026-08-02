# 12 — ReplyFlow Learning Memory Architecture

**How ReplyFlow turns a real correction into durable business knowledge — Brain Loop Stage 8.** Companion to [10-ReplyFlow-Brain-Architecture.md](10-ReplyFlow-Brain-Architecture.md) (which names Learn/Adapt as the two remaining Brain Loop gaps) and [11-ReplyFlow-Trust-Architecture.md](11-ReplyFlow-Trust-Architecture.md) (which reads the same underlying signal this document writes).

**Status: V1 implemented (2026-08-02).** Founder-approved across three review rounds, then built end to end the same day: `lib/brain/learning.ts` (the deterministic gate), `lib/reply-engine/learning/propose-lesson.ts` (the scoped, hedged LLM proposal), `lib/reply-engine/learning/detect-and-propose.ts` (orchestration, wired into `app/api/reply-drafts/[id]/route.ts`'s edit action), `learning_proposals` (migration 0022), `app/api/learning-proposals/[id]/route.ts` (the four-outcome resolution route), and `components/dashboard/receptionist/learning-proposal-card.tsx` (the owner-facing card). Verified end to end against production with a real fixture. Check `10-ReplyFlow-Brain-Architecture.md`'s own status table for the full picture across all nine Brain Loop stages.

**The Founder Handbook is the authority this document answers to.** Primary source chapters: Ch.03 (*"Learning From Every Gap"*), Ch.04 (Brain Loop Stage 8, *"Learn"*), Ch.05 (*"Learning Through Correction"*), Ch.06 Principle 9 (*"Learn, Then Adapt"*).

---

## 1. What Learning Means Here

The Handbook never asks ReplyFlow to remember what was typed. Ch.05: *"the same mistake should become less likely next time."* A mistake is a behavioural fact, not a sentence — wording is disposable, the business fact underneath it is what's worth keeping.

That produces the permanent governing principle:

> **Infer to propose. Ask to confirm.**

ReplyFlow may intelligently propose what it believes it has learned. It must never treat that proposal as fact until the owner confirms it. Inference is allowed at the proposal stage; autonomy is never allowed at the decision stage.

A second, equally permanent requirement governs *how* that proposal is expressed: **always with appropriate uncertainty.** *"I think you might be teaching me..."*, *"It looks like..."* — never a statement that implies certainty. ReplyFlow should feel like it is learning from an expert, never correcting one. This is not phrasing polish; it's the same "never pretend" law (Ch.03) applied to ReplyFlow's own confidence about its own guesses.

---

## 2. The Six Questions

### 2.1 What constitutes a learning opportunity?

A confirmed edit — the same `draft.edited` signal already in `product_events`, already read by the Trust Ladder — that clears one deterministic, no-AI gate: the edit changed enough to plausibly carry a fact, not just a word. A trivial diff (punctuation, one word, a tone-only rephrase) never becomes a candidate. This gate is mechanical, the same "confirmed facts, not predictions" discipline the Organise Checkpoint and Trust Ladder already run on — *deciding something is worth looking at* never itself requires a guess. Clearing the gate makes something a **candidate**, not a lesson.

### 2.2 How does ReplyFlow propose a behavioural lesson?

One scoped LLM call — the deliberate, named exception to this project's "no new AI calls" pattern, because this task is different in kind from the surfacing work that pattern was written for. Given the original draft, the owner's edit, and the real category/customer-message context (the same fact-grounding discipline `generateReplyDraft` already applies — never the full unrelated conversation history), the call produces one short, hedged hypothesis: *"It looks like you do emergency callouts but charge extra after 6pm — is that right?"* Explicitly a guess with a name on it, never written anywhere durable until a human says yes.

### 2.3 Where should the confirmation appear?

Not as an interrupt inside the conversation view, immediately after the edit — Ch.03: *"a perfect receptionist does not interrupt every five minutes."* Instead, the same Observation mechanism the Organise Checkpoint already uses: capped to one thing at a time, surfaced on the Receptionist page, where teaching already happens and the owner is already in a "teach me" frame of mind. A new observation source competing for the same single slot Organise gaps and worries already share — reuse, not a new interruption pattern.

### 2.4 How do confirmed learnings become Business Brain knowledge?

Written straight into the same field the Receptionist teaching page already writes to — `ai_configurations.business_rules` — with the confirmed sentence exactly as shown when the owner said yes. This already flows into `assembleContext`/`buildPrompt` on every real reply: **a confirmed learning changes what the receptionist says on the very next message, with zero new reply-engine code.** No new memory type, no new table for the fact itself — the Business Brain stays at four types.

### 2.5 How are one-off edits distinguished from durable business behaviour?

By the owner, never by ReplyFlow — the reason a single yes/no was insufficient. **Four confirmation outcomes**, not two or three:

- **Learn this behaviour** — written to Permanent Memory as above.
- **Ignore** — nothing written. Still recorded (§2.6) so this exact candidate is never re-proposed; an explicit "no" is real evidence too.
- **Clarify what I should learn** — the owner types the correction themselves, in the same free-text pattern already used throughout teaching. Their own words are trusted directly — a human's explicit clarification is a confirmed fact, needing no second round of interpretation.
- **Remind me later** — the candidate is deferred, not discarded and not learned. It returns to the observation pool and may surface again on a future visit (never repeatedly within the same sitting — respecting attention, per Ch.03, is exactly what this fourth outcome exists to protect). Matches the product's standing philosophy better than forcing a decision now: postponing is a legitimate, permanent owner choice, not a missing feature.

A situational, one-off exception the owner makes for one customer is exactly what "Ignore" is for — the architecture doesn't need to detect that itself, only make declining, deferring, and correcting all equally easy.

### 2.6 How does this prepare for Stage 9 (Adaptation) without building it?

Every outcome — proposed, confirmed, ignored, clarified, deferred — is recorded through the existing `recordProductEvent()` chokepoint (new event types: `learning.proposed` / `learning.confirmed` / `learning.ignored` / `learning.clarified` / `learning.deferred`). No new table. This durable history is the raw material real Adaptation would eventually need — a genuine pattern only becomes visible once real volume exists across real time. Learning Memory's job stops at recording that history honestly; noticing a pattern in it and proactively changing behaviour is Adaptation's job, deliberately not built here, gated on the same real-evidence standard as everything else this product defers to pilots.

---

## 3. Relationships

**→ The Brain (Ch.04).** Fills Brain Loop Stage 8 exactly where the loop already expects it — after Act, alongside Organise. No new stage, no reordering.

**→ Business Brain.** Writes only to existing Permanent Memory (`business_rules`). Reader and writer of the four existing types, never a fifth — the same discipline the Trust Ladder was held to.

**→ Trust Ladder.** Shares its raw signal (`draft.edited` via `product_events`) without duplicating collection — Trust Ladder asks "how often," Learning Memory asks "what." Same event stream, two independent readers.

**→ Business Understanding.** A confirmed learning is new taught content, but the current gap/topic system is binary ("is `business_rules` non-empty," not "how rich is it") — stated honestly rather than overclaimed: Learning Memory deepens Business Understanding's substance in a way the existing gap tracker won't yet visibly reflect. A known limitation, not a blocker.

**→ The Receptionist.** Never touched directly. Every behaviour change happens because the existing generation pipeline already reads the field this writes to.

**→ Adaptation (Stage 9).** The dependency this whole design deliberately builds toward without building it — §2.6.

---

## 4. Deterministic vs. AI-Assisted, Stated Plainly

| Step | Mechanism |
|---|---|
| Deciding something is a candidate at all | Deterministic — a string-diff threshold, no AI |
| Proposing what the lesson might be | One scoped LLM call, always hedged ("I think...", "It looks like...") — a hypothesis, never auto-applied |
| Deciding whether it's real, durable business behaviour | The owner, always, via one of four outcomes — never inferred |
| Deferring a decision | A first-class outcome (Remind me later), not a forced yes/no |
| Writing a confirmed learning into memory | Deterministic — exact confirmed text, no paraphrasing |
| Detecting patterns across many learnings | Not built here — Stage 9, later, pilot-gated |

---

## 5. Future Consideration — Explicitly Not V1

Confirmed learnings may eventually benefit from lightweight provenance (confirmation date, category, origin — was this taught directly or learned from a correction?) while continuing to feed the same `business_rules` field. Named here so a future implementation doesn't have to rediscover the idea, and deliberately **not required for V1** — adding provenance tracking now would complicate the initial implementation for a benefit that only matters once there's real learning history to distinguish. V1 writes the confirmed fact; provenance, if ever needed, is additive metadata layered on later without changing where the fact lives or how it's read.

---

## Keeping this document honest

This is the permanent specification, not a living implementation log. When Learning Memory V1 actually gets built, update `10-ReplyFlow-Brain-Architecture.md`'s own status table (Stage 8's row, and the Business Brain memory table's Learning row) to point here and mark what's real. If implementation finds a case this architecture doesn't handle cleanly, correct this document in the same commit rather than letting code and specification drift — the same discipline doc 10 and doc 11 already hold themselves to.
