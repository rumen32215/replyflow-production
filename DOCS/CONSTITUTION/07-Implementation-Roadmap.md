# 07 — Implementation Roadmap

**What gets built next, in what order, and why.** Ordered by dependency, not difficulty. Every item states why it exists, which principles (document 01) it supports, what it depends on, and what it unlocks afterward. This is the one document in this folder written to be re-read before every sprint, not read once.

**Status: the two-track structure below is formally adopted, not proposed.** Track A and Track B now run in parallel, by decision — this document no longer argues for that; it records it and tracks what each one needs next.

---

## Two parallel tracks

- **Track A — Trust.** Mission: earn the owner's confidence before asking for responsibility. Everything from the landing page through onboarding, Meet Your Receptionist, Test Conversations, Shadowing, the first live customer, and confidence growth belongs here. **Success metric: a business owner feels completely comfortable connecting their WhatsApp.**
- **Track B — Owner Experience.** Mission: reduce cognitive load during daily operation. Work Cards, Front Desk, Diary, Customers, and Approvals belong here. **Success metric: the owner immediately understands what's happening in their business every time they open ReplyFlow.**

They don't block each other because they touch different parts of the system — Track A runs on data and pipeline that already exist today; Track B is downstream of one new object (the Work Card, see `DOCS/SPECS/Work-Card-Object.md`). A business that signs up tomorrow goes through onboarding *today's* way regardless of how far Track B has progressed — that asymmetry is why both start now, together, not sequentially.

**Immediate priority:** implementation planning for Work Cards (Track B) and experience-to-implementation planning for Trust (Track A) are both underway now, in parallel. Neither gets built blindly — see the two living spec documents in `DOCS/SPECS/` for the detail this roadmap deliberately doesn't carry.

---

## Track A — Trust

### A1. Handover ("Meet Your Receptionist")
**Why it exists:** the highest-leverage trust moment in the entire journey, fully designed in document 03 §2. A presentation of data that already exists — everything taught so far — not new capability.
**Principles supported:** 1, 2, 6.
**Depends on:** nothing beyond what already exists (teaching data, the receptionist's own voice).
**Unlocks:** A2 flows directly from it in the same session.

### A2. Test Conversations
**Why it exists:** the second-highest-leverage trust moment, designed in full in document 03 §4. Needs a real, safe sandbox around the existing reply pipeline so test messages never touch production conversation data.
**Principles supported:** 1, 6, 7 — this is where the owner sees deterministic-vs-judgement in action for the first time, via "The Why."
**Depends on:** A1 (the natural entry point), and the existing reply pipeline (already built, already adversarially tested).
**Unlocks:** A3.

### A3. Onboarding reorder
**Why it exists:** the current sequence asks for WhatsApp before showing any proof. A sequencing change, not a new capability.
**Principles supported:** 1, 6.
**Depends on:** A1 and A2 existing — there's nothing to reorder onboarding *around* until they do.
**Unlocks:** the full Confidence Timeline (document 03 §7) becomes a real, owner-visible feature, because Shadowing and Observed now have real onboarding stages feeding into them.

---

## Track B — Owner Experience

### B1. Work Cards
**Why it exists:** once the receptionist books a job, the owner needs somewhere for it to become real work. There is no dedicated page for this anywhere in the product today, and the underlying data model has no address, parking notes, access notes, or photo storage — not enough to send a technician to a stranger's house. **This item now explicitly includes the terminology decision to retire "Job" in favour of "Work Card" as the product's primary concept — see `DOCS/SPECS/Work-Card-Object.md`, which defines the object completely before any screen gets designed around it.**
**Principles supported:** 4 (think less — a technician should never have to reconstruct a job from a WhatsApp thread), 9 (protects the owner's reputation — the technician shows up prepared).
**Depends on:** nothing. The one genuinely foundational item in this track.
**Unlocks:** B2, B3, and materially enriches B4 and B5. Front Desk, Diary, and Customers are all currently pointing at a thin data model — this is what makes them real.

### B2. Front Desk retone
**Why it exists:** the current screen already has the right data; it doesn't yet read like an office, it reads like a report.
**Principles supported:** 3, 4, 5.
**Depends on:** B1 — "today's work" needs real Work Cards to summarise, not thin rows.
**Unlocks:** the daily "Routine" feeling described in document 04 §2 becomes buildable, not just describable.

### B3. Diary reframe
**Why it exists:** a calendar answers "what's on this date." An owner needs "what does my day look like, and what changed since I checked." The diary is *made of* Work Cards.
**Principles supported:** 4, 5.
**Depends on:** B1.
**Unlocks:** the "what changed" signal (document 05 §3) — impossible to build honestly against thin job rows.

### B4. Customers completion
**Why it exists:** the detail page is already strong; the list is a placeholder, and three real fields (outstanding work, communication preferences, previous quotations) have no home yet.
**Principles supported:** 2, 4.
**Depends on:** nothing structurally — outstanding work reads from the Commitments ledger (document 02), which already exists. Enriched by B1, not blocked by it.
**Unlocks:** nothing downstream. Rounds out an already-functional experience rather than fixing a broken one.

### B5. Approvals queue
**Why it exists:** no page currently shows every pending decision across the business in one place.
**Principles supported:** 5, 6.
**Depends on:** nothing structurally — better with B1, functional without it.
**Unlocks:** queue length becomes legible evidence feeding Track A's Confidence Timeline.

---

## After both tracks: autonomy expansion

### C1. Widen auto-send beyond the current single category
**Why it exists:** the product currently trusts itself with one narrow category. Real evidence, not optimism, should decide when that widens.
**Principles supported:** 6, 8.
**Depends on:** Track A (specifically A3) having shipped and run long enough in real use to produce genuine per-category evidence — the one item in this document that cannot be accelerated by engineering effort. It waits on time and evidence, not code.
**Unlocks:** the Autonomous stage of the Confidence Timeline becomes something businesses actually reach, not just a documented concept.

---

## Lower-priority, independent items

Don't block either track and aren't blocked by them — do these opportunistically.

- **Knowledge page relationship** (document 05 §6) — presentation-only, low cost.
- **Receptionist "why it matters" copy** (document 05 §5) — presentation-only, cheap.
- **Legacy redirect cleanup** — `business-profile` and `ai-receptionist` stub removal. Trivial, zero risk.
- **The correction/learning loop** (document 06 §6) — genuinely valuable; nothing above is blocked on it except one sub-feature (visible receptionist improvement over time).
- **Business Personality data shape** (document 06 §6) — needs a design decision before it needs engineering.

---

## Decisions on record

**On screens that should disappear:** nothing currently live should be removed outright. The two legacy redirect stubs already function as retired; formalising that is cleanup, not a design decision. The inline, per-conversation approval flow stays once the Approvals queue (B5) ships — they serve different moments, both legitimate.

**On Front Desk changing because Work Cards now exist:** it should, specifically in one place — "what does my day look like" points at thin rows today and will point at real Work Card summaries once B1 ships.

**On "Job" versus "Work Card":** retired as of this sprint. Job described a record; Work Card describes what it actually is — everything a technician needs to walk out the door prepared. The full reasoning and scope of the rename lives in `DOCS/SPECS/Work-Card-Object.md`.

---

## How to use this document

Every sprint should answer one question before anything else: **does this make ReplyFlow feel more like the receptionist and workplace already designed** — not "does it add another feature." Before starting a sprint, find it here. If it isn't here, ask why before building it. If it's here but a sprint wants to build it out of order, check the dependency stated above first — that's a real decision, not a default.
