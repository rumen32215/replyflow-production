# ReplyFlow Constitution Compliance Roadmap

**Every change required to bring ReplyFlow into full alignment with `DOCS/CONSTITUTION/00-Founder-Constitution.md` before launch.** Companion to `ReplyFlow-Constitution-Compliance-Audit.md`, which found and justified each item below — this document turns those findings into a sequenced, actionable list. Nothing here is implemented. Ordered by dependency and by how directly each item blocks a specific Constitution promise from being keepable, not by difficulty.

Format follows `08-Implementation-Roadmap.md`'s own convention: why it exists, which Constitution commitment it serves, what it depends on, what it unlocks.

---

## How to read this roadmap

Four tiers — **Critical → High → Medium → Low** — matching the Audit's own priority order. Critical items are not "important features." They're the specific gaps that mean a Constitution promise is currently unkeepable, not just imperfect. Nothing below this line should be scoped ahead of Critical without a real reason, the same discipline `08-Implementation-Roadmap.md` already established for the rest of the product.

---

## Critical — the Constitution's promises are currently unkeepable without these

### C1. Usage and cost tracking
**Why it exists:** every other item on this list — pricing, reliability guarantees, cost ceilings, even knowing whether the business itself is viable — depends on knowing what a real message actually costs. Today this data is returned by every OpenAI call and discarded every time.
**Constitution served:** *"Build for reliability before intelligence."* Reliability requires knowing your own limits; right now nothing does.
**Depends on:** nothing. The one genuinely foundational item on this entire roadmap.
**Unlocks:** C2, C3, H1 (billing), and any future pricing decision made on evidence rather than guesswork.

### C2. Fix the onboarding demo's uncapped repeated-call bug, add basic rate limiting
**Why it exists:** confirmed, quantified, current financial exposure — every visit or retry of the "Setting up your receptionist" screen fires 8 real OpenAI calls with zero guard against repetition, and no endpoint in the product has any rate limit at all.
**Constitution served:** *"Never sacrifice trust for novelty."* An uncapped cost bug is the opposite of the reliability the Constitution asks for, regardless of how good the screen it lives on looks.
**Depends on:** nothing structurally; benefits from C1 existing first to confirm the fix actually worked.
**Unlocks:** a genuine cost ceiling becomes enforceable, which nothing supports today.

### C3. Monitoring and alerting for the two most likely real failure modes
**Why it exists:** a WhatsApp connection silently breaking, or OpenAI errors spiking, would currently be discovered by the owner noticing missed customers — not by ReplyFlow. This is the most direct, literal violation of the Constitution's own Product Promise found in this audit.
**Constitution served:** *"ReplyFlow will never leave a business owner wondering whether their business is being looked after."* Currently, ReplyFlow wouldn't know either.
**Depends on:** nothing structurally. Genuinely overdue.
**Unlocks:** the ability to honestly claim the Product Promise is being kept, not just written down.

### C4. A real, monitored support channel
**Why it exists:** zero support tooling exists today — no inbox, no escalation path, no way for a real owner to reach a real person.
**Constitution served:** *"Whether the answer is action, advice or reassurance, the owner should always feel supported."* Currently unbackable by anything operational.
**Depends on:** nothing structurally; C3 makes it materially more useful (support without visibility into what broke is much weaker).
**Unlocks:** the first real cohort of paying customers can be onboarded responsibly — this is a hard prerequisite for H1, not a nice-to-have alongside it.

---

## High — blocks either measuring success or completing the product's own stated architecture

### H1. Billing
**Why it exists:** "7-day free trial, no credit card required" is marketing copy with zero backing logic today. There is no subscription state, no plan, no way to take a paying customer.
**Constitution served:** the Constitution's own definition of success — *"Could this business confidently operate without ReplyFlow? ... 'I genuinely wouldn't want to.'"* — cannot be tested at all without a real paying customer to ask.
**Depends on:** C1 (cost tracking) should exist first, so the first real price isn't chosen blind.
**Unlocks:** the ability to measure literally anything the Constitution calls success.

### H2. Work Cards as a dedicated screen
**Why it exists:** already the single biggest structural gap identified in `06-Experience-Architecture.md` §2, before this Constitution existed. A booking today is a title, a status, a date — not enough for a technician to walk out the door prepared.
**Constitution served:** *"The owner should think less."* Today the owner (or a technician) has to reconstruct a job from a WhatsApp thread by hand.
**Depends on:** nothing structurally (per `08-Implementation-Roadmap.md` B1, already scoped as the one genuinely foundational item in that track).
**Unlocks:** Front Desk, Diary, and Customers all currently point at a thin data model this would make real.

