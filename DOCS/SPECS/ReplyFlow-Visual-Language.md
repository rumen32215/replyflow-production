# ReplyFlow Visual Language

**Status: approved (2026-08-03).** Behaviour, intelligence, trust, architecture, and emotion all have permanent documents. Visual feeling didn't — this is that document, written before Hero (or any other Landing Experience section) was built, so eight sections built one at a time don't quietly drift into eight slightly different products. Not because of colour. Because of consistency — the same reason Apple, Stripe, and Linear each have exactly one visual language, not one per page.

**This document does not invent a new design system.** ReplyFlow already has one — `app/globals.css`'s real token set, `tailwind.config.ts`, and the motion primitives in `components/shared/motion.tsx` are already disciplined, already consistently applied across the whole authenticated product, and already good. The landing page has to feel like the *same product* as Front Desk and Meet Your Receptionist, not a separate marketing site wearing ReplyFlow's logo. Every rule below either codifies what already exists or extends it explicitly, flagged as new where it is.

---

## 0.1 The permanent shipping law for this entire phase

> **Nothing ships because it looks better. Everything ships because it improves understanding, trust, or confidence.**

Every architectural decision behind the Brain Loop, the Trust Ladder, and Learning Memory has been about increasing trust, never about novelty for its own sake. The Experience Polish phase — the First-Time Experience Review, the Landing Experience Design, this document, and everything implemented from them — is held to the identical standard, applied to visual decisions instead of product ones. Before any element ships, ask which of the three it serves:

- **Understanding** — does this make it clearer what ReplyFlow is or does?
- **Trust** — does this make the product feel more credible, more honest, more like something a real business could rely on?
- **Confidence** — does this make the visitor more sure that trying ReplyFlow, or continuing to use it, is the right call?

If a visual choice is beautiful but can't name which of the three it serves, it doesn't ship — regardless of how good it looks in isolation. This is the same test §1's "motion has meaning" already applies to animation specifically, generalised to every visual decision on the page.

---

## 0. Why a document like this has to exist

`02-Principles.md` opens with the same argument this document is making, one layer down: right now, consistent visual decisions get made because the same person building each screen is also carrying the whole system in their head. That doesn't survive eight sections built one at a time, each reviewed and approved independently, each an opportunity to quietly reinvent a spacing scale or reach for a new shade of blue "just for this one section." This document is what makes "does this match?" a checkable question instead of a feeling.

---

## 1. The eight qualities, made checkable

The founder's own list, each translated from an adjective into an actual rule a section can be checked against — not vibes, evidence, the same discipline this project applies to everything else.

| Quality | Not | The checkable rule |
|---|---|---|
| **Premium** | Playful | No bright, saturated colour outside the two brand colours (primary blue, success green) and their existing semantic siblings (§3). No cartoon iconography, no emoji, no illustrated mascots. |
| **Calm** | Busy | One primary visual per section (§6), never two competing focal points. Generous section padding (§5) — a section that needs to be dense to fit everything has too much in it, not too little space. |
| **Quiet confidence** | Shouting | No exclamation marks in headlines. No all-caps headlines. No countdown timers, no "limited spots," no urgency manufactured that isn't real — the same "never invent" discipline the receptionist herself is held to, applied to how the page talks. |
| **Human** | Robotic | Copy in the register already established by Welcome and Meet Your Receptionist (`components/onboarding/welcome-greeting.tsx`, `components/dashboard/receptionist/meet-your-receptionist.tsx`) — plain, warm, specific sentences, never "leverage," "streamline," "solutions," or other generic SaaS vocabulary. |
| **Spacious** | Crowded | Minimum section vertical padding and a defined max content width (§5) — not a suggestion, an actual Tailwind class every section uses. |
| **One idea per section** | Feature dumping | Every section in `ReplyFlow-Landing-Experience-Design.md` states its single emotional job in that document's own table (§1 of that spec) — if a section is carrying two, it's two sections. |
| **Product first** | Illustration first | The hero's proof point is a real, working phone-conversation UI (`components/shared/phone-preview.tsx`), not a commissioned illustration or a stock photo of a person on a phone. Every section that can show a real product surface instead of describing one, does. |
| **Motion has meaning** | Decorative | Every animation on the page must be traceable to one of §7's named purposes. If a motion choice can't name which purpose it serves, it doesn't ship. |
| **Show the product, don't describe it** | — (the founder's own addition, folded in here) | Same rule as "product first," applied at the sentence level too — prefer a real example over an abstract claim wherever one can be shown (§7 of the Landing Experience spec already does this for Trust & Safety, using the real, existing Promise text rather than inventing new marketing language). |
| **White space earns trust** | Filling every space | A section is allowed to end with visible empty space below its content. Padding is not "wasted" — per §5, it's the actual mechanism "calm" and "premium" are built from, not a side effect of them. |

