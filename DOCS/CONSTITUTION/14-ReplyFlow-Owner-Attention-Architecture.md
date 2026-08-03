# 14 — ReplyFlow Owner Attention Architecture

**How ReplyFlow decides whether, when, and how loudly to reach the owner outside the app.** Companion to [10-ReplyFlow-Brain-Architecture.md](10-ReplyFlow-Brain-Architecture.md) (Organise, Brain Loop Stage 7 — the in-app sibling this document extends outward) and [04-Trust-Experience.md](../CONSTITUTION/04-Trust-Experience.md) (Shadowing and the Confidence Timeline, which this document's urgency model reads directly).

**Status: approved (2026-08-02); V1 implemented (2026-08-03).** Written in response to the Pilot Readiness Review's #1 finding: every pilot business runs in Shadowing (doc 04 §5) for the full pilot, meaning 100% of replies need manual approval, and no channel exists today to tell an owner one is waiting outside the app. Approved with one governing refinement: the permanent design describes *attention delivery* — urgency, timing, grouping, interruption policy, delivery intent — never a specific channel. Email is the first real channel implementation reaches for (§6), built via a raw REST call so no channel-specific SDK leaks into the architecture; nothing about that choice is wired into the tiers themselves — `lib/attention/tiering.ts` and `delivery-decision.ts` never reference email.

**V1's honest scope:** implements the full Now/Today tiering, cooldown, quiet-hours, and owner-configured-escalation exception exactly as specified (§2–§4), driven by `app/api/cron/attention/route.ts`. Two real doc-14 sources are deliberately **not yet wired in** — Organise gaps and pending Learning proposals (§1's table) — to keep the cron tick's per-business query cost small while the core pending-reply pipeline proves itself; a natural, explicitly-flagged fast-follow, not a silent gap. The Digest tier (§3) is not built at all yet — only Now/Today, which is what the pilot's mandatory-manual-approval mode actually requires. "Now" remains, honestly, not yet a true interrupt guarantee (§6) — email is the only channel.

**A second, real limitation discovered at deploy time, not designed for:** Vercel's Hobby plan (production's current plan) restricts cron jobs to once per day — a 15-minute tick, the original build target, fails outright at deploy time on this plan. The cron currently runs once daily (`vercel.json`, `0 8 * * *`). This materially weakens the "Now" tier's own promise: an escalation-flagged reply can wait up to a day for its email, not minutes — genuinely undermines §0's governing law for the one tier that most needs to keep it. This is the same class of gap as the Supabase-Free backup/recovery limitation (`ReplyFlow-Operations-Blueprint.md` §9): a real, plan-tier constraint, not something engineering can build around, honestly named rather than quietly accepted. **Upgrading to Vercel Pro (which allows minute-level cron schedules) is a founder operational decision, the same category as SUPPORT_EMAIL/ADMIN_EMAILS/RESEND_API_KEY** — recommended before the pilot begins if same-day urgency for escalation-flagged replies genuinely matters, which the Pilot Readiness Review's own ranking says it does.

**The Founder Handbook is the authority this document answers to.** Primary source: the North Star (`01-Vision.md`, *"the owner should never wonder what ReplyFlow is doing... every interruption must earn the owner's attention... interruption volume is a product metric to actively minimise"*), Ch.06 Principle 6 (*"Quiet Intelligence Is Better Than Visible Intelligence"*), Ch.06 Principle 7 (*"Simplicity Is a Sign of Maturity... more intelligence should mean fewer interruptions... the product should become calmer over time, not busier"*), Ch.10 (*"notify the owner"* / *"prepare an approval"* as named Decision Step 3 outcomes).

---

## 0. The governing law

> **A notification is a promise that this is worth the owner's attention right now. Every one that isn't breaks that promise a little, for the next one too.**

This is the North Star's interruption-volume principle, restated for a channel the owner can't simply close the way they can close a tab. Getting this wrong here is more expensive than getting it wrong in-app: an owner who mutes ReplyFlow's texts after a noisy first week has withdrawn something that's much harder to earn back than a dismissed banner. Every decision below is in service of one sentence: **the owner should never have to wonder whether ReplyFlow needs them, and should never feel pinged for something that didn't.**

### The permanent principle: notify about responsibility, not activity

> **ReplyFlow should interrupt the owner because something genuinely requires their attention — never simply because something happened.**

