# 05 — Experience Architecture

**The actual screens, and what each one has to answer.** Document 04 is the feeling; this is the concrete structure that produces it — the information architecture, the missing concepts, and the reframe each existing screen needs. Everything here is measured against one rule:

> If a screen cannot answer its one question within five seconds, it is wrong.

Not "wrong eventually." Wrong today, regardless of how much real data is on it. A screen with twelve accurate facts and no clear answer has failed the same way a screen with one invented fact has failed — it has made the owner do the work ReplyFlow exists to do for them.

---

## 1. Front Desk — from dashboard to office

**What exists today:** real bones (`mission-control` in the codebase, nav-labelled "Front Desk" — the folder name is a leftover from before that rename) — an operational overview, urgent work, active conversations/today's jobs, waiting-customer stats, a "business health" breakdown, recent activity. What it isn't yet is *alive.*

**The reframe:** stop building a dashboard — something you *analyse*. Build an office — a place you *walk into.* "3 conversations open" is a dashboard. "You're mid-conversation with two customers, and one of them is waiting on you specifically" is an office. Same fact, completely different cognitive load.

**What it should answer, in order of urgency:**
1. Is anything actually wrong right now? If yes, this is the only thing visible above the fold. If no, say so plainly — "Nothing needs you right now" is a complete, valuable answer.
2. What has she done since I last looked? — phrased as a person reporting in, not a log: "Booked 2 jobs, answered 11 questions, flagged 1 for you." The Learn → Work → Escalate → Improve loop (document 00), finally shipped as the primary surface rather than a secondary card.
3. What does my day look like? — today's jobs, in order, each answerable at a glance (§2).
4. What's waiting on me specifically? — the Approvals queue (§6), framed as "your decisions," not "pending items."

**What to cut:** "Business Health" as owner-facing language — it reads like a report to interpret. Fold its real signal into the narrative above rather than keeping it as a competing block.

---

## 2. Work Cards — the biggest missing concept in the product

**Retired term:** this section used to be called "Jobs & Work Cards." "Job" is retired — see `DOCS/SPECS/Work-Card-Object.md` for why, and for the complete object definition (every field, where it comes from, what's automatic versus owner-entered, what's live versus history). That document is now the source of truth for this concept; this section stays as the short version and the pointer to it.

**The gap, stated plainly:** there is no dedicated Work Cards page anywhere in ReplyFlow today, and the underlying data model has no address, no parking notes, no access notes, no photo storage. A booking today is a title, a status, a date. That is not enough to send a technician to a stranger's house.

**The concept:** everything a technician needs to walk out the door, assembled automatically, never re-typed:

- **Customer** — name, relationship history at a glance
- **Address** — tap for navigation, not a copyable string
- **Phone** — tap to call
- **Problem summary** — in plain language, not the raw transcript
- **Conversation summary** — three sentences, not a thread to scroll
- **Photos** — surfaced here, not buried in Conversations
- **Appointment time and status**, always in sync with the Diary (§3)
- **Collected details** — parking, access, anything volunteered mid-conversation. This is exactly what the Commitments ledger (document 02) already captures — Work Cards are the first real *use* of that data, not new plumbing.

**The test:** could a technician who has never touched ReplyFlow walk out the door with only this screen open and do the job competently? If not, it's missing something. Every other section below assumes Jobs exist as a real object — Front Desk, Diary, and Customers are all currently pointing at something thin.

---

## 3. Diary — a working day, not a calendar

A calendar answers "what's on this date." A diary answers "what does my day look like, and has anything changed since I last checked." Today is not just another row — it's the only row that matters until it's over.

**What it should answer:** Where am I today, in order (a sequence of Work Cards, not a grid)? Where am I tomorrow (present, quieter)? What changed — a reschedule, a cancellation — surfaced explicitly, never something the owner has to notice by comparing against memory? What's delayed, with an easy way to push the rest of the day back in one motion? What's waiting for confirmation, visibly distinct from confirmed? What's already finished, kept visible as the day's evidence?

---

## 4. Customers — a person your receptionist already knows

**What already exists:** the detail page is further along than the rest of the app — a relationship overview, a timeline, an AI insights panel. The list view is currently just an empty-state placeholder; the real list lives elsewhere, not obviously connected to it.

**Missing:** outstanding work (an unresolved quote, an open "let me check and come back to you" — a direct expression of the Commitments ledger, scoped to one customer instead of one conversation), communication preferences as a real field, previous quotations (no data home currently exists), and FAQs answered specifically for this customer.

**The reframe:** the page should read like the sentence a good receptionist would actually say handing over the phone — "This is Dave, had us out twice, always pays on the day, still waiting on a bathroom price" — not four panels to mentally assemble.

---

## 5. Receptionist — training, not settings

Already correctly reframed — an explicit "teaching playground," already the post-onboarding landing point. Endorse and finish, don't rebuild.

