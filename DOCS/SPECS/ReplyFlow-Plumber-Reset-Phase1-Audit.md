# ReplyFlow — Plumber-First Product Reset: Phase 1 Audit

**Date:** 2026-08-14
**Scope:** Full codebase audit (schema, AI pipeline, UI/navigation, photo intelligence) against the new product definition: *"ReplyFlow takes care of your plumbing customers while you get on with the job."*
**Method:** Every finding below is grounded in the live codebase (migrations 0001–0032, the full inbound-to-outbound reply pipeline, all dashboard screens, the job-docs/photo pipeline). Old CONSTITUTION/SPECS docs were read only for comparison, never as current-state truth, per instruction — several of them turn out to describe a system that isn't actually wired up live (see §6).

---

## 1. What ReplyFlow actually is today

WhatsApp webhook → `conversations`/`messages` (permanent, one row per phone number) → a `conversation_episode` (one row per *job*, correctly scoped so old jobs don't pollute new ones) carrying real structured turn-state (`stage`, `slots`, `openQuestion`, `goal`, `commitments`, `urgency`) → LLM classify + fact-grounded generate → a deterministic safety/category gate → almost always held in `reply_drafts` for the owner to approve manually, with a narrow auto-send path for plain greetings/FAQs only.

`work_cards` is the real job object (issue, address, status, schedule). `job_docs` is a derived customer-facing report, meant to be generated from a completed Work Card. `lib/brain/*` sounds like the reasoning engine but mostly isn't — the real brain is `lib/reply-engine/*`.

## 2. KEEP — already good, don't touch

- **The episode state machine** (`conversation_episodes.ai_state`: stage/slots/openQuestion/goal/commitments/urgency, carried and corrected turn-by-turn). This is real, structured, persistent conversation understanding — the opposite of keyword-detect-and-forget. It's the right seed for the "journey stage" model the brief asks for.
- **Deterministic safety/category gate** (`decision-categories.ts`) — EMERGENCY/COMPLAINT are hard-forced to escalate and can't be overridden by a conflicting model output (a real production bug fix already proves this).
- **Fact-grounded, citation-required prompting** (`facts_used`) — the large prompt is mostly *behavioral* rules in prose (reasonable), not a substitute for missing state.
- **`job_doc_fields` provenance system** (`user_fact`/`ai_structured`/`ai_suggestion`/`missing` + confidence) — genuinely good, reusable evidence architecture, recently hardened. Reuse it, don't replace it.
- **`banned-patterns.ts`** scrub-to-blank backstop on report/photo text — solid defense in depth.
- **`lib/availability.ts`** — real, deterministic day-level diary logic grounded in actual stored business hours. Not invented by the LLM.
- **Plumber-only onboarding + landing page** — already shipped (`ONBOARDING_TRADES = ["plumbing"]`, hero copy is "For UK plumbers," a prior 5-trade rotation was deliberately removed 2026-08-11). Items 1 and 22 of your brief are already done in the live code.
- **Work Card → Job Record as a derived-report relationship** (migration 0030) — correct direction, mostly correctly wired, just not fully finished (see §3).
- **Front Desk home dashboard** — genuinely well-composed, urgency-ordered, ~17 queries collapsed into one coherent "what needs me" screen.

## 3. The real problems (root causes, not symptoms)

### 3.1 No real customer identity — REBUILD
There is no `customers` table. "Customer" is reconstructed live by matching `work_cards.customer_name` to `conversations.customer_name` **by string equality**, and that name comes straight off WhatsApp's mutable profile-name field. If a returning customer's WhatsApp name differs, is blank, or she messages from a different number, the match silently misses and she's treated as new. This is the exact, specific root cause behind your "Hi mate, it's Sarah again" test case. What memory does exist is one sentence ("X completed jobs, most recent...") — not prior problems, quotes, addresses, or preferences.

### 3.2 No real booking system — REBUILD
There is no appointments/bookings table anywhere. `work_cards.scheduled_for` is a single nullable timestamp with no slot duration, no conflict detection, and nothing the AI can call. The model is explicitly instructed it "cannot itself cancel, reschedule, or confirm a booking." Every booking today is a manual owner click (`saveJob()` in the Conversations UI) — the AI can *describe* real availability (day-level only, no time slots exist anywhere in the app) but can never *act* on it. This is the precise, confirmed root cause of "I'll check availability and nothing happens."

### 3.3 Autonomy is one global on/off switch, not a trust model — CHANGE
Only one category ("general" = greetings/FAQ/status checks) is eligible for auto-send, gated by a single business-wide boolean (`ai_configurations.auto_reply_general_enabled`). Every booking, pricing, cancellation, payment, or returning-problem reply is *always* drafted for manual approval, regardless of how confident the model is. Worth knowing: your own old Trust Architecture doc (CONSTITUTION 11) already specifies exactly the granular per-decision-type authority ladder you're now asking for — it was designed and never built. This isn't a new idea, it's a known, already-scoped gap.

### 3.4 Four different status vocabularies for "where's this job at" — MERGE/REBUILD
`conversations.status`, `conversation_episodes.status`, `work_cards.status`, `job_docs.status` — four separate, differently-shaped lifecycles for what a plumber experiences as one thing.

### 3.5 Job Record still has two unreconciled creation paths — REMOVE
`/dashboard/job-records/new` is a standalone manual creation form with no required Work Card link, directly contradicting the "Job Record is a derived report" model the rest of the product (including its own list-page copy) now states. Already a known, still-live gap.

### 3.6 Job Record data is physically duplicated, not live-linked — CHANGE
`job_docs` has its own `customer_name`/`job_address`/`job_date` columns, seeded once from the Work Card at creation and never resynced. Correct an address on the Work Card after the report exists, and the report silently goes stale.

### 3.7 Two independent photo-analysis pipelines — MERGE
`conversation_photos` (WhatsApp-inbound, lenient, rejects an honestly-empty result as a parse failure) and `job_doc_photos` (plumber-uploaded inside a Job Record, stricter prompt, treats empty as a valid outcome) are structurally near-identical but separately built, in separate storage buckets. They're bridged only by a one-time, best-effort byte-copy at Job Record creation that **reuses the looser analysis rather than rerunning the stricter one**, and only fires once — any photo a customer sends *after* the Job Record exists is never auto-attached.

### 3.8 `lib/brain/*` is mostly stub/dashboard code, not the live reasoning engine — REBUILD or rename
Only one boolean (`readyToActAlone`) from `lib/brain` is used in the live message pipeline. `recordCorrection`/`recordOutcome` literally `throw` ("not implemented"). The real reasoning lives entirely in `lib/reply-engine`. Your own CONSTITUTION doc 10 claims a "9-stage Brain Loop, 8/9 implemented" — that claim is **not true of the live pipeline** and should be discarded, not trusted, going forward.

### 3.9 No function/tool-calling capability at all — the root architectural gap
`getCompletion` is a plain chat completion with a JSON response schema — no tool use anywhere. This is the underlying cause of §3.2. To the existing code's credit, the prompt already explicitly forbids the model from claiming an action it can't back — so today's failure mode is "can't act," not "lies about acting," which is a better starting point than it sounds. But it blocks the entire booking/action promise in your brief until real tool-calling exists.

### 3.10 Secondary findings
- **Approvals page** duplicates Front Desk's own attention queue (same three data sources, one capped, one not) — MERGE/REMOVE candidate once autonomy expands.
- **"Hours" screen** is a rules editor, not a bookable calendar — ties directly to §3.2.
- **`lib/trades.ts`** still carries full 8-trade branching (services, access-suggestions) even though onboarding is UI-restricted to plumbing only — dead weight, REMOVE down to plumbing-only.

## 4. Overlap verdicts

| Pair | Verdict | Why |
|---|---|---|
| Customer vs Conversation | **Keep as two views, fix underneath** | Not duplicated data — same `conversations` row shown two ways (memory/history vs live chat). Defensible split. But it needs a real `customers` table underneath instead of name-matching. |
| Work Card vs Job Record | **Keep distinct, tighten** | Correctly different concepts (operational object vs generated document) but weakly enforced — dual creation paths, physically duplicated fields. |
| Approvals vs Front Desk queue | **Merge** | Same signal, redundant screen. |
| `conversation_photos` vs `job_doc_photos` | **Merge** | Same shape, two systems, bridged by a lossy one-time copy. |

## 5. Source of truth (current → proposed)

| Concept | Today | Proposed |
|---|---|---|
| Customer identity | None — reconstructed from `conversations` + name-matching | Real `customers` table, phone-keyed |
| Conversation/message | `conversations` + `messages` | Unchanged — sound |
| Job | `work_cards` | Unchanged as the one true job object; `job_docs` becomes a live-computed view, not a duplicated row |
| Booking | None — `work_cards.scheduled_for` only | Real `bookings` table, slot-level, tied to a job |
| Availability (capacity) | `businesses.availability` (weekly rules) | Keep as input; add a real slot-conflict check against `bookings` |
| Photos | Two tables, one-time copy bridge | One pipeline, one table, keyed to the job from the moment a photo arrives |

## 6. A flag on the old docs

CONSTITUTION doc 10 ("Brain Architecture") asserts most of what you're now asking me to build is already implemented. It isn't, live. Doc 11 ("Trust Architecture") already designed the graduated autonomy model you want in §8 of your brief — also never built. Treat every "Implemented" claim in the old docs as unverified until cross-checked against actual code, exactly as you instructed.

## 7. Proposed target architecture (preview only — not yet approved to build)

- **Customer** (new) — identity, phone, addresses, preferences, notes. Primary anchor for memory.
- **Job** (= today's `work_cards`, one status vocabulary) — owns the conversation link, booking, photos, and report fields.
- **Booking** (new) — slot-level appointment on a Job, checked against business availability and other bookings.
- **Conversation/Episode** — unchanged good architecture, extended with real tool-calling (`check_availability`, `create_booking`, `attach_photo`, `escalate_to_owner`) and real customer-memory context.
- **Report** — a live, computed view over a Job's own fields/photos, not a separately-duplicated row set. *(Flagging this now: this is the single biggest engineering bet in the whole reset and needs its own scoped design pass before touching — not a simple merge.)*
- **Autonomy** — extend the existing `decision-categories.ts` (it already does real deterministic category/risk classification) into the four-tier model from your brief (SAFE / NEEDS_DECISION / NEEDS_PHYSICAL_ACTION / HIGH_RISK), rather than building a new system.
- **Navigation** — collapse toward Home / Customers / Conversations / Jobs; fold Approvals into Home; keep WhatsApp/Receptionist/Settings as secondary config surfaces (open question whether Receptionist and Settings should merge — Phase 4 call).

## 8. Open calls that are genuinely yours to make before Phase 2

1. Job/Report merge mechanics — biggest single bet, needs its own design pass.
2. Bookings table shape — slot duration model, conflict rules, how far ahead it looks.
3. Customer table migration plan for existing `conversations`/`work_cards` data — must be additive, non-destructive.
4. `lib/brain/*` fate — rebuild it into the real reasoning layer, or retire the stub and treat `reply-engine` as the brain under a clearer name.
