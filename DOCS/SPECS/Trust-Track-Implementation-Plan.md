# Trust Track — Implementation Plan

**What engineering actually needs to exist to build what document 03 already designed.** Document 03 (`DOCS/CONSTITUTION/03-Trust-Experience.md`) fully specifies the experience — what she says, when, and why. This document is the equivalent of the Work Card object definition (`DOCS/SPECS/Work-Card-Object.md`) for Track A: not new design, just what has to be technically true before any of it can be built. Living spec, expected to change as building proceeds.

---

## A1. Handover ("Meet Your Receptionist")

**What it needs that doesn't exist yet:** a generation step that turns real taught data into the recap-then-confirm message from document 03 §2 — "here's what I've understood... have I understood you correctly?"

This is not a new kind of capability. It's the same fact-grounding discipline the reply engine already applies to a customer message (document 06 §1), pointed at a different question: not "what should I tell this customer," but "what do I now know about this business, stated back in plain language." Concretely:

- Reuses the same bounded-facts collection the reply engine already assembles from taught business/receptionist data — no new data source.
- One new, small generation call: given the collected facts, produce the recap sentence(s), citing what was actually taught (the same `facts_used` discipline, not a free paraphrase).
- Needs a "yes / actually, no" response path — a "no" should route back into teaching, not dead-end the flow. This is the one genuinely new interaction, not a new capability.

---

## A2. Test Conversations

**What it needs that doesn't exist yet:** a safe sandbox around the real reply pipeline.

The load-bearing decision: **this must run the actual production pipeline (Understanding → Context → Generate → Safety), not a mock or a simplified stand-in** — otherwise "watch how she'd really handle this" is a lie. The adversarial regression suite (`scripts/reply-engine-tests/`, document 06 §5) already proves this pipeline can be driven this way safely; Test Conversations is the owner-facing version of the same idea.

- Test conversations need to be clearly separated from real ones — tagged, not stored in a parallel system, so they never appear on Front Desk, in Approvals, or in a customer's real history. A test customer identity should follow the same convention already used throughout this project's own testing (the UK's reserved fictional number range) so it's unambiguous at every layer, not just in the UI.
- The reasoning trace ("The Why," document 03 §4) needs a plain-language mapping from fact ids to sentences — a first version of this already exists in the AI Draft Card's fact-source labelling and just needs generalising, not building from scratch.
- Correcting her mid-test needs to write to the *same* real teaching tables the Receptionist page already uses — never a parallel, disposable correction store. This is a data-path decision, not a UI one: get it wrong and "watch her learn" becomes a lie the same way a mocked pipeline would be.
- "Try to break me" (document 03 §4) needs starter prompts across the same categories the Decision Categories table already encodes (document 06 §3) — routine, booking, pricing, emergency, complaint — so the suggestions are testing real decision boundaries, not decorative examples.

---

## A3. Onboarding reorder

**What it needs that doesn't exist yet:** mostly nothing new — this is a sequencing change to existing onboarding steps, once A1 and A2 exist to reorder around. The one new piece: **Approval Mode as an explicit, named stage**, not just the auto-send toggle's current default state — the owner should be told plainly, at this point in onboarding, what's manual today and what becomes available to automate later, rather than discovering that later in Settings.

---

## What this plan deliberately doesn't decide

- The exact UI shape of the Test Conversations sandbox (chat interface, layout, etc.) — that's a screen design, and per the same discipline as Work Cards, the experience (document 03) and the technical requirements (this document) come first.
- Whether Handover happens as a distinct screen/step or inline at the end of teaching — a real design decision for whoever builds A1, not settled here.
