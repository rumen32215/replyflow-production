# 15 — ReplyFlow Onboarding Experience Architecture

**How hiring a receptionist should feel, minute by minute, and why.** Companion to [04-Trust-Experience.md](04-Trust-Experience.md) and [16-ReplyFlow-Employment-Philosophy.md](16-ReplyFlow-Employment-Philosophy.md) (frozen, permanent — every decision below exists to satisfy it). Made concrete by `DOCS/SPECS/ReplyFlow-Onboarding-Implementation-Architecture.md`.

**Status: locked (2026-08-05), V21.6.** This document has now been rewritten five times in one day, each time in response to a live founder review of the previous version. That process is the reason to trust this version rather than a reason to doubt it — every structural idea below survived being tested against something built, or against a sharper question, before making it in. The founder's own words on this pass: *"I think we've found the experience."* No further experience-vision revisions are expected; the next document is the implementation architecture, not another vision.

---

## 0. The governing law

> **The owner should never feel like they are configuring software. They should feel like they are teaching someone who is genuinely learning their business, and who occasionally shows them something about that business they hadn't noticed themselves.**

Five consequences, each the result of a real, tested correction to an earlier draft:

- **One continuous encounter, never a route per question** (survived from V20's own hard-won reversal — see that revision's own §2).
- **Behaviour is the proof; visual effects are only ever its readout.** A version of this document briefly proposed a shadow-halo-icon visual system as the primary signal of growing understanding. It was correct in spirit and wrong in mechanism — tested against the founder's own standard (*"if all animations were disabled, the onboarding should still feel intelligent"*) it failed, because the intelligence lived in the graphics, not the words. It doesn't anymore. The only visual thread left in this design is pacing itself — see §3.
- **It sounds like a learner, never a library.** An early pass had the receptionist cite aggregate patterns across "electricians round your size." Correct-sounding, wrong feeling — it reads as the owner being classified against other businesses rather than understood as one. Every reasoned guess in the final design draws only on what's been said in this specific conversation.
- **Reciprocal learning.** The single addition that closed this document: every answer must teach the receptionist something *and* teach the owner something about the receptionist in return — not just "fact received," but "here's what I'll actually do differently now." Doc 16 §4.2 already required reflecting facts back; this is that requirement pushed all the way to its logical end, every single time, not just once.
- **No hardcoded pronoun** (doc 16 §3.14) — first person or by name, throughout.

---

## 1. The five real facts, and nothing that isn't earned

Business name, trade, whether the work is mostly domestic or commercial, service area, opening hours. Every question beyond the first two now has to pass a specific test before it's allowed in this document at all: ***would ReplyFlow be meaningfully worse at the job without it?*** Domestic/commercial passes because it changes tone and quoting language, not because it's interesting. An earlier draft included a separate "what kind of business are you" impression-check purely for rapport; it was cut on this exact test — it never changed what ReplyFlow could actually do, so it didn't belong. Its instinct survives inside the discovery moment instead (§4), where it now does real work.

---

## 2. The recognisable habit

Once, and only once, per fact where ReplyFlow is genuinely inferring rather than recognising, it asks permission before assuming — in different words each time, but doing the same thing every time: *"Can I check my thinking?"*, *"Tell me if I'm getting this wrong—"*, *"Mind if I guess?"* The wording varies deliberately; the behaviour never does. Three uses inside a two-minute encounter is enough for the pattern to be felt without being repeated identically — the target is recognisable, not scripted.

---

## 3. Pacing is the only visual language left, and it means something specific

Research on conversational pacing changed a real decision here (full citations in the implementation doc): near-instant responses read as false certainty, not competence, and long silences past a few seconds flip from "thinking" to "avoidance." Every pause in this design is short and means one specific thing:

- **No pause** — recognition. Tapping a trade card, a fact requiring no reasoning.
- **A short pause** (well under a second) — a simple acknowledgment that still required registering what was said.
- **A held pause** (one to two seconds) — a genuine inference being formed, not looked up.
- **The one long pause in the whole encounter** (two to three seconds, never longer) — reserved entirely for the discovery moment, §4. Spent anywhere else, it stops meaning anything.

---

## 4. The discovery moment — the emotional peak, and why it differs by trade

Once, near the end, ReplyFlow connects two facts the owner gave separately, for separate reasons, into something neither answer said on its own — and it's something the owner hadn't put together themselves. Not a magic trick, not a claimed capability: careful attention, stated plainly, with the permission-asking habit from §2 attached, since it's still a guess about what the owner would want, not an announcement.

This document initially illustrated this moment with one example — a plumber-shaped "a burst pipe doesn't wait" insight — and treated it as a template. It isn't one. Forcing an urgency-shaped discovery onto a trade whose real work doesn't have that shape would be exactly the kind of invented understanding doc 16 exists to prevent. Checked against all five trades, only three genuinely share that shape:

- **Plumbing, electrical, roofing** — each has a real, honest version of "most of this can wait till morning, but not all of it," because burst pipes, dead power, and active leaks are all genuinely time-sensitive in a way routine work isn't.
- **Building, painting & decorating** — neither has that shape honestly. Their real discoveries are different in kind: building work is booked in advance, so the honest discovery is about setting that expectation upfront rather than triaging urgency; decorating work happens inside someone's home, so the honest discovery is about access and disruption, not urgency.

Exact content for all five, and what each produces technically, is in the implementation doc §2.

---

## 5. The ending is momentum, not a status

*"I think I've got a real picture of you now."* — then straight into a real invitation, not an announcement: something closer to *"send me something a customer would actually send"* than to *"I'm ready."* The owner is never shown a moment where onboarding ends and the product begins, because there isn't one — the same voice, same pacing rules, same recognisable habit, continues directly into the first real message. This is why doc 16's "no reset" implication (§9 of the implementation doc) is now a confirmed requirement, not an open question: the receptionist met during this encounter has to be the same one the owner meets on Meet Your Receptionist, not a second, different-feeling instance of the same idea.

---

## 6. Concepts this document introduces

- **Reciprocal learning as the closing principle** (§0) — the mechanism that finally made the difference between "I'm being classified" and "I'm teaching someone."
- **Pacing as the sole remaining visual language, with each duration meaning one specific thing** (§3) — replaces every earlier proposal involving shadows, halos, or icon changes.
- **The discovery moment, honestly differentiated per trade rather than templated from one example** (§4) — the single biggest content-accuracy risk in this design, named explicitly so it can't be quietly skipped during implementation.
- **No ending, only continuation** (§5) — the literal architectural consequence of "no reset."

---

## 7. How to use this document

Before adding anything, ask whether it teaches the owner something about the receptionist in return for what it just learned (§0's reciprocal-learning test), and whether it would survive having every animation switched off. If either answer is no, it doesn't belong here yet, however good it looks.
