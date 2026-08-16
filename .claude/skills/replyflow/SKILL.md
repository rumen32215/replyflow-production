---
name: replyflow
description: Standing product principles for ReplyFlow — a WhatsApp AI receptionist and job-management product for UK tradespeople. Apply these by default on any change touching the reply engine, job/report data, or customer-facing documents.
---

# ReplyFlow product principles

ReplyFlow is a WhatsApp-based AI receptionist and job-management tool for UK tradespeople (plumbers, electricians, and similar solo/small trades). It is not a general CRM, invoicing, payments, or marketing platform — resist scope expansion into those areas unless explicitly requested.

## The core chain

Customer (WhatsApp) → Conversation → Job (`work_cards`, the canonical record) → Booking → Evidence (photos) → Report (customer-facing document).

Each stage should only ever *surface* what was genuinely understood at the stage before it — never re-derive, re-guess, or invent at a later stage what an earlier stage already established (or explicitly left unconfirmed).

## Non-negotiable rules

**Never invent business facts.** Prices, guarantees, availability, policies — if a fact isn't confirmed in the business's own configured data, the AI must say so is unconfirmed, never assert a plausible-sounding value. Grounding checks that gate a fact-bearing claim on "was this actually cited" must verify the *specific claim*, not just "was anything cited."

**Deterministic over AI wherever possible.** Date/time resolution, formatting, phase defaults, deduplication, and other mechanical transforms of already-extracted data should be plain code, not another model call. Reserve AI for genuine language understanding and generation, not for logic a function can do reliably and cheaply.

**Human approval before anything customer-facing sends.** Draft replies and draft reports always go to the owner for review. A grounding/safety failure should escalate to the owner, never silently drop the draft and never auto-send.

**Don't expose internal extraction language.** Labels like "Collected details," "Conversation summary," or other artifacts of *how* ReplyFlow understood something should not appear as if they were the business record itself. The Job page and the Report should read as a business document a tradesperson wrote, not a log of what the AI extracted.

**Don't duplicate structured data.** If the same fact (an issue, an address, a price) is captured in two places, one is the source of truth and the other either doesn't render or clearly serves a different purpose. Redundant restatement in different words is still duplication.

**Provenance matters, but calmly.** Distinguish customer-provided vs. owner-confirmed vs. AI-drafted data using ReplyFlow's own existing pill-badge/provenance vocabulary (`provenance-label.tsx`), not alarm-colored warnings for ordinary, expected states (e.g. an address the customer gave but the owner hasn't confirmed yet is normal, not broken).

**Report/PDF standard.** Concise, professional, business-identity-led (name/trade/phone — never a personal avatar), no duplicate sections, charges only when the owner entered them, photos laid out proportionately to how many there are rather than reserving a fixed, wasteful footprint per photo.

**Motion is restrained.** ReplyFlow's motion language (`components/shared/motion.tsx`) is "quiet confidence, not excitement" — reuse `SettleCard`/`Reveal`/`GentleSwap`/`GrowingCheck` rather than introducing new animation styles or dependencies.

## Working discipline

- No scope expansion: don't add invoicing, payments, accounting, CRM, notifications, or marketing tooling as a side effect of an unrelated fix.
- No new dependencies or MCP servers unless a real gap demands one — check ReplyFlow's own existing primitives first.
- Migrations, commits, deploys: never without explicit real-time authorization in the same turn.
- Verification is not just `tsc`/lint/tests/build passing — for anything user-facing, actually exercise it in a real browser; for anything PDF-related, actually open and read the generated document.
