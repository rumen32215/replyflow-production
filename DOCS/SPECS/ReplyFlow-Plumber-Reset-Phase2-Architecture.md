# ReplyFlow — Plumber Reset: Phase 2 Architecture Specification

**Date:** 2026-08-14
**Status:** Architecture decision document. No code changed, no migration run, nothing deployed, nothing committed.
**Builds on:** `DOCS/SPECS/ReplyFlow-Plumber-Reset-Phase1-Audit.md`
**Instruction followed:** design what ReplyFlow should be first, then map the current codebase onto it. Old CONSTITUTION/SPECS docs are not authoritative where they conflict with the live implementation audited in Phase 1.

---

## 1. Executive architecture decision

Four decisions, stated plainly, then justified in the sections below:

1. **Job absorbs Work Card. "Job Record" stops existing as a separate persisted entity.** There is one canonical row per real-world job. The report is a *generated view* over that row, not a second row that can drift from it.
2. **A real `customers` table, phone-anchored, becomes the identity backbone.** Name-matching is retired.
3. **A real `bookings` table and a small, deterministic slot-conflict engine get built.** Not a calendar product — just enough scheduling truth that "book me in tomorrow morning" can become a real, confirmed appointment without a human doing the arithmetic.
4. **The brain gets a decide-and-act step with real tool-calling, sitting on top of the state machine that already exists.** Autonomy becomes a small number of deterministic, owner-configurable tiers extending the safety gate that's already in the codebase — not a new trust system, and not a black box.

Everything else in this document is the detail behind those four calls.

## 2. Product definition

**ReplyFlow is the AI operating system for a plumber's customer communication, bookings, jobs and workday.**

In practice that means five things ReplyFlow must do, every time, without being asked twice:

- **Understand** — know who's messaging, what they need, and what's already been said.
- **Remember** — recognise a returning customer and their history, reliably, not by luck of a matching name string.
- **Act** — actually check availability and actually create a booking, not just describe what it would do.
- **Protect the plumber's time** — only interrupt them when their judgement, approval, or hands are genuinely required.
- **Prove the work** — turn what already happened in the conversation and on site into a report, without the plumber reconstructing it from memory.

Every architectural decision below is judged against these five, not against "does this reduce the number of tables."

## 3. Canonical entities

| Entity | Table (proposed) | Owns |
|---|---|---|
| **Business** | `businesses` (unchanged) | Profile, hours, availability rules, knowledge |
| **Customer** | `customers` (new) | Identity, phone, default address, preferences, owner notes |
| **Conversation** | `conversations` (unchanged, gains `customer_id`) | The permanent WhatsApp thread |
| **ConversationEpisode** | `conversation_episodes` (unchanged) | One bounded conversational arc — the "journey" state machine |
| **Job** | `work_cards`, extended (absorbs `job_docs`) | The single canonical job: issue, address, status, report status, links to booking/photos/fields |
| **Booking** | `bookings` (new) | A slot-level appointment tied to a Job |
| **JobField** | `job_doc_fields`, re-anchored to `job_id` | Provenance-tracked structured facts about the job (unchanged mechanism, renamed home) |
| **JobPhoto** | merge of `conversation_photos` + `job_doc_photos` | Every photo evidence item for the job, one pipeline |
| **PendingAction** | `reply_drafts`, extended | Not just a drafted reply — a drafted *action* (send message, confirm booking, etc.) awaiting owner decision when the trust tier requires it |
| **AIConfiguration** | `ai_configurations`, extended | Business rules, tone/style, per-action-type autonomy toggles |