---

## 2. Voice

Not this document's job to redefine — `ReplyFlow-Landing-Experience-Design.md` already sets the copy direction, section by section, and the product's existing in-app voice (Welcome, Meet Your Receptionist, The Promise) is the real, proven register to match. Named here only to draw one hard line relevant to *visual* decisions: typography and layout should never have to compensate for copy that doesn't already sound like ReplyFlow. If a headline needs a bigger font to feel confident, the words are wrong, not the font size.

---

## 3. Colour — codified from the real system, nothing new

Every colour on the landing page traces to `app/globals.css`'s existing tokens. No new colour gets introduced for marketing purposes — the same "do not introduce new colors outside this file without a reason" rule already written into that file's own header comment.

| Token | Hex | Real meaning already established | Landing use |
|---|---|---|---|
| `primary` | `#2563EB` | Intelligence, recommendations, the brand's own core identity (the logo mark, `components/shared/logo.tsx`) | Primary CTA, links, the blue half of every gradient |
| `success` | `#22C55E` | Confidence, completion | The green half of every gradient, confirmation moments (e.g. a checkmark in Trust & Safety) |
| `learning` | `#A855F7` | Learning, growth, brain activity | Reserved for the Learning Memory idea inside Product Intelligence (§6 of the Landing spec) — the one place a third colour is allowed, because it already carries this exact meaning in-product |
| `attention` | `#F59E0B` | Needs awareness, not urgent | Not expected on the landing page at all — no reason for a marketing page to need this token; noted so nobody reaches for it out of habit |
| `foreground` / `muted-foreground` | `#0F172A` / `#64748B` | Body text, secondary text | All copy |
| `background` | `#F8FAFC` | Page background | Section backgrounds alternate, at most, between this and pure white (`card`) — never a third background colour |

**The one real extension this document makes:** the primary→success gradient (`GradientText`, `Logo`) is already the product's single signature visual flourish, used sparingly, on single words or short phrases. The landing page should treat it the same way — reserved for the hero's key phrase and section headings that genuinely deserve emphasis, never applied to full sentences or used more than once per section.

---

## 4. Typography

**Family:** Inter (`var(--font-inter)`), already the whole product's only typeface — no second typeface for "marketing feel." Premium is built from restraint and scale, not from a display serif bolted onto a product that has never used one.

