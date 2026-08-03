# ReplyFlow Landing Experience — Design Specification

**Design pass only — no implementation.** This is not a landing-page redesign. It's the design of ReplyFlow's entire first impression: the first thing anyone who has never heard of ReplyFlow will ever see. Phase 1 of the Experience Polish roadmap that opened with `ReplyFlow-First-Time-Experience-Review.md` — that document's §1 finding (there is no landing page; `/login` has been quietly standing in for one) is what this document exists to close.

**Source material.** Everything below is built from real, already-approved material — nothing here invents a new voice or a new claim the product doesn't already make elsewhere: Founder Handbook Ch.01 (*Why ReplyFlow Exists*), Ch.02 (*Product Vision*), Ch.03 (*The Perfect Receptionist*), Ch.06 (Principles); `DOCS/CONSTITUTION/01-Vision.md` (the North Star), `02-Principles.md`, `04-Trust-Experience.md`, `05-Owner-Experience.md`, `06-Experience-Architecture.md`; and the real, shipped architecture this product can actually stand behind — `10-ReplyFlow-Brain-Architecture.md` (Brain Loop), `11-ReplyFlow-Trust-Architecture.md` (Trust Ladder, Business Understanding), `12-ReplyFlow-Learning-Memory-Architecture.md` (Learning Memory). Every claim this page makes has to be a claim the product can currently back up — this is the same "never invent a fact" discipline the receptionist herself is held to (Handbook Ch.03), now applied to how ReplyFlow talks about itself.

---

## 0. The governing law

`DOCS/CONSTITUTION/06-Experience-Architecture.md` already states the permanent rule this whole page answers to: *"If a screen cannot answer its one question within five seconds, it is wrong."* Codified there as Principle 3 (`02-Principles.md`). This document sharpens that rule for a page whose "question" is never functional, always emotional — and this sharpening is worth writing down permanently, not just applying here once (see §8).

> **Every screen must answer one emotional question before it's allowed to ask the visitor for anything.**

For the landing page specifically:

> **Why should I care?**

Not "what does ReplyFlow do" — a visitor who has never heard of ReplyFlow doesn't yet care what it does. They first need to recognise themselves in the problem it solves. Every section below is judged against whether it moves a stranger closer to *caring*, before it ever tries to explain, prove, or sell.

---

## 1. The emotional journey — what the page has to do, in order

Not a wireframe. The sequence of feelings a visitor should move through, top to bottom — each stage is what makes the next stage land, matching the exact discipline `05-Owner-Experience.md` §1 already uses for the in-product journey:

| Section | Emotional job | The one question it answers |
|---|---|---|
| Hero | Recognition | *Why should I care?* |
| The Invisible Weight | Being understood | *Does this actually get my problem?* |
| How ReplyFlow Works | Comprehension without overwhelm | *How does this actually happen?* |
| Trust & Safety | Reassurance | *Can I trust this with my customers?* |
| Product Intelligence (Brain Loop / Trust Ladder / Learning Memory) | Credibility | *Is this actually smart, or just another chatbot?* |
| Business Understanding | Personal relevance | *Will this actually understand my business specifically?* |
| Social proof | Belonging | *Are people like me already trusting this?* |
| Call to action | Confidence to act | *Am I ready to try this, and is that safe?* |

A visitor who reads top to bottom should arrive at the CTA already having answered "why should I care" for themselves — the CTA's only job at that point is to make saying yes effortless, never to do the persuading itself.

---

## 2. Hero

**Emotional question: Why should I care?**

**What it has to do:** land the real problem before the product name means anything. Handbook Ch.01's own framing is exactly right and shouldn't be softened for marketing: business owners don't lose work because they're bad at their trade — they lose it because they're human, and the business keeps moving even when they physically can't.

