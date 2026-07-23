# The Work Card Object

**Implementation planning, not a page design.** Per the roadmap (`DOCS/CONSTITUTION/07`), no screen gets designed until this object feels complete. This document is a living spec — expected to change as building proceeds — unlike the permanent philosophy in `DOCS/CONSTITUTION/`.

---

## 0. Job → Work Card — the rename, and why it's real, not cosmetic

"Job" is the word tradespeople already use for the work itself — the boiler swap, the leak. ReplyFlow isn't storing that. It's doing something adjacent and more specific: **preparing a technician to walk out the door and do that job competently, without having to reconstruct anything from a WhatsApp thread.** That's a different object than "a job" — it's the briefing, the docket, the thing a good receptionist would have handwritten and clipped to a clipboard. "Work Card" says that. "Job" doesn't.

This is adopted as the primary concept **everywhere** — product language, navigation, and the underlying implementation. Renaming it now, before the redesigned object is built on top of it, is materially cheaper than renaming it after Front Desk, Diary, and Customers all come to depend on the old name (document 07, Track B). Concretely, this means:

- The database table, its columns, and every route/query that references "job" should be renamed as part of building this object — not left as an internal name with "Work Card" only as a UI label painted over it. A name that's wrong in the schema but right on screen is a debt, not a decision.
- `jobs.job_title` becomes something closer to `work_cards.issue` (see the field table below — "title" was always really standing in for the diagnosed problem).
- The `jobs.status` enum, the approve/reject flow, and every current consumer (Mission Control, Customer detail, `conversation-story.tsx`) get updated together, in the same piece of work — this is a rename sprint, not a UI relabel.

Nothing about the actual booking/approval workflow changes because of this rename. Only the name and the shape of the object it names.

---

## 1. What a Work Card actually is

Everything a technician needs to walk out the door and do the job competently, assembled automatically from what the receptionist already learned, never re-typed by the owner. The test for completeness: **could a technician who has never touched ReplyFlow do the job correctly with only this screen open?** If not, something's missing.

A Work Card can come from two different origins, and the object has to honestly support both:
- **Conversation-born** — created from a real WhatsApp conversation the receptionist handled. Most fields start as her draft.
- **Owner-created** — a walk-in, a phone call, a referral with no conversation behind it. No `conversation_id`, and every field is owner-entered from the start; nothing here is invented for a Work Card that has no conversation to ground it in.

---

## 2. Every field, where it comes from, and what state it's in

| Field | What it is | Source | Owner-editable? | Live or history? |
|---|---|---|---|---|
| Customer name | Who the job is for | Conversation (WhatsApp profile / given name) or owner-entered | Yes | Always relevant |
| Customer phone | Tap-to-call | Conversation (WhatsApp number) or owner-entered | Rarely | Always relevant |
| Address | Tap-to-navigate | Conversation — extracted as a slot, **never trusted un-confirmed** | **Owner must confirm before Booked** | Live until job ends |
| Issue (was "job title") | The diagnosed problem, plain language | Receptionist-drafted, from the Conversation State `issue` slot | Yes | Live, then frozen into history at completion |
| Conversation summary | Three sentences, not a thread to scroll | Receptionist-drafted, generated once from real message history | Yes | Live while ongoing; fixed once completed |
| Photos | Whatever the customer sent | Automatic — pulled from the conversation's media messages | Curate only (remove, never add fake ones) | Live, then archived with the record |
| Collected details (parking, access, anything volunteered) | Everything a real receptionist would have written on a docket | Automatic — the Commitments ledger's `customer_fact` entries (document 02) | Yes, and can add more before dispatch | Live until job ends |
| Appointment time | When the technician goes | Receptionist-proposed, from the `preferredTime` slot | **Owner confirms/adjusts** | Live until the appointment passes |
| Status | Where this Work Card is in its lifecycle | **Deterministic, system-derived — never AI-decided** | Owner/technician actions drive it | The field that defines live vs. history |
| Estimated value | What this is likely worth | **Owner-entered only** | Yes | Live, then part of history |
| Notes | Anything not captured elsewhere | Owner-entered | Yes | Live, then part of history |
| Relationship context (e.g. "2 prior jobs") | Is this a returning customer | **Not stored on the card** — computed live from Customer Memory (document 02) | N/A | Always fresh, never stale |
| Created via | Conversation or manual | System metadata, set once at creation | No | Permanent record |
| Approved by / when | Audit trail | System metadata | No | Permanent record |
| Completed at / completion note | What actually happened | Owner/technician, at close-out | Yes, once | Becomes history the moment it's set |