**Weight and tracking:** `font-extrabold tracking-tight` is already the established pattern for every real heading in this product (Welcome's "Good afternoon.", business-name's "What's your business called?", Meet Your Receptionist's "Meet {name}"). Landing headings inherit this exactly — a landing hero headline is a bigger version of a pattern that already exists, not a new one.

**The one real extension:** nothing in the current product needs a headline larger than roughly 30px (Welcome's greeting, the largest text anywhere today) — a landing hero needs to hold its own outside a centered 440px card, at real page width. New, larger steps are needed at the top of the scale; they should still use the same weight/tracking convention, and should be defined once, here, rather than picked freely per section:

| Role | Size (indicative, tune in implementation) | Weight/tracking |
|---|---|---|
| Hero headline | ~44–56px, responsive down to ~32px on mobile | `font-extrabold tracking-tight`, same family as every existing h1 |
| Section heading | ~28–34px | `font-extrabold tracking-tight` — matches today's largest in-product headings (business-name, trade-step) almost exactly |
| Section subhead / lede | ~17–19px | `font-semibold`, `text-foreground` — matches Welcome's `"Welcome to ReplyFlow."` line weight |
| Body copy | ~15–16px | `font-normal`, `text-muted-foreground`, `leading-relaxed` — the existing body-copy convention used everywhere in onboarding |

---

## 5. Space and layout

- **Max content width:** a single, consistent reading/content width across every section (matching the product's own existing `max-w-5xl` container already used in `app/(auth)/layout.tsx`, or wider only for the hero's own visual if it genuinely needs the room) — not a different width chosen per section.
- **Section padding:** generous, consistent vertical padding between sections (large enough that scrolling the page has a clear rhythm — section, breathing room, section) — defined once as a single Tailwind spacing value reused by every section wrapper, never eyeballed per section.
- **One primary visual per section.** The hero has the phone conversation. Trust & Safety has The Promise, stated plainly, with no second competing element. Product Intelligence has, at most, one visual per idea (e.g. a simple Confidence Timeline treatment for the Trust Ladder idea) — never a busy composite graphic trying to show three ideas at once.
- **Alternating rhythm, not pattern-matching every section identically.** Not every section needs the same internal layout (text-left/visual-right, etc.) — but every section shares the same outer spacing and width rules from this section, so the page reads as one continuous, considered document rather than a stitched-together set of independently designed blocks.

---

## 6. Imagery and iconography

- **The real product is the imagery.** `components/shared/phone-preview.tsx` (the `PhoneFrame`/`Bubble` components already built and already trusted for Test Conversations and the onboarding demo) is the landing page's primary visual asset — reused, not reinvented, for the hero and anywhere else a real conversation needs showing.
- **No stock photography.** No generic "tradesperson on a ladder holding a phone" stock image — it's exactly the genericness this whole review exists to move away from, and it competes with, rather than reinforces, the real product visual.
- **No AI/tech cliché iconography.** No circuit-board textures, no glowing neural-network graphics, no robot imagery. `Handbook Ch.02` is explicit that intelligence should be invisible in the product itself — the landing page shouldn't visually contradict that by making "AI" the thing being illustrated.
- **Icons, where genuinely needed** (e.g. the five trades in §7 of the Landing spec), use the same icon set already in use throughout the product (`lucide-react`, already used for `Wrench`/`Zap`/`Paintbrush`/`Hammer`/`Home` on the real trade-selection screen) — not a second icon library chosen for a "landing page feel."

---

## 7. Motion — every animation names its purpose

`components/shared/motion.tsx` already defines the product's complete motion vocabulary: `EASE` (`[0.22, 1, 0.36, 1]`, used everywhere), `SettleCard` (small upward settle + fade — "cards never pop, cards settle"), `ScrollReveal` (the same settle, deferred until scrolled into view — built exactly for below-the-fold marketing-style content), `press` (tap acknowledgement), `GrowingCheck` (the one "success" moment). **The landing page should not introduce new motion primitives** — it's the first real, large-scale user of `ScrollReveal`, which already exists for precisely this purpose and has simply never had a page long enough to need it before now.

Every animation on the page must serve one of these purposes, and no other:

1. **Arrival** — a section settling into place once scrolled into view (`ScrollReveal`). This is the default, expected motion for every section boundary.
2. **Proof** — the hero's phone conversation animating in turn by turn (reusing the same typed-message/bubble choreography already built for `components/onboarding/preparing-receptionist.tsx`), because watching it happen is more convincing than a static screenshot of the end state.
3. **Acknowledgement** — a tap response on the CTA (`press`), identical to every button press elsewhere in the product.
4. **Ambient atmosphere** — the one deliberately-named exception: the aurora-blob background treatment (`.aurora-layer`/`.aurora-blob-*` in `globals.css`) is explicitly *not* communicative — it's a slow, low-opacity, GPU-composited drift confined to a card's background, already reasoned about in that file's own comment. Ambient atmosphere is allowed sparingly (the hero is the one legitimate place for it on this page) precisely because it doesn't compete for attention with anything — it's the one category of motion this document permits without a stated *informational* purpose, because its purpose is deliberately non-informational.

**Anything that doesn't fit one of these four categories doesn't ship** — no gratuitous parallax, no scroll-hijacking, no looping decorative animation outside category 4, no motion added "because it looks cool" once a section is otherwise finished. `prefers-reduced-motion` must be respected everywhere motion appears, matching the existing convention already in `globals.css`.

---

## 8. Anti-patterns — what this specifically guards against

Named because this codebase (and this assistant) has real, working conventions to protect, and a landing page is the single easiest place for a generic look to sneak in under time pressure:

- Glassmorphism, frosted-glass cards, or gradient meshes that don't trace to the two real brand colours.
- A hero built around a large abstract 3D shape or blob illustration standing in for "innovation" — the real product's own phone-conversation UI already does this job better and more honestly.
- Testimonial carousels or logo walls before real testimonials/logos exist (already ruled out on trust grounds in the Landing Experience spec §8 — repeated here because it's also a visual-consistency risk, not just a trust one).
- A second typeface, "just for the hero," to make it feel more like a marketing site — Inter, used with more scale and more room, is the correct answer, not a new font.
- Feature-grid sections (three or four-column icon-plus-two-line-of-text blocks) — the exact "feature dump" pattern §1 already rules out; every idea gets its own considered section, per the Landing Experience spec, never a compressed grid.

---

## 9. How this document gets used

Before any Landing Experience section is built, check it against this document the same way `02-Principles.md` asks every feature to be checked against the ten principles: does this use only the real tokens in §3–§4, does it respect §5's spacing rules, is its imagery real product (§6), does every animation on it name one of §7's four purposes, and does the section as a whole answer §0.1's law — understanding, trust, or confidence, not just "looks better"? If a section can't answer yes to all five, it isn't ready to ship, regardless of how good it looks in isolation.
