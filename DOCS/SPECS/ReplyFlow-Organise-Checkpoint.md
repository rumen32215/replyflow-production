# ReplyFlow Organise Checkpoint

**First implementation task under the Founder Handbook.** Handbook Ch. 4 (The ReplyFlow Brain), Brain Loop step 7: *"Organise — Every interaction improves the business. The Brain ensures that conversations never simply end... Should a Work Card update?... Nothing should disappear. Everything should have a destination."* Also Ch. 6, ReplyFlow Principle 3: *"Guarantee the Next Step — every interaction should end with the next step being obvious."*

Chosen over the next numbered Master Execution Plan task (4.2, blocked entirely on founder actions from 4.1's NO-GO verdict) and over every pilot-data-gated item in Phase 5, per the roadmap reconsideration the founder approved: this is the one piece of the architecture review that needed no pilot data, no external dependency, and directly implements two independent parts of the handbook.

---

## What this is

A new, **permanent** stage in the Brain's reasoning — `lib/brain/organise.ts` — not a one-off rule bolted onto a page. A stable, extensible rule-list architecture:

```
OrganiseCandidate (real facts) → RULES[] → OrganiseGap | null
```

v1 ships with exactly one rule, per the founder's explicit instruction: a conversation whose real, already-computed goal (`ConversationState.goal` — the same field `generate-reply.ts` already produces every turn, never inferred from text here) has settled on `book_appointment` and isn't abandoned, but has no `work_cards` row for that conversation yet. Future handbook-driven rules get added to the `RULES` array; the module's shape never needs to change to add one.

**What v1 deliberately does not do**, per the founder's explicit constraints:
- No new LLM call — the rule is pure, deterministic TypeScript over facts the caller already has.
- No speculative rules — one rule, chosen because it's a case already known to occur in this product, not a guess.
- No new UI component — the recommendation renders through `components/shared/insight.tsx`'s existing `InsightList`, the same primitive already rendering Brain observations on the Receptionist and Diary pages.
- Never auto-creates a Work Card — the checkpoint only flags; creating one stays the owner's own action, exactly like every other booking-adjacent decision in this product.

## A design decision worth stating plainly

The handbook's instruction was to treat this as "a new permanent stage in the ReplyFlow Brain pipeline." That could mean literally inside `generate-reply.ts`'s per-message function body. It was deliberately built to run instead wherever the Brain gets assembled for display — today, that's Front Desk's own data fetch (`app/(dashboard)/dashboard/page.tsx`).

The reasoning: the rule asks a **state** question ("does a Work Card currently exist for this conversation"), not an **event** question ("did one just get created by this message"). A Work Card can be created, or never created, through paths that have nothing to do with any particular message arriving — the owner creating one manually from the Conversations page, for instance. A check that only ran once, inside the message pipeline, would miss every state change caused by anything else. Evaluating fresh whenever the Brain is built is not just lower-risk (it never touches the adversarially-tested reply-generation pipeline at all) — it's more *correct*, because it always reflects the conversation's true current state regardless of what caused it to change.

`generate-reply.ts` was not touched. The 18-scenario adversarial regression suite was run anyway, given `lib/brain` is a real dependency of that pipeline (the Readiness Gate check) — 0 failures, confirming the change is genuinely inert there (the pipeline never supplies `organise` input, so `topOrganiseGap` is always `undefined` on that path).

## How it integrates

- **`lib/brain/reasoning.ts`** — `BrainInput` gained an optional `organise?: { candidates: OrganiseCandidate[] }` field. `buildBrain()` calls `runOrganiseCheckpoint()` and, if a gap exists, adds one `Observation` (capped to the single top gap, same discipline as every other observation in this file — one calm thing at a time, never a list). Priority 2, ranked just below a real waiting customer and just above an abstract teaching gap: a concrete thing to organise about a conversation that already happened is more actionable than not yet knowing a house rule.
- **`app/(dashboard)/dashboard/page.tsx`** — gained one new lightweight query (`work_cards.select("conversation_id")`, existence only, no other columns) and extended the existing `conversationById` map with `impliesBooking`, derived from data already fetched. Zero new per-conversation queries.
- **Rendering** — `<InsightList observations={brain.observations.filter(o => o.id.startsWith("organise:"))} limit={1} />`, placed at the top of Front Desk's main content, above "Needs your attention." Filtered specifically to organise-sourced observations: unlike Receptionist and Diary, Front Desk already has its own dedicated signals for a waiting customer and today's activity (`TodaysPriorityCard`, `AttentionQueue`) — rendering the Brain's full, unfiltered observation stream there would repeat those, not add to them.

## Verification

- 11 new unit tests (`lib/brain/organise.test.ts`, `lib/brain/reasoning.test.ts`) covering the rule in isolation and its integration into `buildBrain()`'s observation stream and priority ordering — 119 total, 0 failures.
- 18-scenario adversarial reply-engine suite — 0 failures, confirming `generate-reply.ts` is unaffected.
- Verified directly against production: real data for SHABZ currently has zero conversations with a `book_appointment` goal, so the section correctly renders nothing — confirmed by checking the real data first, not assumed. The positive-render path was then verified safely using an already-established internal test conversation ("Test Battery," never a real customer, `ai_state` already `null`, no existing Work Card): its `ai_state` was temporarily set to a real booking-goal shape, the observation rendered exactly as designed ("Test Battery's conversation looks like a booking, but there's no Work Card for it yet," correctly linked), then fully restored to its original `null` value and the restoration itself was re-verified by reading the row back.

## What's deliberately deferred

Every other candidate rule considered during the architecture review — quote-stage gaps, stale follow-ups, unresolved commitments left open — needs real pilot correction/conversation volume to design well, exactly as the founder's roadmap reconsideration concluded. They get added to `RULES` in `lib/brain/organise.ts` when that evidence exists; the stage itself doesn't need to change shape to receive them.