### The three-way split the brief asked for directly

- **Collected automatically:** conversation-derived customer name/phone, the proposed address and appointment time (pre-confirmation), the issue and conversation summary, photos, parking/access details.
- **Owner-entered, always:** estimated value, notes, completion details, and the final confirmation of anything the receptionist only proposed (address, time).
- **From the receptionist specifically:** issue, conversation summary, the proposed (not confirmed) address and time, and the collected-details ledger — everything downstream of Conversation State, none of it authoritative until the owner has seen it.

---

## 3. The one hard rule: price is never her territory

Consistent with the very first grounding principle this whole product was built around (`DOCS/CONSTITUTION/06` §1) — pricing is never automatic, never proposed by the model, never even drafted as a suggestion on a Work Card. `estimated_value` is owner-entered or it's empty. This isn't a gap to fill later; it's a deliberate, permanent boundary.

---

## 4. Live versus history, as one clean rule

A Work Card is **live** from creation until it reaches a terminal status (`completed` or `cancelled`). Live Work Cards are what Front Desk and the Diary are built from (document 07, B2/B3). The moment a Work Card goes terminal, it becomes **history** — it stops appearing on the active surfaces and becomes part of the Customer's record instead (document 05 §4), fully intact, never deleted, just no longer competing for the owner's daily attention. This is the same discipline as the Approvals queue (document 05 §7): the active surface should only ever show what's actually still open.

---

## 5. What this unlocks, and the two decisions that were open here

This definition is what B2 (Front Desk), B3 (Diary), and B4 (Customers) in the roadmap have been waiting on. Two things this document originally left open as genuine product decisions — both resolved by the owner before implementation:

1. **Address confirmation UX — resolved: soft warning, never a hard blocker.** A Work Card can be booked with `address_confirmed = false`. Owner and receptionist both see it flagged (⚠ Address incomplete); nothing blocks the booking itself. The owner's reasoning: a real receptionist can say "I don't yet have the full address — I'll need that before the visit" and still book the appointment. Blocking completely would create unnecessary friction that doesn't match how a real receptionist works. Implemented in migration `0013_work_cards.sql` (`address_confirmed boolean not null default false`).
2. **The existing `status` enum — resolved: kept as-is, not collapsed.** All nine values (`draft`, `new_enquiry`, `quote_requested`, `quote_sent`, `quote_accepted`, `booked`, `in_progress`, `completed`, `cancelled`) remain unchanged. The owner's reasoning: changing status values ripples through a lot of code, and there's already enough architectural change happening with the Work Card rename itself. Only worth simplifying later if implementation proves it's genuinely improving the product — not because a smaller enum looks cleaner on paper.

## 6. What's implemented so far

The object, schema, relationships, and the automatic-field pipeline are built (migration `0013_work_cards.sql`, `lib/work-card.ts`, wired into `components/dashboard/conversations/conversation-story.tsx` and `app/api/work-cards/[id]/approve/route.ts`). Not yet built, deliberately — this was schema/pipeline work, not a screen: a UI for the new fields (address, collected details, conversation summary) beyond their existing prefill into the issue field; Photos (§2) — the `messages` table has no media/attachment storage at all yet, so this needs its own decision before it can be implemented, not a guess bolted onto this pass; Front Desk, Diary, and Customers actually reading from the new fields (B2–B4, still to come).