**Still missing:** why each question matters, stated in-page next to the field, not just a label. And visible improvement over time — a short, honest "she's gotten better at X" sourced from real correction history, never invented. This depends on the correction/learning loop described in document 06, which is currently the least mature part of the whole pipeline — this specific improvement can't ship honestly before that exists.

---

## 6. Knowledge — reconciling input and output

Two real pages already do real jobs but their relationship isn't obvious: `business` holds what the owner taught — the input. `everything-i-know` shows confidence, gaps, and recent changes — the output.

**Don't merge them** — the distinction is real. Make the relationship explicit instead: **Knowledge** is one nav destination that opens on the confidence view (because "what does she know" is the actual question an owner asks), with teaching one tap away from any gap it identifies.

---

## 7. Approvals — the missing dedicated queue

No page currently shows every pending decision across the business in one place — approval only happens inline, one conversation at a time, with Front Desk showing an aggregate count but no way to act on it directly.

This is the interruption-budget principle (document 00) made literal: **the fewer things land here, the better the product is working.** A long queue isn't a sign this page needs better design — it's a signal the receptionist isn't yet trusted with enough, and should point the owner toward autonomy expansion (document 07), not toward a better inbox. Each item should carry the same Work-Card discipline as §2 — full context to decide in one glance, never a bare message requiring the owner to go find the conversation to understand what's even being asked.

---

## 8. Onboarding — the concrete sequence

Document 03 designs the emotional experience of Introduction and Proof in full depth. This section is the structural sequence they sit inside:

**Welcome → Teach your receptionist → Meet your receptionist → Test real conversations → See exactly how she behaves → Gain confidence → Connect WhatsApp → Approval mode → Gradually increase autonomy**

The load-bearing structural change: **Test real conversations** and **See exactly how she behaves** sit *before* WhatsApp connection, not after — proof before permission (document 01, Principle 6). Concretely, this needs a real, working chat interface running the actual reply engine, not a preview or a mockup — the same pipeline validated throughout this product's testing sprints, now surfaced to the owner instead of only to engineering.

**Approval mode** as an explicit, named stage — not just a default setting — matters structurally too: the owner should be told plainly, "everything goes through you for now, and here's what will change and when," so the ceiling on autonomy reads as a deliberate, temporary choice, not a limitation to be discovered later in settings.

---

## 9. Information architecture — every nav item, one question each

| Nav item | The one question | Current reality | Verdict |
|---|---|---|---|
| **Front Desk** | What do I need to know right now? | Exists, strong bones, too analytical in tone | Keep, reframe tone (§1) |
| **Work Cards** | What work do I have? | Doesn't exist; data model too thin | **Build** — highest-impact gap (§2) |
| **Diary** | Where am I going? | Exists, calendar-shaped | Keep plumbing, redesign framing (§3) |
| **Customers** | Who are these people? | Detail page strong, list is a placeholder | Fix the list, extend the detail (§4) |
| **Receptionist** | What have I taught her? | Exists, already well-framed | Keep, extend (§5) |
| **Knowledge** | What does she know? | Exists as two pages, relationship unclear | Keep both, connect them (§6) |
| **Approvals** | What needs my judgement? | Doesn't exist; only inline | **Build** (§7) |
| **Settings** | How does my business operate? | Exists, not in main nav | Keep out of primary nav |

**Two legacy stubs worth a formal removal pass:** `business-profile` and `ai-receptionist` are dead pages that only redirect to their real counterparts (`business` and `receptionist`). Costs nothing functionally, but every lingering redirect is a small tax on anyone reading the codebase — worth cleaning up once nothing external still links to the old URLs.

**On the eight-item nav:** eight is more than the "four things, always visible" the sidebar was originally built around. Not every item needs equal permanence — Front Desk, Jobs, Diary, and Approvals are the four an owner needs open constantly (Approvals only when non-empty); Customers, Receptionist, Knowledge, and Settings are visited with intent, not glanced at. The nav should reflect that weight difference.

---

## 10. Missing concepts — the complete list

1. **Work Cards (page and object)** — doesn't exist. The single biggest gap (§2), now fully specified in `DOCS/SPECS/Work-Card-Object.md`.
2. **Approvals (dedicated queue)** — doesn't exist (§7).
3. **Handover ("Meet Your Receptionist")** — fully designed in document 03, not yet built.
4. **Test conversations in onboarding** — fully designed in document 03, not yet built.
5. **Customer communication preferences and previous quotations** — no data home currently exists (§4).
6. **"What changed" as an explicit diary signal** — today's diary shows state, not change (§3).
7. **Visible receptionist improvement over time** — blocked on the correction/learning loop (document 06) not existing yet (§5).

---

## 11. What this document is not

Not a set of wireframes. Not a component spec. Not a commitment to build all of this at once — document 07 exists specifically so it doesn't have to be. What it is: the answer to "what should ReplyFlow feel like to run a business on," concrete enough to build from, honest about what doesn't exist yet.