**What owns what, explicitly (per your Phase 1 question):**
- Conversation is owned by the phone number, forever.
- Episode is owned by one bounded arc of that conversation (one job's worth of back-and-forth).
- Job is owned by the Customer, and is the parent of everything else: photos, fields, the current booking, report status.
- Booking is owned by the Job (a job can have a history of bookings — reschedules — but one *current* one).
- The report has no owner of its own. It's a rendering of the Job.

**What the plumber sees:** Customers, Conversations, Jobs. That's it. "Work Card" and "Job Record" disappear as user-facing nouns — a plumber never again has to decide which one something belongs in.

**What's generated automatically:** the Job's report content (from JobFields + JobPhotos + the conversation), the customer's relationship summary, booking-confirmation messages.

**What disappears from the UI:** the separate Job Records list/detail screens, the standalone "New Job Record" flow, the Approvals page as an independent screen.

## 4. Canonical customer journey

```
NEW ENQUIRY
  → UNDERSTAND PROBLEM
  → GATHER ESSENTIALS (address, access, urgency — only what's missing)
  → PHOTO EVIDENCE (if it would help; never demanded if not needed)
  → ASSESS URGENCY
  → CHECK AVAILABILITY
  → PROPOSE SLOT
  → CUSTOMER CONFIRMS
  → [OWNER DECISION — only if the trust tier requires it]
  → BOOKING CONFIRMED → customer notified automatically
  → JOB IN PROGRESS (plumber marks it, or it's inferred from the booking window passing)
  → WORK COMPLETED
  → REPORT GENERATED
  → FOLLOW-UP / CLOSE
```

This is close to your sketch, with two deliberate changes: **"gather essentials" replaces a fixed field list** (the model asks for what's *actually missing* against the Job's current fields, never a script), and **the owner-decision step is conditional**, not a fixed gate — most bookings should never need it once trust is established.

This journey is tracked at two altitudes, on purpose:
- **Episode `ai_state.stage`** (existing: understand → diagnose → collect → quote_or_book → confirm → waiting → completed → closed) drives conversational nuance turn-by-turn. Keep it — it already works.
- **`Job.job_status`** (enquiry → booked → in_progress → completed → cancelled) is the coarse, plumber-facing status. It's driven *by* the episode/booking events, not tracked independently.

This is the resolution to the "four status vocabularies" problem: two axes survive (conversation-arc stage, and job lifecycle status), because they're genuinely different facts, not duplicates. `report_status` (not_generated → draft → approved → exported) is a third, clearly separate axis — "is the paperwork done" is not the same fact as "is the job done," and a plumber understands that distinction instinctively.

## 5. Conversation brain architecture

Today's pipeline (Phase 1 audit): **classify → generate text → safety-gate the text → send-or-hold.** The gap is that "generate" only ever produces words, never actions.

**New shape:** classify → **resolve context (customer + job)** → **decide** (what, if anything, should happen — reply only, reply + tool call, or escalate) → **act** (execute the tool, for real, server-side-validated) → generate the natural-language reply *grounded in what actually happened* → safety/tier-gate the resulting action → send-or-hold → persist state.

The critical discipline carried forward from the current codebase (this is already good, keep it): **the model is never allowed to claim an action happened unless a tool actually performed it and returned a real result.** Today this is enforced by telling the model it *can't* act. Going forward it's enforced by giving the model real tools and requiring it to cite the tool result, the same way it's already required to cite facts.

**Tone vs. logic (your §5):** business logic (what's allowed, what needs escalation, what a booking actually requires) stays fully deterministic, in code. Tone is the one genuinely configurable layer — captured at onboarding as a style choice (professional / friendly / casual / direct / concise) plus an optional short "here's how I talk to customers" example, stored on `ai_configurations`, and applied only to *how* the grounded content is phrased, never to *what* is said or decided. This is a thin addition to `prompt/build.ts`, not a new system.

## 6. Tool/action architecture

Minimum viable set for Phase 2 — six tools, not sixteen. Each one is chosen because it's the smallest unit that lets the brain *act* rather than *describe*:

| Tool | Replaces/removes need for |
|---|---|
| `get_customer_context(phone)` | Combines get_customer + get_customer_history + get_job into one fetch — these are always needed together, so one round trip |
| `create_or_update_job(fields)` | create_job + update_job + update_job_notes — one idempotent upsert against the episode's current Job |
| `check_availability(date_range, duration)` | Wraps the existing deterministic day-level diary logic, extended with real slot/conflict checking against `bookings` |
| `create_booking(job_id, slot)` | Also covers "propose booking times" — availability check already returns proposable slots, no separate tool needed |
| `update_booking(booking_id, action)` | Covers reschedule and cancel — one tool, an action parameter, not four tools |
| `escalate_to_owner(reason, summary)` | The explicit "I need you" signal, always logged with why |

**Deliberately not tools, and why:**
- `attach_photo` / `analyse_photo` — photo arrival is event-driven (a WhatsApp media message), not a conversational decision. This stays pipeline automation, exactly as today, just unified onto one photo table (§11).
- `generate_report` — owner-triggered from the UI, not something the live conversation ever needs to decide to do.
- `send_message` — the reply-generation step's normal output *is* the outbound message. A separate tool would be redundant.

## 7. Autonomy / trust model

The existing `decision-categories.ts` already does real, deterministic category classification (EMERGENCY/COMPLAINT always escalate; a narrow "general" category can auto-send). That mechanism is correct — it just needs a second axis (an *action* tier, not just a *send* gate) and needs to cover booking decisions, not only message-send decisions.

**Three tiers, each mapped explicitly, each a deterministic rule — not a learned trust score:**

- **TIER 0 — AUTO.** Plain questions with no commitment attached: "are you open today," "can you send a photo," "what's your callout fee," straightforward status checks. Handled automatically today; unchanged.
- **TIER 1 — AUTO, LOGGED (earn-by-setting, not earn-by-magic).** A booking confirmation where the customer has explicitly accepted a proposed slot, the slot has zero conflicts, and the job isn't flagged urgent/high-risk. Gated by an explicit, owner-set toggle on `ai_configurations` (`auto_confirm_bookings`, same shape as today's existing toggle) — off by default. When on, ReplyFlow completes the booking and tells the owner afterward, not before. This is deliberately a plain setting the plumber controls, not a fuzzy "the AI decided it's earned trust" mechanism — matches your explicit instruction that autonomy must be earned through deterministic rules, not because it sounds impressive.
- **TIER 2 — PREPARE & ASK.** Ambiguous or conflicting slot requests, price/quote questions, reschedule/cancellation of an already-confirmed booking, first-time customer requesting same-day work. ReplyFlow prepares the *decision* ("Book Tuesday 10am for Mrs Smith's leak?") as a one-tap approval, not a block of text to rewrite. This is the direct fix for "the plumber is an editor for a chatbot" — approving a decision is a fundamentally different, much smaller ask than approving a sentence.
- **TIER 3 — OWNER REQUIRED, ALWAYS.** Complaints, emergencies, anything already forced by the existing safety gate, low-confidence/unclear classification. No auto-anything, ever, regardless of any setting. Unchanged from today's behavior — it's already correct.

Reschedule/cancel of a live booking is Tier 2 by default (moving a plumber's day has real cost) — promotable to Tier 1 later only via the same explicit setting mechanism, not a separate decision.

## 8. Customer memory architecture

**`customers`**: `id`, `business_id`, `phone` (unique per business), `name`, `default_address`, `communication_preference`, `notes` (free text, owner-editable), `created_at`, `last_contact_at`.

No separate "facts" or "preferences" table. This deliberately reuses the same provenance discipline already proven in `job_doc_fields` rather than inventing a second memory system:

- **Owner-confirmed** (authoritative): anything the plumber types directly into `notes`, `default_address`, or `communication_preference` via the Customer screen.
- **AI-suggested** (visible, never silently written): a one-line relationship summary computed at read-time from the customer's Job history ("3rd job — last was a radiator repair, 4 months ago"), and an occasional suggested note ("seems to prefer text over calls — inferred from recent messages") that the owner can accept or dismiss, never one that gets written into `notes` on its own. Same "infer to propose, ask to confirm" discipline this codebase already uses for business-rule learning.

**Surfaced in the UI:** contact info, the notes field, the auto-computed relationship line, and a plain list of past jobs (title, date, address). **Stays behind the scenes:** raw message history from other episodes, internal confidence scores.

**"Hi mate, it's Sarah again" now works because:** the phone number resolves directly to one `customers` row. No name matching, no silent misses.

**Migration (additive, non-destructive):**
1. Create `customers`, nullable everywhere except `business_id`/`phone`.
2. Backfill one row per distinct `(business_id, customer_phone)` from `conversations`.
3. Add nullable `customer_id` to `conversations` and `work_cards`; populate from the backfill.
4. New code resolves-or-creates a `customers` row by phone on every inbound message; old name-matching path stays as a fallback until the cutover is verified, then removed in Phase 3 — a code change, not a further migration.

## 9. Booking architecture

**`bookings`**: `id`, `business_id`, `job_id`, `customer_id`, `scheduled_start`, `scheduled_end`, `status` (proposed / confirmed / completed / cancelled), `source` (ai / owner), `reschedule_of_id` (nullable self-FK, keeps history), `created_at`, `confirmed_at`, `cancelled_at`.

`Job` gets one new nullable FK — `next_booking_id` — instead of a duplicated timestamp column. **This is the deliberate fix for the exact data-drift bug found in Phase 1** (`job_docs.job_date` going stale against the Work Card): there is no second "when" value to fall out of sync, ever. Anything that needs to show "when" joins through `next_booking_id`.

**Availability logic (deterministic, not AI-guessed):** reuse the existing day-level `lib/availability.ts` weekly-hours logic unchanged, extended with a real slot layer — a per-business `default_job_duration_minutes` setting (simple, editable, not a per-job-type estimation model), used to generate candidate start times across the working day, minus windows already covered by `bookings` for that day. `check_availability` returns *only* real, currently-open slots — the model never invents one, exactly like today's day-level version already refuses to.

`create_booking` re-validates the requested slot against live conflicts server-side before writing — never trusts the model's claim that a slot is free, the same defense-in-depth discipline already used elsewhere in this codebase (e.g., the Job Record status-gating on "Work Completed").

**Confirmation message** is sent automatically the moment a booking's status flips to `confirmed` — triggered by that event, not by hoping the model remembers to send it in the same turn.

**Explicitly not building:** multi-technician scheduling, travel-time optimization, calendar sync (Google/Outlook), a drag-and-drop calendar UI, recurring/maintenance-plan bookings, a customer-facing self-serve booking portal. ReplyFlow is not becoming a calendar product.

## 10. Job/report architecture

One table, `work_cards` (extended), is the Job. It gains three fields from the old `job_docs`: `report_status`, `customer_id`, `next_booking_id`. Everything else `job_docs` had — the field/photo evidence, the generated document — attaches directly to the Job.

The **report is computed on demand**, not stored as a second row: title/customer/address/date come straight from the Job; findings/work-performed/next-steps come from `JobField` rows (unchanged provenance mechanism, just re-anchored to `job_id`); photos come from the unified `JobPhoto` set. The existing `@react-pdf/renderer` pipeline, `report-document.tsx`, and the PDF download flow are all genuinely good and are kept unchanged in substance — they just render from one live source instead of a seeded-and-detached copy.

`report_status` (not_generated → draft → approved → exported) tracks the *paperwork*; `job_status` (enquiry → booked → in_progress → completed → cancelled) tracks the *job*. The existing status-gating discipline ("Work Completed" content can never appear unless the job is actually marked completed) is preserved exactly as-is — it now reads `job_status` directly off the one canonical row instead of live-fetching a separate table, which is strictly simpler than today, not more complex.

## 11. Photo intelligence architecture

One pipeline, one table (`JobPhoto`, physically a merge of `conversation_photos` and `job_doc_photos`), one analysis standard: **the stricter existing `job_doc_photos` prompt** (no diagnosis, no hazard/compliance claims, empty-is-a-valid-result) becomes the standard used everywhere, including photos analyzed the moment they arrive via WhatsApp. This removes the lenient/strict duplication found in Phase 1 by construction — there's only one prompt left.

A photo is analyzed immediately on arrival and keyed to the current episode. The moment a Job exists for that episode (which, per the journey in §4, is early — as soon as there's a real enquiry), new photos key directly to `job_id`. This closes the Phase 1 gap where photos sent *after* a Job Record existed were never auto-attached — there's no longer a separate "copy photos into the report" step to fall out of sync, because there's only one place a photo ever lives.

Report generation simply reads whichever `JobPhoto` rows belong to the Job — automatic, not a disconnected feature bolted onto the end.

## 12. UI / navigation architecture

Your instinct is correct — **Home, Customers, Conversations, Jobs** — I'm not overriding it, just confirming why it's right: it maps exactly onto the four entities in §3 that a plumber actually thinks in, and nothing else in the current nav survives as a first-class concept once Jobs absorbs Work Cards/Job Records and Approvals folds into Home.

- **Home** — unchanged in spirit (it's already the best-built screen in the product), gains the "needs your decision" queue that used to be the separate Approvals page — Tier 2 pending actions and escalations, ordered by urgency.
- **Customers** — unchanged, now backed by a real table instead of reconstructed conversations.
- **Conversations** — unchanged.
- **Jobs** — one list, one detail page per job, replacing the current split between Work Cards and Job Records. The detail page becomes the single workspace: overview, the linked conversation, photos, and the report — as sections of one screen, not separate pages a plumber has to know exist.
- **Secondary (unchanged position in nav):** Receptionist (AI config), WhatsApp connection, Settings, Hours. Worth a light-touch merge of Receptionist into Settings later (both are rare-visit configuration, not daily-use) — flagged as a Phase 4 polish suggestion, not a Phase 2/3 requirement.

**Removed outright:** the standalone Job Records list/detail/new-record screens, the Approvals page as an independent route.

## 13. Database migration strategy

Production-safe, additive-only, no destructive operations, rollout in dependency order:

| Step | Change | Risk |
|---|---|---|
| 1 | `CREATE TABLE customers` (nullable except business_id/phone) | None — new, empty table |
| 2 | Backfill `customers` from distinct `(business_id, customer_phone)` in `conversations` | Read + insert only |
| 3 | Add nullable `customer_id` to `conversations`, `work_cards`; backfill by phone match | Additive columns |
| 4 | `CREATE TABLE bookings` | None — new, empty table |
| 5 | Add nullable `report_status`, `next_booking_id` to `work_cards` | Additive columns |
| 6 | Add nullable `work_card_id` to `job_doc_fields` and to the photo tables; backfill from the existing `job_docs.work_card_id` join | Additive columns, backfill only |
| 7 | Application code cuts over: reads/writes go through `work_cards`/`customers`/`bookings` directly; `job_docs`, `job_doc_photos`, old name-matching path stop being written to (still readable) | Code change, not a migration |
| 8 | Bake period — confirm nothing still depends on the deprecated tables/columns in production | Verification only |
| 9 | Drop `job_docs`, `job_doc_photos`, the now-unused `conversation_photos` columns, once (8) confirms it's safe | Deferred to a later, explicitly separate cleanup migration — **not part of Phase 2/3** |

The physical table `work_cards` keeps its DB name through this process — a live rename buys nothing functionally and adds needless coordinated-deploy risk. The UI-facing noun is "Job"; the underlying table name is cosmetic and can be revisited later if it ever actually causes engineering confusion.

## 14. Existing code — KEEP / CHANGE / DEPRECATE / REMOVE

**KEEP (proven good, reuse as-is):**
- `conversation_episodes` + `ai_state` state machine, `understanding/*`, `episode.ts`
- `decision-categories.ts` mechanism (extended in place, not replaced)
- The provenance model (`user_fact`/`ai_structured`/`ai_suggestion`/`missing`) — reused for customer memory too
- `banned-patterns.ts`
- `lib/availability.ts` day-level logic (extended with slots, not rebuilt)
- `report-document.tsx` / `@react-pdf/renderer` / PDF download flow
- Front Desk dashboard structure
- Plumber-only onboarding restriction, landing page positioning
- `conversations`/`messages`, `ai_usage_events`, `error_events`, `product_events`, `learning_proposals`

**CHANGE:**
- `work_cards` — extended with `customer_id`/`report_status`/`next_booking_id`
- `reply_drafts` — extended to carry action-type/action-payload, not just text
- `ai_configurations` — add tone/style fields, replace the single toggle with a small set of per-action-type autonomy toggles
- `generate-reply.ts`, `prompt/build.ts`, `prompt/generate.ts` — add the decide/act step and tool-calling
- `context/assemble.ts` — resolve customer via `customers` table, not name-matching
- Work Card detail + Job Record pages/components — merged into one Job workspace
- `conversation_photos` analysis prompt — replaced with the stricter standard everywhere

**DEPRECATE (stop writing to, keep readable, remove in a later cleanup pass):**
- `job_docs`, `job_doc_photos` (superseded by the extended `work_cards` + unified `JobPhoto`)
- `conversations.status` / `conversation_episodes.status` redundancy — episode status becomes the sole pre-booking source of truth
- `/dashboard/job-records/new` manual creation route
- Approvals page as an independent route

**REMOVE LATER (dead or near-dead already, low-risk deletes once verified):**
- `lib/brain/index.ts`'s `recordCorrection`/`recordOutcome` — currently throw "not implemented," genuinely unused; either implement them properly as part of the new tool/action logging in Phase 3, or delete — decide during Phase 3, don't carry dead stubs forward regardless
- `lib/trades.ts` multi-trade branching (`KNOWN_TRADES`, `TRADE_SERVICES`, `ACCESS_EXTRA_BY_TRADE` beyond plumbing) — collapse to plumbing-only; first verify no live non-plumbing business rows exist in production before deleting the branching outright

## 15. What we are deliberately NOT building

- A fully autonomous AI with no human oversight — every tier above Tier 0 keeps a real, explicit human checkpoint or a plain owner-controlled setting.
- A general CRM — no deal pipeline, no marketing automation, no lead scoring.
- A calendar product — no multi-technician scheduling, no travel-time optimization, no external calendar sync, no recurring bookings, no customer-facing self-serve booking portal.
- A machine-learned "trust score" — autonomy is deterministic and owner-toggleable, not a black box that decides it has earned more freedom.
- Multi-trade generalization — plumbing-only assumptions are fine to hard-code.
- `job_doc_shares` / public report share links — still out of scope, as in the original spec.
- Rebuilding the dashboard-facing readiness/confidence display in `lib/brain/*` unless Phase 3 discovers it's actually load-bearing UI — verify before touching, don't assume.

## 16. Phase 3 implementation plan, in dependency order

1. **Schema migration** — steps 1–6 from §13: `customers`, `bookings`, the additive columns on `work_cards`/`job_doc_fields`/photo tables.
2. **Customer resolution cutover** — inbound webhook and `context/assemble.ts` resolve-or-create by phone against `customers`; name-matching kept as fallback, removed once verified.
3. **Booking engine** — the deterministic slot/conflict function, `check_availability`/`create_booking`/`update_booking` implementations, the automatic confirmation-send flow.
4. **Brain tool-calling** — introduce real function-calling into the generation step, wire the six tools from §6.
5. **Autonomy tiers** — extend `decision-categories.ts` with the action-tier axis, add the `ai_configurations` toggles, rework the approval surface to show one-tap decision cards for Tier 2 actions instead of raw text edits.
6. **Job workspace UI** — merge Work Card + Job Record screens into one; cut the photo pipeline over to the unified table and single analysis standard; point report generation at the live Job data.
7. **Navigation reset** — collapse to Home/Customers/Conversations/Jobs, fold Approvals into Home, remove the standalone Job Record creation route.
8. **Onboarding addition** — the tone/style question + optional "write like me" example, wired into `ai_configurations` and `prompt/build.ts`.
9. **Cleanup pass** (after a bake period, explicitly deferred) — drop `job_docs`/`job_doc_photos`, remove `lib/trades.ts` multi-trade branching, resolve `lib/brain`'s dead stubs.

Each step is independently shippable and testable, additive until step 9, and non-destructive to production data at every point before that final, separately-scoped cleanup.

---

**Recommendation:** approve or redirect §§1, 7, 9, 10, and 13 specifically — those are the decisions with real migration/behavior consequences (Job absorbs Job Record; the three-tier autonomy model and what's gated by a setting vs. always-escalate; booking's minimum data model; the DB table staying named `work_cards`). Everything else in this document follows fairly mechanically from those five calls.
