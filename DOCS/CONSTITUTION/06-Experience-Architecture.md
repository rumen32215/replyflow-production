# 06 — Experience Architecture

**The actual screens, and what each one has to answer.** Document 05 is the feeling; this is the concrete structure that produces it — the information architecture, the missing concepts, and the reframe each existing screen needs. Everything here is measured against one rule:

> If a screen cannot answer its one question within five seconds, it is wrong.

Not "wrong eventually." Wrong today, regardless of how much real data is on it. A screen with twelve accurate facts and no clear answer has failed the same way a screen with one invented fact has failed — it has made the owner do the work ReplyFlow exists to do for them.

---

## 1. Front Desk — from dashboard to office — implemented (Owner Experience 01)

**Built.** The codebase-level split this section originally described — two pages, one nav-labelled "Front Desk" (calm, single-priority) and one literally named `mission-control` (broader, operational, not nav-visible) — is gone. There is now one real Front Desk at `/dashboard`; `mission-control` is a redirect, kept only so a bookmarked link never 404s. That split was real duplication (three of its four top-line numbers were independently computed twice) rather than two genuinely different concerns, so unifying them was the actual fix, not a compromise between them.

**What it answers today, in the same order this section specified:**
1. **Needs Your Attention** — one urgency-sorted queue (never several competing lists): waiting conversations, draft Work Cards, and pending AI-drafted replies, merged. Emergencies (a linked conversation's real Conversation State goal — never inferred from text) and escalations sort first; everything else by how long it's actually been waiting.
2. **Receptionist Activity** — real, timestamped events ("Booked X for tomorrow at 9:00," "Escalated: gas leak reported") — the "reporting in" framing this section called for, built from `lib/front-desk-signals.ts`'s `buildReceptionistActivity`, never a generated summary.
3. **Today's Work** — every Work Card scheduled today, each with a real state (Booked / Waiting for address / Needs approval / Emergency / Customer replied), not a bare status word.
4. **Waiting For Customer** and **Recently Completed** round out the picture — what's confirmed and ahead, what's actually finished.

**Cut, as specified:** "Business Health" as owner-facing language is gone entirely — no tile grid anywhere on the page. The counts it used to show now live implicitly in each section's own count (e.g. "Needs your attention (3)"), never a separate block competing for attention.

**Approvals — done, see §7:** the dedicated queue §7 called for now exists at `/dashboard/approvals`, reusing this section's own attention queue completely unchanged. Front Desk's own heading here is honest about its interruption-budget cap now too — it shows the real total (never silently understating it once more than 8 things are pending) with a "See all" link into the full list.

---

## 2. Work Cards — the biggest missing concept in the product

**Retired term:** this section used to be called "Jobs & Work Cards." "Job" is retired — see `DOCS/SPECS/Work-Card-Object.md` for why, and for the complete object definition (every field, where it comes from, what's automatic versus owner-entered, what's live versus history). That document is now the source of truth for this concept; this section stays as the short version and the pointer to it.

**Shipped (Master Execution Plan 2.1):** the dedicated page exists — `/dashboard/work-cards/[id]` — with every field below except Photos. The gap this section originally described (no address, no parking notes, no access notes, a booking that was only a title/status/date) is closed; only the media-storage prerequisite for Photos remains genuinely open, tracked separately.

**The concept:** everything a technician needs to walk out the door, assembled automatically, never re-typed:

- **Customer** — name, relationship history at a glance
- **Address** — tap for navigation, not a copyable string
- **Phone** — tap to call
- **Problem summary** — in plain language, not the raw transcript
- **Conversation summary** — three sentences, not a thread to scroll
- **Photos** — surfaced here, not buried in Conversations
- **Appointment time and status**, always in sync with the Diary (§3)
- **Collected details** — parking, access, anything volunteered mid-conversation. This is exactly what the Commitments ledger (document 03) already captures — Work Cards are the first real *use* of that data, not new plumbing.

**The test:** could a technician who has never touched ReplyFlow walk out the door with only this screen open and do the job competently? If not, it's missing something. Every other section below assumes Jobs exist as a real object — Front Desk, Diary, and Customers are all currently pointing at something thin.

---

## 3. Diary — a working day, not a calendar

A calendar answers "what's on this date." A diary answers "what does my day look like, and has anything changed since I last checked." Today is not just another row — it's the only row that matters until it's over.

**What it should answer:** Where am I today, in order (a sequence of Work Cards, not a grid)? Where am I tomorrow (present, quieter)? What changed — a reschedule, a cancellation — surfaced explicitly, never something the owner has to notice by comparing against memory? What's delayed, with an easy way to push the rest of the day back in one motion? What's waiting for confirmation, visibly distinct from confirmed? What's already finished, kept visible as the day's evidence?

**Shipped (Master Execution Plan 2.2):** investigation confirmed the existing "Your hours" page already satisfied the framing half of this section — chip-based, conversational, zero calendar-grid feel. What it never had was real content: a real Today/Tomorrow sequence of Work Cards, in order, each with real state, now sits alongside the existing availability rules — reusing Front Desk's own query pattern and its `TodaysWork` component rather than building a second way to ask the same question. "Waiting for confirmation vs. confirmed" and "already finished, kept visible" come for free from the existing Work Card state labeling. **Deliberately not built:** explicit change/diff tracking against a previous state, and bulk "push the rest of the day back" rescheduling — both are genuinely separate, bigger features with no supporting infrastructure today, not required by this task's actual success criteria (a real, live sequence replacing a static grid).

---

## 4. Customers — a person your receptionist already knows

**Shipped (Master Execution Plan 2.3).** Investigation before implementation found this section itself was stale: the list view was never actually a placeholder by the time 2.3 started — a real, complete implementation (search, filters, relationship strength, a genuinely honest empty state) had already shipped in a later sprint than this document's last update. Corrected here rather than left uncorrected, and nothing rebuilt.

**What was genuinely missing, now added:** outstanding work (a card of real, currently-active Work Cards for this customer), previous quotations (real `estimated_value` data that existed but was never fetched or shown on this page), and a real communication-preference field (one nullable column, owner-entered free text, deliberately not a structured dropdown — matching "we are not a CRM"). **FAQs answered specifically for this customer** remains a real, un-scoped gap — named here in the original audit but never actually part of the Master Execution Plan's 2.3 objective, so it wasn't built; flagged for a future task if it's ever prioritised, not silently dropped.

**The reframe, verified rather than assumed:** the page should read like the sentence a good receptionist would actually say handing over the phone — "This is Dave, had us out twice, always pays on the day, still waiting on a bathroom price" — not four panels to mentally assemble. Confirmed directly against real production screenshots after adding the three new fields: the communication preference sits inside the existing summary sentence, not as a separate settings field, and both new cards match the existing "Service history" card's own visual pattern exactly.

---

## 5. Receptionist — training, not settings

Already correctly reframed — an explicit "teaching playground," already the post-onboarding landing point. Endorse and finish, don't rebuild.

**Still missing:** why each question matters, stated in-page next to the field, not just a label. And visible improvement over time — a short, honest "she's gotten better at X" sourced from real correction history, never invented. This depends on the correction/learning loop described in document 07, which is currently the least mature part of the whole pipeline — this specific improvement can't ship honestly before that exists.

---

## 6. Knowledge — reconciling input and output

Two real pages already do real jobs but their relationship isn't obvious: `business` holds what the owner taught — the input. `everything-i-know` shows confidence, gaps, and recent changes — the output.

**Don't merge them** — the distinction is real. Make the relationship explicit instead: **Knowledge** is one nav destination that opens on the confidence view (because "what does she know" is the actual question an owner asks), with teaching one tap away from any gap it identifies.

---

## 7. Approvals — the missing dedicated queue — implemented (Master Execution Plan 2.4)

No page used to show every pending decision across the business in one place — approval only happened inline, one conversation at a time, with Front Desk showing an aggregate count but no way to act on it directly.

This is the interruption-budget principle (document 01) made literal: **the fewer things land here, the better the product is working.** A long queue isn't a sign this page needs better design — it's a signal the receptionist isn't yet trusted with enough, and should point the owner toward autonomy expansion (document 08), not toward a better inbox. Each item carries the same Work-Card discipline as §2 — full context to decide in one glance, never a bare message requiring the owner to go find the conversation to understand what's even being asked.

**Built.** `/dashboard/approvals` reuses `buildAttentionQueue()`/`AttentionQueue` from §1 completely unchanged, with its own independent, uncapped data fetch (deliberately not shared with Front Desk's own query, so nothing on this page can affect what Front Desk shows). One deliberate deviation from this section's original phrasing, stated plainly rather than silently: Approvals is **always** in the nav, not shown only when non-empty. A nav item that vanishes is a location the owner can never actually learn — the "fewer things land here" signal is instead carried by a real pending-count badge (computed once in the dashboard layout, shared by the nav badge, Front Desk's own heading, and this page's total, so all three always agree), which simply isn't there when the count is zero.

---

## 8. Onboarding — the concrete sequence

Document 04 designs the emotional experience of Introduction and Proof in full depth. This section is the structural sequence they sit inside:

**Welcome → Teach your receptionist → Meet your receptionist → Test real conversations → See exactly how she behaves → Gain confidence → Connect WhatsApp → Approval mode → Gradually increase autonomy**

The load-bearing structural change: **Test real conversations** and **See exactly how she behaves** sit *before* WhatsApp connection, not after — proof before permission (document 02, Principle 6). Concretely, this needs a real, working chat interface running the actual reply engine, not a preview or a mockup — the same pipeline validated throughout this product's testing sprints, now surfaced to the owner instead of only to engineering.

**Approval mode** as an explicit, named stage — not just a default setting — matters structurally too: the owner should be told plainly, "everything goes through you for now, and here's what will change and when," so the ceiling on autonomy reads as a deliberate, temporary choice, not a limitation to be discovered later in settings.

---

## 9. Information architecture — every nav item, one question each

| Nav item | The one question | Current reality | Verdict |
|---|---|---|---|
| **Front Desk** | What do I need to know right now? | Rebuilt as one unified page (§1) | Done — Owner Experience 01 |
| **Work Cards** | What work do I have? | Detail page built (§2); no nav destination yet, deliberately | Done for now — nav list only if a real need emerges |
| **Diary** | Where am I going? | Real schedule + rules, both conversational (§3) | Done |
| **Customers** | Who are these people? | List and detail both real and complete (§4) | Done |
| **Receptionist** | What have I taught her? | Exists, already well-framed | Keep, extend (§5) |
| **Knowledge** | What does she know? | Exists as two pages, relationship unclear | Keep both, connect them (§6) |
| **Approvals** | What needs my judgement? | Dedicated queue, always in nav, real pending-count badge (§7) | Done — Master Execution Plan 2.4 |
| **Settings** | How does my business operate? | Exists, not in main nav | Keep out of primary nav |

**Two legacy stubs worth a formal removal pass:** `business-profile` and `ai-receptionist` are dead pages that only redirect to their real counterparts (`business` and `receptionist`). Costs nothing functionally, but every lingering redirect is a small tax on anyone reading the codebase — worth cleaning up once nothing external still links to the old URLs.

**On the eight-item nav:** eight is more than the "four things, always visible" the sidebar was originally built around. Not every item needs equal permanence — Front Desk, Jobs, Diary, and Approvals are the four an owner needs open constantly; Customers, Receptionist, Knowledge, and Settings are visited with intent, not glanced at. Approvals shipped always-visible with a count badge rather than the "only when non-empty" wording originally here — see §7 for why. The nav should reflect that weight difference.

---

## 10. Missing concepts — the complete list

1. ~~**Work Cards (page and object)**~~ — shipped (Master Execution Plan 2.1), object fully specified in `DOCS/SPECS/Work-Card-Object.md`.
2. ~~**Approvals (dedicated queue)**~~ — shipped (Master Execution Plan 2.4, §7).
3. **Handover ("Meet Your Receptionist")** — fully designed in document 04, not yet built.
4. **Test conversations in onboarding** — fully designed in document 04, not yet built.
5. **Customer communication preferences and previous quotations** — no data home currently exists (§4).
6. **"What changed" as an explicit diary signal** — today's diary shows state, not change (§3).
7. **Visible receptionist improvement over time** — blocked on the correction/learning loop (document 07) not existing yet (§5).

---

## 11. What this document is not

Not a set of wireframes. Not a component spec. Not a commitment to build all of this at once — document 08 exists specifically so it doesn't have to be. What it is: the answer to "what should ReplyFlow feel like to run a business on," concrete enough to build from, honest about what doesn't exist yet.