A message arriving, a draft generating, a fact being learned: all real, all true, none of them on their own a reason to reach outside the app. Only a genuine transfer of responsibility to the owner — something only they can decide, approve, or unblock — earns that. This is the test every category, tier, and rule below is built to enforce mechanically, not just assert: §2 draws the responsibility/activity line explicitly; §3's "Digest" tier exists specifically to hold everything that's merely activity; §4's cooldown and suppression rules exist so that even genuine responsibility doesn't get reported more times than it's genuinely true. A future notification that can't be traced back to a real, specific piece of responsibility the owner now holds should not be built, regardless of how easy or informative it would be to send.

---

## 1. This is a delivery layer, not a second "what matters" system

The Front Desk Attention Queue (`lib/front-desk-signals.ts`, `buildAttentionQueue`) and the Organise Checkpoint (`lib/brain/organise.ts`, Brain Loop Stage 7) already answer "what needs the owner" for the moment the owner *is* looking at ReplyFlow — urgency-sorted, already grouped, already distinguishing a confirmed fact from a routine wait. Per the standing instruction to favour existing architecture over inventing new systems, **this document does not define a second taxonomy of what matters.** It defines what happens to an item that already exists in that model when the owner is *not* looking: does it also leave the app, at what tier, with what delivery intent, grouped with what else.

Every attention-worthy situation named below already has a real, computed source in the codebase — nothing here invents a new signal:

| Source (already built) | What it already computes |
|---|---|
| `reply_drafts` (`status = 'pending'`) | A draft awaiting approval — the dominant case during Shadowing |
| `evaluateSafety()` → `requires_escalation` | Whether a specific draft is emergency/complaint/pricing-flagged (Decision Categories) |
| `buildAttentionQueue` / `isUrgent` | The existing emergency-vs-routine split, and the existing per-conversation grouping (`groupPendingRepliesByConversation`) |
| `runOrganiseCheckpoint` | A confirmed-fact gap (a booking with no Work Card; a message that got no reply at all) |
| `learning_proposals` (`status = 'pending'`) | A learning proposal awaiting the owner's confirm/ignore/clarify/defer |
| `describeConnectionHealth` | WhatsApp connection expiring or expired |
| Doc 04 §5, §6 | The first live customer message; the first real booking — one-time, named moments, not recurring alerts |

---

## 2. What deserves the owner's attention

Two axes, not one list — collapsing them is exactly how a system ends up either too noisy or too quiet:

- **Does this need the owner to *do* something**, or is it something they'd want to *know*? An unapproved draft blocks a real customer; a first booking doesn't need anyone to act on it.
- **Is this a confirmed fact, or a routine, expected state?** The Organise Checkpoint already drew this line for in-app surfacing (its own docstring: *"a confirmed fact needs no pilot evidence... a business-process recommendation needs real evidence first"*) — the same line governs whether something leaves the app at all. A routine pending draft during Shadowing is expected, not a confirmed problem; a WhatsApp token that's actually expired is a confirmed fact that customers are currently unreachable.

Four resulting categories:

1. **Action-needed, urgent** — an escalation-flagged draft (emergency/complaint/pricing), or a confirmed customer-facing outage (WhatsApp expired, a real pipeline failure that produced zero reply). The owner must do something, and the cost of a delay is real and immediate.
2. **Action-needed, routine** — an ordinary pending draft during Shadowing, an Organise gap, a learning proposal. The owner must eventually do something, but nothing breaks if it waits a few hours.
3. **FYI, rare and deliberate** — the first live customer message, the first real booking (doc 04 §5–§6). No action required; these exist because doc 04 already decided they deserve a named moment, not because they're informative.
4. **FYI, routine** — general activity, trust ticking upward, a quiet day. Never pushed on their own — this is digest material only, per §5.

Category 4 is named explicitly so it's clear what's *excluded*: this is activity, not responsibility, and per §0's permanent principle, activity alone is never a reason to reach outside the app. This is the direct, mechanical answer to Principle 6 — most of what ReplyFlow does should stay invisible until asked.

---

## 3. Immediate vs. later — three tiers, not a per-item judgement call

| Tier | Maps to | Behaviour |
|---|---|---|
| **Now** | Action-needed, urgent (§2.1) | Delivered as soon as it's known, with the most interrupt-capable delivery intent available (§6). Ignores batching. Only crosses a quiet-hours window when the owner's own configured escalation rules say this specific situation is always urgent (§4, rule 4) — being "Now" alone is not sufficient to wake someone at 2am. |
| **Today** | Action-needed, routine (§2.2) | Batched (§5) into at most a small, bounded number of nudges across a working day — never one per item. Respects quiet hours. |
| **Digest** | FYI, rare (§2.3, handled as a one-off, not a digest item) and FYI, routine (§2.4) | The rare moments (first customer, first booking) fire once, on their own, exactly as doc 04 specifies — they are not digest material, they're single, deliberate messages. Routine FYI material only ever appears inside a periodic (daily, at most) summary, never its own alert. |

