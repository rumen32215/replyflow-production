# 00 — Vision

**This document did not exist before this sprint.** Everything in it was true and agreed early in this product's design — it lived in working notes and conversation, never written down as its own permanent chapter. Consolidating it here, first, because every other document in this folder assumes it.

---

## What ReplyFlow is

ReplyFlow is not CRM software. It is not an AI chatbot. It is not automation in the generic sense.

**ReplyFlow is the receptionist a sole trader wishes they could afford to hire** — and, downstream of that, the operating system for their working day. Every design decision in this folder either serves that one sentence or it doesn't belong.

The product's own personality was discovered, not invented. Across every stage of building it, the word that kept surfacing unprompted — never "AI Assistant," never "Automation Platform" — was **Receptionist**. That word already carries the whole job description: greet, calm, qualify, answer, book, protect the owner's time, know when to interrupt. No new metaphor needed inventing. The existing one just needed to be taken seriously as the actual design frame, not a marketing flourish over a generic AI product.

---

## The North Star

> **The business owner should never wonder what ReplyFlow is doing. They should only wonder whether they need to get involved.**

Not "did the AI reply, classify, draft, or send" — those are process questions, invisible plumbing the owner shouldn't have to track. One question: *do I need to do anything?* If the honest answer is no, the owner closes the app. That's success, not a lack of engagement.

**The companion principle: every interruption must earn the owner's attention.** Fifty interruptions is a failure regardless of accuracy. Two interruptions that both genuinely mattered feels intelligent. Interruption volume is a product metric to actively minimise, not a queue to keep merely accurate.

---

## The loop the product actually runs on

**Learn → Work → Escalate → Improve → repeat.**

- **Learn** — the owner teaches the receptionist (document 02).
- **Work** — she handles what she's confident about, within the narrow, evidence-earned autonomy the Confidence Timeline describes (document 03).
- **Escalate** — the owner reviews the small number of things that genuinely need a person (document 06's Decision Categories, document 05's Judgement).
- **Improve** — corrections and outcomes feed back into what she knows. This is the one stage of the loop still substantially unbuilt — see document 07.

Every screen in the product exists to serve one stage of this loop. A screen that doesn't map onto Learn, Work, Escalate, or Improve should be questioned before it's built.

---

## The feature filter

As ReplyFlow grows, every exciting-sounding feature — invoices, payments, reviews, stock control, accounting, marketing, analytics, phone calls, voice AI, calendars, team management — has to pass one question before it earns a place on the roadmap:

> **If this feature doesn't help the receptionist protect the owner's time, it probably isn't the next thing to build.**

Not a permanent ban on any of those ideas — they may all get built eventually. But they only earn priority by strengthening the core mission, never on their own merits as "exciting" or "expected of a SaaS product."

---

## What changed, going from building software to designing an employee

Early in this product's life, the working mode was implementation-driven: where do I click, why doesn't this work. It shifted, deliberately, to product-founder-level observation: the owner shouldn't have to touch anything; a screen should make them *feel* something, not just report data; the AI should only interrupt for genuine exceptions. That shift is why documents 01 through 07 in this folder exist at all, and it's the standing discipline every future sprint should carry forward — not "finishing ReplyFlow" as a checklist of screens, but building the receptionist a sole trader wishes they could afford, and staying disciplined about using that as the filter for every decision from here.
