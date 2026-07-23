# 01 — Principles

**Not UX. Not AI. Not onboarding.** This is the constitution the rest of this folder was already, unknowingly, obeying. From here on, it's explicit: every future sprint should state which principles it supports, and any feature that weakens one gets challenged before a line of code is written.

---

## Why a document like this has to exist

Right now, good decisions get made because the whole of this folder can be fresh in one head. That doesn't last. Picture ReplyFlow with three developers, a designer, a product manager, none of whom sat through the sessions that produced this thinking. Someone proposes a shiny feature. Without this document, the only available question is "is it cool?" — a question that has never once protected a product from getting worse as it grows. With this document, the question becomes "does it violate Principle 4?" or "does it earn trust before asking for responsibility?" — a question with a real, checkable answer. A roadmap says what to build next. A constitution says what's still true no matter what gets built.

---

## The ten principles

### 1. Trust is demonstrated, never asserted
Never ask for responsibility before earning it. This is the sentence underneath the entire Trust Experience (document 03) — Meet Your Receptionist, The Promise, Test Conversations, and the Confidence Timeline are all just different rooms built for this one law to live in. If a feature asks the owner to hand over something — a connection, a permission, a customer — without first showing the specific evidence that justifies it, the feature is wrong, regardless of how good the underlying capability actually is.

### 2. The owner hires a receptionist, not software
Everything should feel like training and working with an employee — never configuring AI. This is why the Receptionist page is a teaching playground, not a settings form; why onboarding is "Hiring" and "Introduction," not "Setup" (document 04); why she has a name, a temperament, and judgement (document 02), never described as a model or a feature. The moment any part of the product starts to feel like configuring a tool, it has drifted from this principle and should be pulled back.

### 3. Every screen answers one question
If it takes longer than five seconds to understand, redesign it. The governing rule of document 05, restated here because it doesn't stop applying once a screen ships — a permanent bar every future screen has to clear, not a one-time design pass.

### 4. The owner should think less
Reduce cognitive load. Not clicks — thinking. A one-click screen that forces interpretation has failed this principle. A three-click screen that states plainly what's true has passed it. Click count is not the metric — the distinction document 05 draws between a dashboard ("3 conversations open") and an office ("you're mid-conversation with two customers, one waiting on you specifically").

### 5. ReplyFlow should remove uncertainty
Every interaction should increase confidence. The North Star (document 00), still load-bearing: the owner should never wonder what ReplyFlow is doing — only whether they need to get involved. Silence, when nothing needs attention, is doing this correctly. A vague status or an unexplained decision is a failure regardless of how accurate the underlying data is.

### 6. Proof before permission
Show capability, then request autonomy. Named "Proof Before Ask" in document 03 — structurally why Test Conversations comes before WhatsApp connection, not after. Any feature that requests a new permission or an autonomy expansion owes the owner evidence in the same breath, not a separate leap of faith.

### 7. Judgement belongs where it matters
Deterministic code guarantees rules. The model provides empathy, flexibility, and conversation. Never confuse the two. Already load-bearing, working code, detailed in document 06: the Decision Categories table decides, deterministically, which categories can never auto-send. Grounding backstops catch invented facts and overclaimed reschedules with a hard rule, not a hopeful instruction. Wherever a mistake would be genuinely costly, a rule owns the outcome. Everywhere else, her judgement does what rules can't: sound like a person.

### 8. The receptionist earns trust over time
Autonomy grows through evidence, not optimism. The Confidence Timeline (document 03) is the literal expression of this — Training, Testing, Shadowing, Observed, Trusted, Autonomous — and the discipline behind auto-send's real scope today: one narrow, proven category, widened only when there's evidence to widen it, never as a hopeful default. A feature that grants autonomy because it would be convenient, not because it's been earned, violates this principle even if it never causes a single real mistake.

### 9. Every customer interaction protects the owner's reputation
The owner's reputation is the most valuable asset in the system. Everything else exists to protect it. This is the premise document 03 opens on — a tradesperson with years of reputation, asked to hand their real number to something new. Every fact-grounding rule, every non-overclaim check, every escalation category (document 06) exists downstream of this one sentence. When a decision is genuinely unclear, this is the tie-breaker: which choice better protects what the owner actually has at stake.

### 10. The product should disappear
The owner shouldn't admire ReplyFlow. They should simply feel their business runs more smoothly. Document 04's entire arc in one sentence — watching everything in week one, forgetting it's there by month six — and the honest end-state every other principle is quietly working toward. A feature that makes the product more impressive to look at, without making the owner think about it less, has optimised for the wrong thing.

---

## The mantra

> **"Trust has to be demonstrated, not asserted."**

Not just a sentence in this document. The internal rule for the whole company. Whenever a feature is being debated: are we asking the owner to trust us, or are we giving them evidence that they can?

---

## How this document gets used

A sprint brief should name which of these ten principles it's advancing, the same way a commit message explains why, not just what. When a proposed feature would weaken one — grant autonomy without evidence (6, 8), add a screen that needs interpreting (3, 4), make the product feel like software instead of staff (2) — that tension gets raised and resolved *before* implementation starts, not discovered afterward in a QA pass. The principles outrank the roadmap (document 07), not the other way round.