### H3. Approvals as a dedicated queue
**Why it exists:** no page currently shows every pending decision across the business in one place — approval only happens inline, one conversation at a time.
**Constitution served:** same principle as H2 — *"the owner should think less"* — plus *"a long queue isn't a sign this page needs better design, it's a signal the receptionist isn't yet trusted with enough"* (already the standing interpretation in `06-Experience-Architecture.md` §7).
**Depends on:** nothing structurally; more useful once H2 exists.
**Unlocks:** queue length becomes a real, visible signal of how much autonomy has genuinely been earned — the Constitution's Trust Model made legible.

---

## Medium — real, but not blocking the first customers

### M1. Privacy policy and terms of service, reviewed for real
**Why it exists:** customer conversation data (names, phone numbers, addresses, described problems) is real UK consumer personal data processed via a third-party AI provider. No visible policy exists.
**Constitution served:** indirectly every trust-related line in the Constitution — a product that hasn't answered this honestly hasn't fully earned the trust it's asking for.
**Depends on:** nothing structurally; needs a qualified reviewer, not engineering effort.
**Unlocks:** H1 (billing) shouldn't ship without this existing alongside it.

### M2. An explicit, written CRM-boundary check for the Customers page
**Why it exists:** *"We are not a CRM"* is a new, sharper line than anything previously written down. Nothing currently prevents a well-intentioned future feature (a filter, a bulk action, a fuller contact view) from quietly crossing it.
**Constitution served:** *"We are not a CRM. ReplyFlow helps owners understand customer relationships rather than simply manage them."*
**Depends on:** nothing. A documentation/process item, not engineering.
**Unlocks:** every future Customers-page feature gets checked against this on purpose, not by accident.

### M3. Correction/learning loop — design work only
**Why it exists:** already the least mature part of the whole pipeline (`07-Engineering-Principles.md` §6) — `reply_outcomes`/`reply_corrections` remain undesigned at the schema level.
**Constitution served:** *"It earns responsibility over time."* Currently true by intention, not measurable by data.
**Depends on:** real production usage to design against — building it blind, ahead of real correction data, means designing against imagined patterns.
**Unlocks:** the entire "Improve" stage of Learn → Work → Escalate → Improve, still substantially unbuilt.

---

## Low — real findings, low urgency

### L1. Investigate consolidating the "small"/"large" model-tier split
**Why it exists:** both tiers currently resolve to the identical model — the naming implies a distinction that doesn't exist.
**Constitution served:** *"Simplicity is a feature"* applied to the engineering, not just the interface.
**Depends on:** nothing; a technical investigation, not a decision yet.
**Unlocks:** a possible real reduction in call volume and cost, if the pipeline logic allows a single combined call.

### L2. Correct the stale comment in `lib/reply-engine/safety/evaluate.ts`
**Why it exists:** the file's own header comment claims auto-send isn't implemented; it is, narrowly (general-category, owner opt-in). A small instance of the codebase not accurately describing itself.
**Constitution served:** *"Understanding before explanation"* applied internally — a comment that misleads the next engineer is a small trust cost, paid quietly.
**Depends on:** nothing. Trivial, zero risk.
**Unlocks:** nothing downstream; pure hygiene.

### L3. Deliberate review of the Welcome logo's idle pulse and the Preparing screen's ambient particles
**Why it exists:** the closest things in the current product to *"exists purely for decoration."* Both were built with intent, but intent alone shouldn't be assumed sufficient without a real check.
**Constitution served:** *"Nothing exists purely for decoration. Everything exists to improve understanding."*
**Depends on:** nothing.
**Unlocks:** either a confirmed keep, or a small, low-risk simplification — genuinely fine either way, which is exactly why it's Low.

---

## What this roadmap deliberately does not include

No new features. No redesign of anything currently working. No AI-capability expansion (photos, proactive follow-up, tool use — all already catalogued as open decisions in `09-Receptionist-Intelligence-Architecture.md` §12, none of them Constitution *violations*, just capabilities not yet built). This roadmap exists to close the gap between what ReplyFlow already believes and what it can currently prove, operationally — not to grow the product before that gap is closed.