This is the same urgency split `isUrgent()` already makes in `front-desk-signals.ts` (emergency/escalation vs. everything else), extended with a third state for the material that shouldn't interrupt the owner *at all* outside a digest.

---

## 4. Avoiding noise — the mechanisms, not just the intent

Five concrete rules, each one closing a specific way this could go wrong:

1. **Tiering (§3) is the first filter.** Most of what ReplyFlow ever notices never leaves the "Digest" tier. Only a confirmed, urgent, action-needed fact reaches "Now."
2. **A cooldown per business, not per item.** Once a "Today"-tier item triggers a nudge, no second nudge fires for that business until a bounded window has passed (a working-day-shaped window, not a fixed number of minutes) — anything new that arrives inside that window joins the *same* pending nudge rather than firing its own. This is what stops three customers messaging in twenty minutes from becoming three pings.
3. **Suppression on resolution.** If the owner opens the app and clears the queue before a scheduled nudge or digest fires, that scheduled message shrinks to match what's still actually true, or doesn't fire at all if nothing's left. A notification must never claim something is still waiting once it isn't.
4. **Quiet hours, crossed only by the owner's own configured rules — never by an internal tier alone.** "Today"-tier nudges respect a sensible working-hours window (configurable per business, defaulting to a reasonable trade-day). Being classified "Now" is necessary but not sufficient to cross that boundary: the exception is scoped to situations the owner has *themselves* told ReplyFlow are always urgent — the real, existing escalation rules already taught on the Receptionist page ("when should I stop and come get you," `escalation_rules` / `ESCALATION_OPTIONS`, e.g. "gas smells always come straight to you"). A customer message that lands in one of the owner's own configured emergency categories crosses quiet hours; a "Now"-tier item that's confirmed and urgent but not something the owner specifically flagged this way (a WhatsApp connection expiring, for instance) stays "Now" for immediacy *once checked*, but does not itself justify waking someone at 2am — it waits for the quiet-hours window to end, same as "Today." This keeps the exception grounded in Principle 5 (the owner always has authority, including authority over what counts as urgent enough to interrupt) rather than in an architecture-internal label deciding it on the owner's behalf.
5. **Volume decays as trust grows — by construction, not by a separate rule.** A category sitting at Trusted or Autonomous on the Confidence Timeline (doc 04 §7) generates materially fewer action-needed items in the first place, because fewer of its drafts wait on approval at all. This document doesn't need its own decay logic — it inherits Principle 7's *"more intelligence should mean fewer interruptions"* directly from the Trust Ladder already doing its job. Worth stating explicitly so a future reader doesn't go looking for a volume-control knob that doesn't need to exist separately.

---

## 5. Grouping — one message per business, never one per item

Two grouping precedents already exist and this document extends both outward rather than replacing them:

- **Within a conversation:** `groupPendingRepliesByConversation` already collapses several pending drafts from the same customer into one row with a count. A "Today" nudge inherits this directly — "3 replies waiting" reads as one fact about one conversation, not three.
- **Within a business:** `buildAttentionQueue` already merges different *kinds* of item (pending replies, draft Work Cards, waiting conversations) into one urgency-sorted list. The external nudge does the same — a single message per business per tier-triggering event: *"2 replies waiting, one of them urgent"* rather than two separate messages.

The rule this generalises to: **the unit of delivery is the business's current queue state, not the individual event that changed it.** An event doesn't send a message; it updates a pending notification state, and that state is what eventually gets delivered, following §4's cooldown and suppression rules.

---

## 6. Delivery intent — channel-independent, permanently

The Constitution defines *intent*, never a specific channel. This is the one section most likely to otherwise drift into naming a vendor, so it's worth being explicit: nothing below should ever need to change because a channel was added, replaced, or removed. Two delivery intents, not two channels:

- **Interrupt-capable delivery** — required by the "Now" tier. Whatever channel is used must have a real chance of being seen within minutes, not hours, regardless of which real channel that turns out to be.
- **Glanceable delivery** — sufficient for "Today" and "Digest." Checked periodically, not instantly; doesn't need to interrupt anything.