**Direction, not final copy** (grounded directly in Ch.01's "The Invisible Weight"):
- A headline that names the felt problem, not the product category. Something in the register of *"You're under a sink. A customer just messaged. Six more will today."* — concrete, specific to a tradesperson's actual day, not abstract SaaS language ("streamline your customer communications").
- A supporting line that names what ReplyFlow actually is, once — the one moment the product's own name and one-sentence identity appears clearly, so the page never leaves a visitor wondering what they're even looking at.
- A visual proof point, not a screenshot of a dashboard: a real (or realistic) WhatsApp exchange, styled with the same `components/shared/phone-preview.tsx` visual language already built and already trusted internally for Test Conversations. This is the single highest-leverage reuse opportunity in this whole spec — the product already knows how to make a conversation look credible and alive; the landing page should be the *first* place that's shown, not an internal-only pattern.

**What NOT to do:** no feature list here. No "AI-powered" as the headline's own selling point — Handbook Ch.02 is explicit that intelligence should be invisible, and that discipline should extend to how the page talks about itself, not just how the product behaves.

---

## 3. The Invisible Weight

**Emotional question: Does this actually get my problem?**

**What it has to do:** this section's entire job is recognition, not explanation — a visitor should read it and think "that's literally my Tuesday," before the page has asked them to understand anything about how ReplyFlow works.

**Direction**, built directly from Handbook Ch.01's own list, real and unaltered:
> *Did I reply to that customer? Did I send that quotation? Did I forget somebody? What jobs need my attention today?*

Presented as recognisable, everyday questions — not a bulleted feature-benefit list. The Handbook's own line is the exact right note to close on: *"The mental load is often far bigger than the physical work."*

**What NOT to do:** don't turn this into a pain-point-to-feature mapping table this early — that's the *next* section's job. Let this one section just be felt.

---

## 4. How ReplyFlow Works

**Emotional question: How does this actually happen?**

**What it has to do:** the first moment the page explains anything — but explains the *shape* of what happens, not a feature list, and always in outcome language, never internal product vocabulary (the exact discipline the First-Time Experience Review's §11 finding says Front Desk's own setup checklist still gets wrong — this page must not repeat that mistake in the one place a stranger is meeting the product for the first time).

**Direction**, built from Handbook Ch.03's "Five Responsibilities," translated into what a visitor actually experiences rather than the internal responsibility names:
1. **She protects your reputation** — never invents an answer, never promises something the business can't deliver.
2. **She reduces what reaches you** — routine stays routine; only real decisions ever interrupt you.
3. **She remembers** — a returning customer is never asked the same question twice.
4. **She leaves nothing hanging** — every conversation ends with a booking, a follow-up, or a clear next step, never silence.
5. **She knows when to stop** — customers feel heard, not managed.

Each of these is a real, already-shipped behaviour (the fact-grounding discipline in the reply engine's safety layer, the Organise Checkpoint, the escalation categories) — this section should read as a promise the product can already keep today, not aspirational roadmap language.

**What NOT to do:** don't name Brain Loop, Trust Ladder, or Learning Memory here by name yet — that's §6. This section is about what the owner *feels* happens; §6 is where the credibility of the underlying architecture gets established for a reader who wants to go deeper.

---

## 5. Trust & Safety

**Emotional question: Can I trust this with my customers?**

**What it has to do:** answer the exact fear `04-Trust-Experience.md` §0 opens on — a tradesperson being asked to hand a stranger their real number, the number their reputation already lives on. That document's own governing law applies here directly: **trust has to be demonstrated, not asserted.** A landing page can't run a live Test Conversation for a stranger the way onboarding can — so this section's job is to state The Promise plainly and specifically, and point toward where it's actually proven (Test Conversations, inside the product), not to try to *simulate* proof it can't yet give.

**Direction**, using the Promise almost verbatim — it's already written, already approved, and already exactly the right register (`lib/receptionist-handover.ts`'s `THE_PROMISE`):
> *"I'll never pretend to know something you haven't taught me. I'll never guess when your reputation is on the line. When I'm not sure, I'll bring you in."*

Followed by a plain statement of the mechanism that makes this true, not just claimed: every reply is checked against what the business actually taught before it's ever sent; anything uncertain waits for the owner, every time, until trust is earned category by category (the Trust Ladder, named plainly here in outcome terms, detailed further in §6).

**What NOT to do:** no security badges, no generic "bank-level encryption" language that could belong to any SaaS product — specificity is what makes this section trustworthy, genericness is what makes a trust section actively suspicious.

---

## 6. Product Intelligence — Brain Loop, Trust Ladder, Learning Memory

**Emotional question: Is this actually smart, or just another chatbot?**

**What it has to do:** this is the section for a visitor who's engaged enough to want to know *how*, not just *that*. It should read as evidence of genuine engineering depth without ever becoming a technical document — the same translation discipline the product already applies to the owner's own in-app experience (nothing here should sound like it was copied from a Constitution file, even though every claim is sourced from one).

**Direction, one idea per subsection, each grounded in real shipped architecture:**

- **She thinks in stages, not reflexes.** The Brain Loop (`10-ReplyFlow-Brain-Architecture.md`) — Understand, Remember, Check, Judge Risk, Decide, Act, Organise, Learn. Translated for a visitor: *before she ever replies, she checks what she already knows, weighs what happens if she's wrong, and only then decides what to do* — Handbook Ch.10's own "Understanding is always the first decision" is the right register to borrow from directly.
- **Trust is earned, one category at a time, never assumed.** The Trust Ladder (`11-ReplyFlow-Trust-Architecture.md`) — Training → Testing → Shadowing → Observed → Trusted → Autonomous. Translated: *she might be fully trusted answering general questions within weeks, while bookings still come through you — and that's not a bug, that's the design.* This is one of ReplyFlow's genuinely differentiated ideas and deserves real visual treatment (a simple version of the Confidence Timeline itself, not just a sentence).
- **She gets better at your business specifically, from real corrections — nothing invented.** Learning Memory (`12-ReplyFlow-Learning-Memory-Architecture.md`) — translated: *when you correct her, she doesn't just fix that one reply — she asks what she should actually remember, and only acts on it once you've confirmed it.* "Infer to propose, ask to confirm" is the real mechanism; a visitor doesn't need that phrase, but the honesty behind it ("she never assumes, she asks") is exactly the kind of specific, checkable claim that builds real credibility, per `02-Principles.md`'s own mantra.

**What NOT to do:** resist the urge to make this section exhaustive. Three ideas, well explained, beat six skimmed. This is also the one section most at risk of drifting into internal vocabulary — every sentence should pass the same test §4 already applies: outcome language, never architecture-document language.

---

## 7. Business Understanding

**Emotional question: Will this actually understand my business specifically, or is it generic?**

**What it has to do:** directly answers the same real, legitimate question the First-Time Experience Review's §8 finding raised about trade selection — *does this actually understand what a builder does, specifically, or is "builder" just a label?* The honest answer, confirmed against real code during that review, is yes: trade genuinely changes real scenario content and real reply-generation context. This section is where that gets said out loud to a stranger, before they've even signed up.

**Direction:** name the real trades ReplyFlow already has deep, specific support for (plumbing, electrical, painting, building, roofing — matching the exact five already live in onboarding, `lib/trades.ts`) rather than a vague "works for any trade" claim. Specific and narrower is more credible than broad and generic — the same reasoning that already justified keeping onboarding to five trades instead of twenty (`ReplyFlow-V1-First-Run-Proposal.md`). If a visitor's trade isn't one of the five, this section should say so honestly rather than imply otherwise.

**What NOT to do:** don't imply the product already knows anything about a specific *business* before they've taught it anything — that would violate the exact "never invent" discipline the whole product is built around, applied here to marketing claims about capability rather than to a reply. The claim is "built to understand your trade, ready to learn your business" — not "already knows your business."

---

## 8. Social proof

**Emotional question: Are people like me already trusting this?**

**What it has to do:** this section is explicitly a **placeholder** at this stage — named as such in the requested structure, and worth being disciplined about why: ReplyFlow has not yet run a real pilot with real businesses (`ReplyFlow-Pilot-Plan.md`). **Nothing here should ever be fabricated** — no invented testimonial, no invented customer count, no stock-photo "trusted by 500+ businesses" claim. This is the exact same non-negotiable discipline the reply engine itself is held to (never invent a fact, `07-Engineering-Principles.md`), applied to how the company presents itself. A fabricated testimonial discovered later would cost far more trust than an honestly-empty section costs today.

**Direction for now:** the honest, real thing this section can say today is process, not proof — e.g. *"Built with real UK tradespeople, refined through real conversations"* — true, checkable, and consistent with the actual Pilot Plan. Structure the section so real testimonials, trade logos, or a review-platform badge can drop in later with zero redesign, once the pilot (`ReplyFlow-Pilot-Plan.md`) actually produces them.

**What NOT to do:** do not ship a fake logo wall or an invented quote "to fill the space" before launch. An honestly quiet section is a real gap, worth closing later with real evidence — not a licence to invent evidence now.

---

## 9. Call to action

**Emotional question: Am I ready to try this, and is that safe?**

**What it has to do:** make the decision feel low-risk and reversible, not final — directly answering the same trial-terms finding from the First-Time Experience Review §3–4 (the "no credit card required" line is a real objection-killer currently buried as fine print on the signup form itself).

**Direction:**
- State the real trial terms plainly, with real visual weight, not as a footnote: 7-day free trial, no credit card required.
- The CTA's own label should name the outcome, not the software action — echoing the Experience Review's §3–4 recommendation (e.g. *"Start building my receptionist"* rather than "Sign up" or "Get started").
- Placement: one clear, primary CTA after the Product Intelligence and Business Understanding sections (§6–§7) — once genuine credibility has been established — plus a secondary, lower-emphasis CTA in the hero itself for a visitor who's already convinced and doesn't need the rest of the page. Never more than these two.

---

## 10. How the transition into account creation should work

This is a real architectural decision, not just a copy question, and it's worth resolving explicitly here so Phase 2 (Authentication) starts from a settled foundation rather than re-litigating it.

**Today:** `app/page.tsx` is a pure router — a signed-out visitor hitting `/` is redirected straight to `/login`, which is why login has been quietly standing in as the landing page.

**The change this spec implies (not yet built):** `/` should render the real Landing Experience for a signed-out visitor, not redirect away from itself. The routing logic doesn't need to be rebuilt, only re-pointed: a session still routes an authenticated visitor onward exactly as it does today (onboarding-incomplete → `/welcome`, complete → `/dashboard`); the branch that currently reads `if (!user) redirect("/login")` becomes the one that renders this new page directly instead of redirecting. `/login` keeps existing exactly as it is today (per the Experience Review §2, it doesn't need much once it's no longer also carrying the landing page's job) — reached only by an explicit "Log in" action from the landing page, or a direct link, never as the default unauthenticated experience.

**The CTA's own destination** stays `/signup`, unchanged — this spec doesn't require any change to account creation itself (that's Phase 2's own scope). What changes is only where the *decision* to go there gets made: today it's made with zero context on a bare login form; after this change, it's made at the bottom of a page that's already answered "why should I care."

---

## 11. What this spec deliberately leaves open

Per the brief, this is architecture and structure — not final copy, not visual design, not component code. Left for the section-by-section implementation pass that follows:

- Exact headline/subhead copy (directional examples given above, none final).
- Visual treatment of the Trust Ladder / Confidence Timeline as a real on-page element.
- Whether the hero's WhatsApp-style proof conversation is a static, curated example or something closer to the live, real demo already built for onboarding (`components/onboarding/preparing-receptionist.tsx`) — both are legitimate options and deserve their own decision when that section is actually built.
- The exact five-trade iconography/imagery for §7.

---

## 12. What this spec does not do

No code has changed. No copy is final. Per the brief: this document is reviewed and approved first; implementation happens section by section afterward, the same discipline already used for `Hiring-Experience-Redesign.md`.
