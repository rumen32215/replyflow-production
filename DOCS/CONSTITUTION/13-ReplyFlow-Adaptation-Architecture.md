# 13 — ReplyFlow Adaptation Architecture

**How ReplyFlow notices its own long-term patterns and proposes behaviour change — Brain Loop Stage 9, the last of the nine.** Companion to [10-ReplyFlow-Brain-Architecture.md](10-ReplyFlow-Brain-Architecture.md), [11-ReplyFlow-Trust-Architecture.md](11-ReplyFlow-Trust-Architecture.md) (the ladder Adaptation proposes offers through), and [12-ReplyFlow-Learning-Memory-Architecture.md](12-ReplyFlow-Learning-Memory-Architecture.md) (the confirmed history Adaptation reads).

**Status: approved architecture, not yet implemented (2026-08-02).** Founder-approved across two review rounds. Completes the architectural definition of all nine Brain Loop stages — the last one without a permanent specification. No code exists yet; implementation will be planned separately.

**The Founder Handbook is the authority this document answers to.** Primary source chapters: Ch.02 (*"Earned Autonomy"*, the Trust Ladder), Ch.04 (Brain Loop Stage 9, *"Adapt"*), Ch.05 (*"Adaptation... learning is remembering, adaptation is changing behaviour"*), Ch.06 Principle 9 (*"Learn, Then Adapt"*).

---

## 1. The Permanent Definition

> **Adaptation proposes. The owner decides.**

Adaptation is not a behaviour engine. It is a long-term pattern-recognition system whose only output is a proposal — never an action, never a permission, never a silent default change. Everything below exists to keep that sentence true forever, not just at launch.

A second, equally permanent rule governs every proposal it's allowed to make:

> **Every adaptation proposal must include human-understandable evidence.**

The owner should never wonder why ReplyFlow is suggesting a behavioural change. Expressed plainly, in the owner's own terms — *"You've approved..."*, *"Over the last..."*, *"I've noticed..."* — never a score, a confidence percentage, or an internal metric. **If the explanation would not make sense to the owner, the proposal should not be made.** This is not a presentation requirement layered on afterward — it is a gate on whether Adaptation is allowed to propose at all. An adaptation with no plain-language reason behind it is, by definition, evidence too thin to act on.

---

## 2. How Adaptation Differs From Learning

| | Learning (Stage 8) | Adaptation (Stage 9) |
|---|---|---|
| Reads | One real edit, in the moment | The accumulated, *already-confirmed* history Learning and Trust leave behind |
| Produces | One fact, about the business | One hypothesis, about a pattern in how the business behaves or is treated |
| Confirmation | Per event, available immediately | Only after real volume exists — one instance is never evidence |
| Writes to | Permanent Memory (`business_rules`) | Nothing directly — only ever a proposal, most often through Trust Ladder's own offer mechanism |

Learning is the raw material. Adaptation is what eventually notices the raw material has a shape — and only speaks up once that shape can be explained in a sentence the owner would recognise as true.

---

## 3. What Adaptation May Change, and What It Never Can

**May propose:**
- An offer through the Trust Ladder's own Layer 5 (Authority Linkage, doc 11 — already specified, deliberately unbuilt): *"You've approved 40 bookings in a row without an edit — want me to start booking simple jobs automatically?"*
- How ReplyFlow presents itself — which Observation surfaces next, which teaching topic it suggests — reversible, non-binding, never a fact or a permission.

**Never changes directly, under any volume of evidence:**
- Any Decision Category safety rule (pricing/complaints/emergencies never auto-send — not adaptable, permanently).
- Whether anything actually auto-sends — only the owner's own action inside Granular Authority flips that.
- Business facts — Adaptation reasons about patterns in *confirmed history*, it never invents a new fact to fill a gap the way a Learning proposal interprets one specific edit.
- Anything the owner has already declined or pinned — a Learning proposal marked "Ignore," a Granular Authority category locked to manual, an explicit "never without me." Permanent negative evidence, not a cooldown — Adaptation should become measurably *less* likely to raise something in a space the owner has already closed, never equally likely.
- Tone or personality wholesale — may notice a style pattern, never silently rewrites how ReplyFlow sounds.

---

## 4. Consistency With the Four Standing Principles

- **Trust before autonomy.** Adaptation never grants autonomy — it can only suggest that enough trust exists to make an offer worth considering, through Trust Ladder's own existing ceiling, never around it.
- **Infer to propose. Ask to confirm.** Held to the same standard Learning established, arguably stricter — a pattern across many events is inherently less certain than one specific, human-confirmed edit, and needs more evidence to earn the same confidence, not less.
- **Capability never grants permission.** Even a well-evidenced case for more autonomy doesn't self-execute. The gap between "this could be proposed" and "this is now allowed" never closes on its own.
- **Owner authority always wins.** Every proposal is checked against standing owner instructions first; anything already declined is never re-proposed as if new.

The evidence-explanation rule reinforces all four at once: a proposal the owner can't understand is a proposal the owner can't meaningfully authorise, which is indistinguishable from Adaptation quietly acting on its own judgement — exactly what these four principles exist to prevent.

---

## 5. What Evidence Adaptation Requires

**What it reads:** never raw signals — only *already-confirmed* ones. Learning's `learning.confirmed`/`learning.ignored` events (never raw, unconfirmed edits), and Trust Ladder's own stage crossings (themselves already gated behind a minimum sample size, doc 11 §Layer 2). Adaptation inherits "confirmed facts only" by construction, simply by never being allowed to read anything upstream of confirmation.

**How much is required before proposing:** the one genuinely open question, and the real reason Adaptation stays architecture-only rather than becoming buildable the way Learning Memory's V1 turned out to be. Trust Ladder's own stage thresholds are already named honestly as founder-set defaults, not evidence-calibrated (doc 11 §4) — for a single business. Adaptation's bar is a harder version of the same problem: what pattern, repeated how often, over what period, is real rather than coincidence, needs real volume across real businesses to calibrate without guessing. Not a mechanism problem — propose-then-confirm is safe at any threshold — a calibration problem, and this project has consistently refused to calibrate without evidence.

**The explanation requirement is itself a second, independent bar**, not a rephrasing of the first: evidence can be statistically real and still fail to produce a sentence an owner would find obviously true. Both bars must clear before a proposal is made — enough confirmed history, *and* a plain-language reason built directly from it, never a summary of a hidden calculation.

---

## 6. How This Stays Predictable Across Years

By keeping the mechanism fixed forever while only the quality and relevance of its proposals improve. Ch.02: *"the owner remains in control at every stage"* describes the permanent shape of the relationship, not a phase ReplyFlow graduates out of. A business using ReplyFlow for five years should see better, more specific, more plainly-reasoned offers over time — because the confirmed history behind them is richer — never a system that starts acting on its own initiative because enough time has passed. Predictability is only at risk if Adaptation is ever allowed to act instead of propose, or to propose something it cannot explain — both of which this architecture forecloses categorically, as permanent boundaries, not current limitations awaiting relaxation.

---

## Keeping this document honest

This is the permanent specification for the last of the nine Brain Loop stages, not a living implementation log. When Adaptation V1 actually gets built, update `10-ReplyFlow-Brain-Architecture.md`'s own status table (Stage 9's row) to point here and mark what's real. If implementation finds a case this architecture doesn't handle cleanly — an evidence threshold that can't be stated in one calibration-free rule, an explanation that technically clears the bar but still reads as opaque — correct this document in the same commit rather than letting code and specification drift, the same discipline docs 10, 11, and 12 already hold themselves to.