A channel is only ever described by which intent(s) it can satisfy — never referenced by name in the tier definitions (§3) or the noise-control rules (§4). This is what lets a future channel be added by implementing one adapter, not by revising this document.

**Implementation starting point (mutable — not part of the permanent architecture):** email is the first real channel built, because it satisfies glanceable delivery cheaply and universally, with no new account, app, or phone number required. Email does **not** reliably satisfy interrupt-capable delivery for someone up a ladder — this is a real, honestly-named gap, not a rounding error: **until a genuinely interrupt-capable channel exists, "Now"-tier items are delivered via the best glanceable channel available, with the tier's own timing and grouping rules still fully honoured (no batching, no unauthorised quiet-hours suppression) — the promise the tier makes is about immediacy and specificity, not yet about medium.** Standing up a true interrupt-capable channel (SMS, push, a phone call) is real infrastructure and should follow the Pilot Plan's own operating law — earned by real evidence that email genuinely gets missed for a real "Now" event, not built ahead of that evidence.

WhatsApp-to-owner (the business's own connected number, used to message the owner) was considered and set aside — it mixes a customer-facing channel with an internal one, and the "who is this message actually from" clarity that matters so much to a business's own customers (doc 04 §0) applies in reverse here too. Not ruled out permanently as a future interrupt-capable channel; not the pilot-scale starting point.

---

## 7. What this explicitly does not do

- **Does not lower the bar Shadowing already sets.** No notification tier, however calm, is a substitute for the owner actually reviewing a draft before it sends — this document is about *telling* the owner something is waiting, never about deciding on their behalf. Doc 04 §5's "strictly manual, no exceptions" is untouched.
- **Does not introduce a settings surface beyond what's honest today.** The existing `SettingsNotifications` toggles are correctly labelled "Coming soon" because nothing delivers yet (`components/dashboard/settings-notifications.tsx`). Once a real channel exists, the toggle should control *that* real thing — not ship as a togglable promise ahead of the delivery actually working, the same discipline that produced the honest "Coming soon" label in the first place.
- **Does not build a general-purpose notification/preferences platform.** No per-item-type opt-out matrix, no multi-channel preference centre. That's exactly the kind of premature abstraction this project's own engineering discipline already rejects — tiers and a cooldown are enough to be calm at pilot scale; a richer preference system only earns its place once real pilot feedback asks for one.

---

## 8. Concepts this document introduces

- **Notify about responsibility, not activity** (§0) — the permanent principle every other concept below exists to enforce mechanically: an interruption must be traceable to a real, specific piece of responsibility now sitting with the owner, never merely to something having happened.
- **The delivery layer / attention model split** — this document governs *whether an already-known attention item leaves the app*, never *what counts as an attention item* (§1). Keeps one taxonomy, not two.
- **Four attention categories** (§2) — action-needed vs. FYI, crossed with confirmed-fact vs. routine — replacing any temptation to score or rank notifications individually.
- **Three delivery tiers: Now / Today / Digest** (§3), with cooldown, suppression, and quiet-hours rules (§4) as the concrete mechanism behind the North Star's interruption-volume principle, not just a restatement of it.
- **The business-level delivery unit** (§5) — a nudge represents a business's current queue state, never a single event.
- **Delivery intent, channel-independent, permanently** (§6) — the architecture defines interrupt-capable vs. glanceable delivery, never a named channel; a future channel is a new adapter, never a document revision. Named honestly: "Now" isn't a true interrupt guarantee until a genuinely interrupt-capable channel exists, rather than letting the tier's name imply a guarantee the pilot-scale build doesn't yet keep.
- **Quiet hours crossed only by owner-configured authority** (§4, rule 4) — an internal urgency label is never, on its own, sufficient reason to interrupt outside the owner's own working hours; only the owner's own configured escalation rules can authorise that, directly extending Principle 5.

---

## 9. How to use this document

Before building any part of this, check it against two things, in order: §0's permanent principle first — can this notification be traced to real responsibility now sitting with the owner, or is it merely reporting that something happened? — then the governing question: does this specific notification earn the owner's attention right now? If either answer is no, it belongs in the Digest tier or not at all, regardless of how easy or informative it would be to send immediately. Implementation should follow the tier boundaries, grouping rules, and channel-independence of §6 exactly as specified here; where a real build decision isn't covered above (exact cooldown window length, exact quiet-hours default), it should be picked conservatively — fewer interruptions, not more — and named explicitly as a tunable default rather than a permanent architectural choice.
