# ReplyFlow Master Execution Plan

**The single source of truth for what gets built next, in what order, and why.** Consolidates five documents that had started to overlap without ever being reconciled: `DOCS/CONSTITUTION/00-Founder-Constitution.md` (the authority everything below answers to), `ReplyFlow-Constitution-Compliance-Audit.md`, `ReplyFlow-Constitution-Compliance-Roadmap.md`, `ReplyFlow-Operations-Blueprint.md`, and `DOCS/CONSTITUTION/08-Implementation-Roadmap.md` (the pre-Constitution product roadmap, partially overtaken by events — see below).

No code accompanies this document. It supersedes the other four for sequencing and prioritisation — they remain valuable as the detailed rationale behind individual items, and are cited throughout rather than repeated. Where this document and an older one disagree on priority or status, this document is the current answer.

---

## Consolidation findings

Five things worth surfacing before the plan itself, because each one changed what the plan actually says.

**Duplicate work identified and merged.** The Compliance Roadmap and the Operations Blueprint independently described the same underlying work from two different angles in five places: usage/cost tracking (Compliance C1 = Blueprint §4), the onboarding cost bug and rate limiting (Compliance C2, folds into the same task as tracking), monitoring and error reporting (Compliance C3 = Blueprint §1+§2, merged into one task), the support channel (Compliance C4 = Blueprint §5), and billing (Compliance H1 = Blueprint §6). Each pair is now one task below, not two.

**A real status error caught.** `08-Implementation-Roadmap.md` still lists Track A (A1 Handover, A2 Test Conversations, A3 Onboarding reorder) as upcoming work. It isn't — verified directly against the live codebase while writing this plan: `/dashboard/receptionist/meet` and `/dashboard/receptionist/try` both exist and are real, and the onboarding sequence already runs Test-before-WhatsApp. All three shipped during the V1 First-Run and RC1–RC6 work and were simply never marked complete in that document. They're recorded as done below and removed from the active plan, which matters — without this check, the master plan would have re-scheduled work that's already finished.

**Missing prerequisites recovered.** The Compliance Roadmap, written specifically to close the operational gap, never mentions Diary reframe (old B3) or Customers completion (old B4) — they simply weren't its focus. Left unreconciled, a plan built only from the Compliance Roadmap would have quietly dropped two items the product roadmap already committed to. Both are pulled back in below, correctly re-sequenced against the operational work rather than lost.

**A conflicting priority, resolved.** The old Implementation Roadmap's own instinct was "build Work Cards next." The Compliance Audit's finding was "the operational floor doesn't exist yet." Both are true, and they're not actually in tension once sequenced: the operational safety net has to exist before real paying customers arrive regardless of what else ships, while Work Cards has no such time pressure — nothing forces it ahead of billing readiness. This plan sequences operational safety first (Phases 0–1) and product completion second (Phase 2), not because Work Cards doesn't matter, but because nothing about it is time-critical the way an undetected outage is.

**Simplification opportunities taken.** The CRM-boundary check (Compliance M2) is folded into Customers completion's own success criteria rather than tracked as a separate task — it's a property that task needs to have, not a project of its own. The stale-comment fix and the model-tier consolidation investigation (Compliance L1/L2) are bundled into Phase 0 as one small hygiene pass rather than two standalone entries. Defining SLIs/SLOs is grouped with cost tracking in Phase 0 rather than with monitoring in Phase 1, because it's cheap, and it determines what Phase 1's alerts should actually watch for.

---

## Already complete — confirmed, not re-scheduled

| Item | Confirmed by |
|---|---|
| **A1 — Handover ("Meet Your Receptionist")** | `components/dashboard/receptionist/meet-your-receptionist.tsx` is real, live, data-driven |
| **A2 — Test Conversations** | `/dashboard/receptionist/try` exists and is routed to directly from the handover flow |
| **A3 — Onboarding reorder** | The full V1 First-Run sequence (Welcome → Teach → Meet → Test → WhatsApp) ships live; Test genuinely precedes WhatsApp |
| **B2 — Front Desk retone** | `app/(dashboard)/dashboard/page.tsx` is the single, unified page the roadmap called for; `mission-control` is a redirect |

These stay recorded here so the next person reading this plan doesn't wonder why Track A isn't in it — it's not missing, it's finished.

---

## How to read each task

Every task states: **Objective**, **Why** (the specific Founder Constitution line it serves), **Dependencies**, **Complexity** (Low/Medium/High — implementation effort), **Business Impact** (Low/Medium/High), **Risk if postponed**, **Success criteria**, and **Blocks** (what can't responsibly start until this is done).

---

## Phase 0 — Foundation

*Cheap, foundational, unlocks almost everything downstream. Nothing here should take long, and nothing later should start ahead of it.*

### 0.1 AI token and cost tracking — implemented
- **Objective:** Persist the token counts and cost already returned by every OpenAI call, per business and per call site.
- **Why:** *"Build for reliability before intelligence."* ReplyFlow cannot offer the predictability the Constitution promises without knowing its own costs.
- **Dependencies:** None.
- **Complexity:** Low — the data already exists in every API response; this is persistence, not invention.
- **Business Impact:** High.
- **Risk if postponed:** Every pricing, margin, and reliability decision downstream stays a guess.
- **Success criteria:** Every real OpenAI call's token usage and estimated cost is queryable per business.
- **Blocks:** Billing (3.1), Founder metrics dashboard (3.4), any real pricing decision.
- **Shipped as:** a new `ai_usage_events` table (`supabase/migrations/0016_ai_usage_tracking.sql`), written from the one provider-agnostic chokepoint every completion call already passes through (`lib/reply-engine/llm/client.ts`), so all three real call sites — production replies, Test Conversations, and the onboarding/coaching live-reply preview — are covered without instrumenting each one separately. Cost estimation is a pure, unit-tested function (`lib/reply-engine/llm/pricing.ts`); recording itself is best-effort and never blocks a reply (`lib/reply-engine/llm/usage-tracking.ts`). Verified against real production data: the 18-scenario adversarial regression suite ran with 0 failures, and 59 real rows landed in `ai_usage_events` (30 `understanding.classify`, 29 `prompt.generate`), correctly attributed by business, call site, model, tier, and cost.

### 0.2 Fix the onboarding demo's uncapped-cost bug, add basic rate limiting — implemented
- **Objective:** Stop the onboarding demo conversation from re-firing 8 real OpenAI calls on every refresh/retry, and add a basic per-endpoint rate limit to every AI-calling route.
- **Why:** *"Never sacrifice trust for novelty."* A real, quantified, currently-live cost bug is the opposite of the reliability the Constitution asks for.
- **Dependencies:** Best paired with 0.1, so the fix can be verified against real data.
- **Complexity:** Low.
- **Business Impact:** High — this is active, ongoing financial exposure, not a hypothetical risk.
- **Risk if postponed:** Continues to bleed real cost with zero ceiling; gets materially worse the more signups occur.
- **Success criteria:** Repeated visits to the Preparing screen no longer refire the full demo sequence; every AI-calling endpoint has a basic rate limit.
- **Blocks:** Nothing else, but should not be delayed given it's active.
- **Shipped as:** root cause was that `/api/onboarding/prepare` was already idempotent for the business row, but the client always re-ran the full 4-message demo regardless — fixed by having the route report `alreadyCompleted`, so a repeat mount skips the demo entirely instead of re-spending real calls to replay it. A basic, DB-backed rate limit (`lib/ai-rate-limit.ts`) was added to the two owner-facing AI routes (live-reply, test-conversation), reusing the `ai_usage_events` ledger from 0.1 as its own counter — no new infrastructure. **Deliberately not applied to the WhatsApp webhook**: a real inbound customer message must never be silently dropped by a rate limit, and the webhook already has a real ceiling (Meta's signature requirement, plus the existing `customer_message_id` idempotency guard) that the onboarding demo's client-side re-mount bug never had — applying the same mechanism there would trade a cost risk for a strictly worse trust risk. Verified end-to-end against real production: unauthenticated requests still 401 before any rate-limit check runs; the already-onboarded QA business genuinely receives `alreadyCompleted: true`; synthetically filling `ai_usage_events` to the threshold produces a real 429 with a `Retry-After` header and friendly message on both routes; clearing it immediately unblocks the business again; the 18-scenario adversarial regression suite passed 0 failures post-deploy. Real usage/cost/latency observations surfaced while calibrating the threshold are logged in `DOCS/SPECS/AI-Model-Router-Insights.md`, per the founder's explicit instruction not to design the Model Router itself yet.

### 0.3 Define initial SLIs/SLOs — implemented
- **Objective:** Write down a small number of real, owner-relevant reliability targets: message-to-draft latency, WhatsApp-disconnect detection time, reply-engine failure rate.
- **Why:** *"Peace of mind that is: Confident. Reliable. Consistent. Predictable."* Specific claims need a specific, checkable definition.
- **Dependencies:** None.
- **Complexity:** Low — a documentation exercise, not engineering.
- **Business Impact:** Medium (directly, low cost) but High indirectly — shapes what Phase 1 monitors.
- **Risk if postponed:** Phase 1's alert thresholds get chosen arbitrarily instead of against a real target.
- **Success criteria:** A short, written set of internal targets exists and is referenced when monitoring is built.
- **Blocks:** Monitoring & error reporting (1.1) is meaningfully weaker without this done first.
- **Shipped as:** `DOCS/SPECS/ReplyFlow-SLIs-SLOs.md`, with two reusable, read-only scripts (`scripts/sli/message-to-draft-latency.mjs`, `scripts/sli/silent-drop-rate.mjs`) that compute each SLI's real current value from existing production data — not just a target on paper. Real baselines as of 2026-07-29: message-to-draft latency p95 = 6.23s (target: <10s); silent-drop rate = 5.00% (target: 0%, **not currently met**). WhatsApp-disconnect detection time is honestly documented as **not measurable today** — no active monitoring exists yet, only a passive on-page-view check — with a target defined for Monitoring (1.1) to build against rather than inventing a number now. **A real finding surfaced, flagged for separate follow-up, not fixed here:** all 6 silent-drop instances trace to the same root cause — two inbound messages arriving within seconds of each other before the first's async processing finishes, producing one consolidated reply but only one `reply_drafts` row (keyed to the second message). The customer wasn't actually left unanswered in any of the 6 cases, but the earlier message has no row of its own — a real per-message audit-trail gap worth a dedicated fix, most naturally as part of Monitoring (1.1) or a small standalone task.

### 0.4 Engineering hygiene pass — implemented
- **Objective:** Correct the stale comment in `lib/reply-engine/safety/evaluate.ts` claiming auto-send isn't implemented (it is, narrowly); investigate consolidating the "small"/"large" model tiers, which currently resolve to the identical model.
- **Why:** *"Understanding before explanation," "Simplicity is a feature"* — applied to the codebase's own self-description, not just the UI.
- **Dependencies:** None.
- **Complexity:** Low (the comment fix); Medium (the tier-consolidation investigation, which may or may not lead to a change).
- **Business Impact:** Low.
- **Risk if postponed:** Minor — a misleading comment costs a future engineer time; the tier duplication costs a small amount of real API spend.
- **Success criteria:** Comment corrected; a clear yes/no recommendation exists on tier consolidation.
- **Blocks:** Nothing.
- **Shipped as:** the `evaluate.ts` header comment now accurately describes the real, narrow, opt-in auto-send path instead of claiming it doesn't exist — zero behavioural change, comment-only.

  **Tier-consolidation recommendation: No — keep the tier system as-is, do not consolidate or remove it.** Investigation, grounded in every real `ai_usage_events` row recorded since 0.1 (122 calls): `gpt-4o-mini` is the *only* model that has ever actually been used in production, for both tiers, 100% of the time — not just the `.env.example` default, real evidence. But the abstraction itself (`ModelTier`, `lib/reply-engine/llm/types.ts`/`client.ts`/`providers/openai.ts`, plus the two callers `classify.ts`/`generate.ts`) is small, cleanly isolated to exactly those files, and has no duplicated logic anywhere — there is no code debt to clean up. The "duplication" is entirely a config/deployment fact (`OPENAI_MODEL_SMALL`/`OPENAI_MODEL_LARGE` both happen to point at the same model), not a code smell, and the abstraction is exactly the plumbing a future Model Router would need already in place. Removing it would delete legitimate, low-cost, forward-compatible infrastructure to "fix" something that isn't actually broken. **No code changed as a result of this investigation** — correctly, since the recommendation is to leave it alone. Model-Router-relevant findings from this investigation are logged separately in `DOCS/SPECS/AI-Model-Router-Insights.md`, not designed or implemented here.

---

## Phase 1 — Operational Safety — every task addressed; three honest gaps remain, all non-engineering

*The safety net. Nothing in Phase 3 or 4 should ship ahead of this — a real customer should never be the first one to discover a gap here.*

1.1–1.4 fully implemented, verified against real production (not assumptions), and documented. 1.5 and 1.6 are both now addressed too, but neither fully closed — the same honest pattern as 1.2. Every remaining gap requires a founder action or an external party, not more engineering: active alerting (1.1/1.3) works but is inert until a real notification channel is configured (one env var); backup/recovery (1.2) has no managed capability at all on the current Supabase Free plan — a manual stopgap exists, but the real fix is a plan upgrade, recommended before Phase 4; the support channel (1.5) has a runbook and the plumbing to turn it on, but no real inbox yet — that needs the founder to designate and commit to checking a real address (also one env var, once decided); and the privacy policy/ToS (1.6) now has an accurate factual account of the system's real data practices ready for a reviewer, but still genuinely needs that qualified reviewer before anything is published. All four are tracked in their own documents, not hidden — none should be further postponed once Phase 4 (launch) is in view.

### 1.1 Monitoring and error reporting — capture implemented; active alerting still open
- **Objective:** Adopt a hosted error/APM tool (Sentry-class), wire it into every API route and reply-engine catch block, add uptime monitoring for the app and the WhatsApp webhook.
- **Why:** *"ReplyFlow will never leave a business owner wondering whether their business is being looked after."* Requires ReplyFlow to know first.
- **Dependencies:** 0.3 (targets to alert against).
- **Complexity:** Medium.
- **Business Impact:** High — closes the single largest gap found across both prior audits.
- **Risk if postponed:** An outage or a systematic bad-reply pattern could run for days, discovered only when a customer complains.
- **Success criteria:** A simulated webhook failure and a simulated OpenAI error both produce a real alert within minutes.
- **Blocks:** Incident response (1.3), and responsibly enabling billing (Phase 4).
- **Shipped as:** a first-party `error_events` ledger (migration 0017, `lib/error-events.ts`) instead of the hosted APM tool this item originally named — no external account/DSN exists in this environment to wire one up and verify end-to-end, so the real, verifiable foundation got built first; adopting Sentry (or staying first-party) is a short, distinct decision once an account exists, not blocked by this choice. Wired into every real reply-engine/webhook catch block (`generate-reply.ts` critical outer catch, `classify.ts`/`generate.ts` warnings, `send.ts` error, the webhook route's four failure paths, the live-reply route's outer catch) with a severity convention and zero customer content ever logged. `/api/health` (real DB check) plus `scripts/monitoring/error-summary.mjs` (plain queryable summary, not a dashboard). Verified end-to-end against real production: a genuinely triggered webhook signature failure produced a real, correctly-shaped `error_events` row within seconds; the 18-scenario adversarial suite passed 0 failures post-deploy; and the run incidentally proved the wiring works against a real failure that already existed (the QA business's stale WhatsApp token, previously only visible in `reply_drafts.error_message`, now also surfaced in the durable ledger for the first time).

  **Honest gap at the time, now closed by 1.3:** this originally shipped with no active alerting — only structured, queryable capture. 1.3 added `notifyCriticalIncident()`, wired into this same capture pipeline, closing the gap. It remains inert in production until `INCIDENT_ALERT_WEBHOOK_URL` is actually set (a founder-actioned, non-engineering step) — see 1.3's own entry.

### 1.2 Backup and recovery — real gap confirmed and documented; success criteria not met
- **Objective:** Confirm or enable Supabase point-in-time recovery; perform and document one real restore; define a rough tolerable data-loss window.
- **Why:** *"Reliable. Consistent."* A business's entire customer history lives here — this has to include "the data survives."
- **Dependencies:** None.
- **Complexity:** Low.
- **Business Impact:** High (low probability, catastrophic consequence).
- **Risk if postponed:** An unverified backup is a hope, not a plan.
- **Success criteria:** A real restore has been performed at least once and documented.
- **Blocks:** Nothing directly, but should complete before Phase 4.
- **Shipped as:** the honest finding this task exists to surface, not the checklist item it was written expecting to close. The founder confirmed directly in the Supabase dashboard (2026-07-29): production runs on the **Free** plan — no scheduled backups, no PITR, no restore capability, at all. **Success criteria not met, stated plainly rather than rounded away** — no restore was performed, because no safe, non-destructive target existed to perform one against (no branching, no scratch project on this plan), and restoring in place against the only real environment purely to test restoring would itself have been the kind of risky, unnecessary action this engagement's own safety discipline exists to avoid.

  What was built instead: a minimal, fully-verified, on-demand snapshot tool (`scripts/backup/export-snapshot.mjs`, zero new infrastructure or cost, reuses the same service-role pattern as every prior operational script), explicitly documented as a stopgap, not a fix — no schedule, no redundant storage, no retention policy, and (deliberately) no accompanying restore script, since shipping unverified "recovery" code would create false confidence rather than real safety. Verified for real against production: complete (row counts matched exactly across all 7 core tables), referentially consistent (zero orphaned rows), and confirmed to correctly exclude the one real secret in scope (`whatsapp_connections.access_token`). Full account, including the documented-but-unverified restore procedure and the recommended real fix (a Supabase plan upgrade, timed before Phase 4), in `DOCS/SPECS/ReplyFlow-Backup-Recovery.md`.

### 1.3 Incident response process — implemented
- **Objective:** A short written runbook: who's notified when an alert fires, a simple severity classification, a plain-language owner-communication approach, a lightweight postmortem habit for anything customer-visible.
- **Why:** *"The owner should always feel supported"* — and the same honesty the receptionist owes customers, applied to the founders' own operational conduct.
- **Dependencies:** 1.1 (something has to fire the alert this process responds to).
- **Complexity:** Low.
- **Business Impact:** Medium directly, High in combination with 1.1.
- **Risk if postponed:** An alert fires with nobody clear on what happens next.
- **Success criteria:** The runbook exists and has been walked through at least once against a simulated incident.
- **Blocks:** Nothing else, but should precede Phase 4.
- **Shipped as:** `DOCS/SPECS/ReplyFlow-Incident-Response.md` — severity classification (reusing `error_events`' existing convention, mapped to the Operations Blueprint's own customer-impact tiers), the real current notification state, owner-communication templates matching the Constitution's voice standard, and a postmortem habit mirroring the adversarial suite's "every real bug becomes a permanent scenario" discipline. Walked through against a real incident already sitting in production telemetry (the QA business's stale WhatsApp token) rather than a fabricated one — the required success-criteria walkthrough. Also closes 1.1's own flagged gap: a `critical` `error_events` row now triggers `notifyCriticalIncident()` (`lib/incident-alert.ts`), a generic webhook POST wired into `error-events.ts`'s one existing chokepoint. Verified end-to-end against a real disposable public test endpoint — the exact payload arrived correctly. **Honestly inert in production today**, same as 1.1 left it: `INCIDENT_ALERT_WEBHOOK_URL` is unset, so no real alert fires yet — activating it needs only a Slack/Discord webhook URL (or similar) set as one env var, not further engineering. 18-scenario adversarial suite passed 0 failures post-deploy; confirmed the new alert hook stayed correctly dormant (no critical events fired) rather than assuming it.

### 1.4 Security and access baseline — implemented
- **Objective:** 2FA on every shared admin account (Supabase, Vercel, Meta, OpenAI); a clear, short answer to who has production database access and why; a rule that any future internal tool gets its own scoped auth rather than inheriting raw access.
- **Why:** Extends the Constitution's existing non-negotiable data boundaries from "what the model sees" to "who on the team can see what."
- **Dependencies:** None.
- **Complexity:** Low.
- **Business Impact:** Medium directly, High as a prerequisite for 3.3.
- **Risk if postponed:** A single compromised shared credential currently has broad, unaudited reach.
- **Success criteria:** 2FA confirmed on every shared account; access list documented.
- **Blocks:** Internal admin tools (3.3) shouldn't be built ahead of this.
- **Shipped as:** full account in `DOCS/SPECS/ReplyFlow-Security-Access-Baseline.md`. Multi-tenant isolation tested empirically against real production (not read off the migration files): zero rows visible to an unauthenticated request across all 9 core tables; zero cross-tenant leakage for a real second business under a real authenticated session. Found and fixed one real, concrete gap: `whatsapp_connections.access_token` was technically selectable by an authenticated owner's own session via RLS grants (never actually exploited by app code — both real call sites already selected safe columns only) — closed with column-level Postgres privileges (migration 0018), verified against a real session: selecting `access_token` is now rejected with "permission denied," safe columns remain fully accessible. Git history checked clean for committed secrets. The scoped-auth rule for future internal tools is written and explicitly scoped to not require retrofitting the existing CLI scripts (which require holding the credential directly to run at all — a different access model than a web-reachable tool). **2FA confirmed enabled on all four shared accounts** (Supabase, Vercel, Meta, OpenAI — founder-verified 2026-07-29, all via authenticator app rather than SMS). Success criteria fully met.

### 1.5 Customer support workflow (MVP) — runbook and channel plumbing implemented; real inbox not met
- **Objective:** A real, monitored support inbox and a short runbook for the two most likely failure modes (a wrong AI reply, a broken WhatsApp connection), with an honest response-time expectation.
- **Why:** *"Whether the answer is action, advice or reassurance, the owner should always feel supported."*
- **Dependencies:** None structurally; stronger paired with 1.1 (visibility into what actually broke).
- **Complexity:** Low.
- **Business Impact:** High.
- **Risk if postponed:** No first real customer can be responsibly onboarded without this existing at all.
- **Success criteria:** A real inbox exists, is monitored, and the runbook has been used at least once in a dry run.
- **Blocks:** Phase 4 (launch).
- **Shipped as:** the same honest wall Task 1.2 and Task 1.6 already hit — a real, monitored inbox is a genuine commitment (a real address, a real person actually checking it) that engineering can't create unilaterally. **Success criteria "a real inbox exists, is monitored" is not met**, stated plainly rather than rounded away. What's built instead, so turning the channel on is a one-line config step once the founder picks an address: a `SUPPORT_EMAIL` env var (unset in production today) gating a new "Get help" section on `/dashboard/settings` — it stays absent until set, so the app never claims a support channel exists before someone's genuinely watching it, verified both ways (confirmed absent in production with `SUPPORT_EMAIL` unset; confirmed rendering correctly, mailto link and all, against a local server with it set). A complete runbook for both named failure modes in `DOCS/SPECS/ReplyFlow-Customer-Support-Workflow.md`: "wrong AI reply" written from scratch (no prior coverage existed anywhere), "broken WhatsApp connection" correctly reused from 1.3's `ReplyFlow-Incident-Response.md` rather than duplicated. A recommended (not unilaterally fixed) response-time expectation — one business day, usually sooner. Both failure modes dry-run per success criteria: WhatsApp reuses 1.3's own real-incident walkthrough; the wrong-AI-reply scenario is a new, clearly-labeled constructed walkthrough grounded in SHABZ's real taught data, since no equivalent dry run existed yet for that failure mode.

### 1.6 Privacy policy and terms of service review — prerequisite input prepared; review itself still not met
- **Objective:** A qualified legal review of how customer conversation data is collected, processed by a third-party AI provider, retained, and deleted.
- **Why:** Underpins every trust-related line in the Constitution — asking for trust without having answered this honestly undercuts the ask.
- **Dependencies:** None; requires a qualified reviewer, not engineering time.
- **Complexity:** Low (engineering); external dependency on legal availability.
- **Business Impact:** High.
- **Risk if postponed:** Real regulatory and reputational exposure the moment there's a real UK customer's real customer data in the system.
- **Success criteria:** A reviewed, published privacy policy and ToS exist.
- **Blocks:** Phase 4 (launch) — should not enable billing without this in place.
- **Shipped as:** the task's own text is unusually direct that its deliverable needs a qualified reviewer, not engineering — that's still true, and **success criteria is not met.** What genuinely was missing, and was engineering's honest contribution: nobody had ever written down, in one place, exactly what the objective itself asks a reviewer to review — how data is actually collected, processed, retained, and deleted. `DOCS/SPECS/ReplyFlow-Data-Practices-Audit.md` traces that directly against the real schema and code (every content-bearing table, exactly what OpenAI and Meta each receive with no redaction step anywhere, the confirmed absence of any retention/expiry policy, and precisely what account deletion does and doesn't reach) — explicitly framed as the reviewer's input, not a substitute for the review, and deliberately silent on anything requiring legal judgement (lawful basis, DPA status with OpenAI/Meta, data-subject-rights process). A reviewer can now start from an accurate account of the system instead of from nothing.

---

## Phase 2 — Core Product Completion

*The acknowledged UX gaps, re-sequenced after the safety net because nothing here is time-critical the way Phase 1 is.*

### 2.1 Work Cards — implemented
- **Objective:** A dedicated Work Card page and a real object (address, access notes, photos placeholder, collected details) — everything a technician needs to walk out the door prepared, assembled automatically from the conversation.
- **Why:** *"The owner should think less."* Today a job is a title, a status, and a date — not enough to act on without reconstructing it from a WhatsApp thread by hand.
- **Dependencies:** None structurally (per `08-Implementation-Roadmap.md` B1, the one genuinely foundational item in that track). Full object definition already lives in `DOCS/SPECS/Work-Card-Object.md`.
- **Complexity:** High.
- **Business Impact:** High — the single biggest remaining product gap.
- **Risk if postponed:** Front Desk, Diary, and Customers all continue pointing at a thin data model.
- **Success criteria:** A technician with no other context could complete a job using only this screen.
- **Blocks:** Materially enriches 2.2 (Diary), 2.3 (Customers), and 2.4 (Approvals) — none are *blocked* by it, but all are weaker without it.
- **Shipped as:** `/dashboard/work-cards/[id]` (`app/(dashboard)/dashboard/work-cards/[id]/page.tsx`, `components/dashboard/work-cards/work-card-detail.tsx`). The object and schema were already complete (a prior sprint) — this task was genuinely just the page, so no new migrations or API routes were needed: field edits and status transitions (`booked → in_progress → completed`, cancel) are direct client-side Supabase updates, the same pattern `conversation-story.tsx`'s existing `rejectJob()` already used; only `draft → booked` reuses the existing `/api/work-cards/[id]/approve` route unchanged (the one transition with a real side effect — sending a WhatsApp confirmation). No Photos section — zero backend media storage exists anywhere, a separately-tracked gap, not faked here. No new list/index page or nav destination, per `06-Experience-Architecture.md` §2's own explicit deferral. Every existing reference to a Work Card (Front Desk's Today's Work and Needs Your Attention, the Customer page's service history) now points here instead of the parent conversation, which previously lost every Work-Card-specific field.

  **Verified genuinely end-to-end against real production**, not just build success — and this caught two real bugs before founder review, not after:
  1. A React hydration mismatch (errors #422/#425): `toLocaleString`/`toLocaleDateString` calls had no explicit `timeZone`, so the Vercel server and the browser could format the identical timestamp as different text. Confirmed this wasn't cosmetic — it broke the page's ability to visually update after real, successful changes. Fixed by pinning `Europe/London` explicitly in `lib/work-card-format.ts`, with tests asserting exact output (not just "doesn't crash") so a silent regression would be caught.
  2. The status badge was computed once on the server and passed as a static prop — a real status change (approve, start job, complete, cancel) updated the database and the local card state correctly, but the badge itself never re-rendered. Fixed by computing it reactively client-side via `useMemo`, keyed on the live card state.

  Both were caught and fixed using the same real-production-Playwright-verification discipline already established for reply-engine changes, then re-verified clean: real status transitions confirmed via direct DB checks alongside UI checks, address confirm/edit flows confirmed, mobile viewport confirmed, all real test data restored to its exact original state afterward.

### 2.2 Diary reframe — implemented
- **Objective:** Reframe the existing Diary/Hours page around "what does my day look like, and what changed" rather than a calendar grid, once it can be made of real Work Cards.
- **Why:** *"The owner should think less"* — a calendar answers "what's on this date"; an owner needs "what changed since I last checked."
- **Dependencies:** 2.1, for the "what changed" signal to be honest rather than built against thin rows.
- **Complexity:** Medium — smaller in scope than originally estimated, since the existing booking-rules page already satisfies much of the original intent (chip-based, non-calendar-feeling); the remaining work is specifically the Work-Card integration.
- **Business Impact:** Medium.
- **Risk if postponed:** Low on its own — the underlying page already functions reasonably well.
- **Success criteria:** A day's schedule reads as "what changed," not a static grid.
- **Blocks:** Nothing.
- **Shipped as:** the hypothesis was confirmed by investigation, not assumed — the existing page already satisfied the framing (chip-based, conversational), and only needed real content. Added real Today/Tomorrow Work Card sequences reusing Front Desk's exact query pattern and its `TodaysWork` component (given an optional title/empty-state prop, defaults unchanged — Front Desk's own rendering is byte-for-byte identical to before). Every action stays on the 2.1 Work Card page; this page is deliberately view-only for the schedule. Verified end-to-end against real production: correct empty states, a real synthetic booking rendered correctly for both today and tomorrow with real status labeling, and clicking through genuinely navigated to its real Work Card page — confirming the 2.1→2.2 integration works, not just compiles. Deliberately did not build explicit change/diff tracking or bulk "push the day back" rescheduling — both are separate, bigger features the task's actual success criteria didn't require.

### 2.3 Customers completion — implemented
- **Objective:** Fix the placeholder list view, add the three missing fields (outstanding work, communication preferences, previous quotations), and explicitly verify the page still reads as *understanding* a relationship rather than *managing* one.
- **Why:** *"We are not a CRM. ReplyFlow helps owners understand customer relationships rather than simply manage them."* (Folds in the Compliance Roadmap's M2 — this is now a success criterion of this task, not a separate one.)
- **Dependencies:** None structurally; enriched by 2.1, not blocked by it.
- **Complexity:** Medium.
- **Business Impact:** Medium.
- **Risk if postponed:** Low — the detail page already functions; this rounds out an already-working experience.
- **Success criteria:** List view is real (not a placeholder); the three fields have a home; a reviewer can confirm the page still reads as a handover sentence, not a database view.
- **Blocks:** Nothing.
- **Shipped as:** the audit came first, and it changed the task. The list view was already real and complete — `06-Experience-Architecture.md`'s "just an empty-state placeholder" claim was stale, confirmed and corrected rather than trusted. The actual remaining work was smaller: an "Outstanding work" card and a "Previous quotations" card added to `RelationshipOverview`, both reusing already-fetched Work Card data (`isActiveWorkCardStatus` from 2.1, and `estimated_value`, which this page never even selected before) and linking to the real Work Card page, matching the existing "Service history" card's pattern exactly. A real communication-preference field (migration 0019, one nullable text column, owner-entered only) with a small editor component reusing the established debounced-autosave pattern. Verified end-to-end against real production: the list page's search input genuinely renders (one earlier check via `textContent()` false-negatived on a placeholder attribute, caught and re-verified precisely rather than left ambiguous); a real communication preference was set, confirmed in the database, confirmed to persist after reload, then restored; both new cards render correctly with real data on desktop and mobile. 18-scenario adversarial suite passed 0 failures post-deploy (a shared type used by the reply engine's own context assembly required a field addition; confirmed `facts.ts` never actually reads it into the prompt, so this was a type-safety fix with zero behavioural change). **A genuine, separate gap surfaced during the audit and deliberately not built:** "FAQs answered specifically for this customer" was named in the original Experience Architecture audit but was never actually part of this task's objective — flagged for a future task, not silently dropped or quietly expanded into.

### 2.4 Approvals queue — implemented
- **Objective:** A dedicated page showing every pending decision across the business in one place.
- **Why:** *"The owner should think less"* — plus the Constitution's own reading of a long queue as a signal, not a design problem: *"it's a signal the receptionist isn't yet trusted with enough."*
- **Dependencies:** None structurally; better with 2.1.
- **Complexity:** Medium.
- **Business Impact:** Medium.
- **Risk if postponed:** Approvals stay inline-only; no legible, aggregate signal of how much trust has genuinely been earned.
- **Success criteria:** Every pending decision across the business is visible from one screen.
- **Blocks:** Nothing, but feeds the Confidence Timeline's own visibility over time.
- **Shipped as:** the audit found the aggregation problem already solved — `lib/front-desk-signals.ts`'s `buildAttentionQueue()` already merged waiting conversations, draft Work Cards, and pending AI-drafted replies into one urgency-sorted list, just capped to 8 for Front Desk's own interruption budget with no way to see the rest and no dedicated nav destination. The actual gap was exactly that: a new `/dashboard/approvals` route with its own independent, uncapped copy of the three input queries (deliberately not shared with `dashboard/page.tsx`'s, so nothing here can affect what Front Desk shows), rendering the same `AttentionQueue` component given three new optional, backward-compatible props (`title`, `totalCount`, `seeAllHref` — Front Desk's own rendering is unchanged when they're omitted) with an honest "You're all caught up" empty state for when nothing's pending (the component itself renders nothing on an empty list, so the page owns its own empty state explicitly). Front Desk's own heading no longer silently understates its count when more than 8 things are pending — it now shows the real total with a "See all N" link into the new page. One deliberate deviation from the Constitution's original "Approvals only when non-empty" nav wording, stated plainly rather than silently: the nav item is now always visible, with a real pending-count badge (computed once in `app/(dashboard)/layout.tsx` from the same three signals, shared by the nav badge, Front Desk's heading, and the Approvals page total — verified in production to always agree) carrying the "nothing to do" signal instead of the item itself vanishing, since a nav item that disappears is a location an owner can never actually learn. No new pure logic was introduced (`buildAttentionQueue`'s existing `limit` param and `groupPendingRepliesByConversation` were reused as-is, both already covered by existing tests), so no new tests were needed; the full 90-test suite, `tsc`, and lint stayed green. Verified end-to-end against real production (SHABZ): the Approvals page, Front Desk's "See all" behaviour, the desktop sidebar badge, and the mobile secondary-nav badge dot all showed the same real count (6) with no console or hydration errors, at both desktop and 390px mobile widths.

### 2.5 Small presentation and cleanup items — implemented
- **Objective:** Knowledge-page relationship polish, Receptionist "why it matters" copy, legacy redirect stub verification, and a deliberate review of the Welcome logo's idle pulse and the Preparing screen's ambient particles against *"nothing exists purely for decoration."*
- **Why:** Presentation-only refinements already scoped as low-cost, opportunistic work; the decorative review directly serves *"everything exists to improve understanding."*
- **Dependencies:** None.
- **Complexity:** Low.
- **Business Impact:** Low.
- **Risk if postponed:** None material — genuinely fine to do opportunistically.
- **Success criteria:** Each item resolved individually; no single acceptance bar.
- **Blocks:** Nothing.
- **Shipped as:** four independent items, each investigated before touching anything, with two turning out to already be done and corrected in documentation rather than rebuilt.

  **Knowledge-page relationship — no code change; §6 corrected.** The pages this item named (`business`, `everything-i-know`) were already merged into one page, `/dashboard/receptionist`, during the earlier V1 First-Run redesign — a stronger answer than the "one nav destination, teaching one tap away" this item asked for, since there's no navigation step at all: every gap already deep-links straight to its field via `?topic=`. `06-Experience-Architecture.md` §6 was describing a pre-merge state; corrected to describe what's actually shipped, and its own missing-concepts list (§10 items 3, 4, 5 — Handover, Test Conversations, and Customer communication preferences/quotations) was found stale in the same pass and corrected too, all independently confirmed against the codebase or the plan's own "Already complete" table.

  **Receptionist "why it matters" copy — real, partial gap; now closed.** Audited every teaching field in `business-memory.tsx` and `receptionist-playground.tsx`: emergency call-outs, service areas, and declined jobs already had a real explanatory line (from the Hiring Experience redesign); tone, behaviours, house rules, and escalation (Receptionist page) and business details, personality, services, ways to pay, guarantees, parking & access, and FAQs (Business page) had a label or a bare question and nothing else. Added the same one-line, in-her-voice treatment to each of those eleven fields, reusing the exact convention the fields that already had it established — a `text-muted-foreground` line above the field's editor — no new component. Verified live against production (SHABZ): every new line renders in the correct expanded state (both pages use a single-open-at-a-time accordion, so each group/card was opened and checked individually rather than all at once), at desktop and 390px mobile widths, with no console or hydration errors.

  **Legacy redirect stubs — verified, kept, not removed; §9 corrected.** The specific routes this item named (`business-profile`, `ai-receptionist`) don't exist under those names — grep across the entire repo found zero references, live or historical, matching them. The actual current stubs are `business` and `everything-i-know` (confirmed genuinely reachable only via a stale bookmark — nothing internal links to either), which is what the item was actually describing. Deliberately **not deleted**: both were real, live destinations for a meaningful stretch of the product's history, so a genuine returning owner's saved link is a real possibility these two twelve-line redirect files guard against at zero ongoing cost — removing them would trade that protection for a marginal tidiness gain with no real benefit, the wrong side of "preserve existing behaviour."

  **Decorative review — investigated, judgement recorded, no change.** The Preparing screen's ambient particles (`components/onboarding/preparing-receptionist.tsx`) are scoped exactly to the `"working"` stage, which is bounded by a real in-flight request (`POST /api/onboarding/prepare`) — they read as "anticipation of real work happening," not a fixed-time loader wearing a costume, so they pass "nothing exists purely for decoration" on inspection, not assumption. The Welcome page's logo idle pulse (`components/onboarding/welcome-greeting.tsx`) is, by a strict literal reading, atmosphere with no system state behind it — but it was deliberately built and refined across four dedicated polish sprints (RC3 through RC6, `git log --follow` confirms), specifically in service of first-impression confidence and warmth, both real Constitution goals ("Does this strengthen confidence?"). Unlike the one documented precedent for reversing a considered design decision in this codebase (`business-memory.tsx`'s Sprint 8.7 removal of its own conversation preview, done after real product review found it read as a questionnaire), there's no equivalent evidence here that the pulse is actually hurting anything — so it was **not removed**. This is a judgement call, stated as one rather than acted on unilaterally: the founder may weigh "nothing exists purely for decoration" more strictly than this session did, and can direct a removal directly if so.

---

## Phase 3 — Customer Readiness

*Now that the safety net exists, build what's needed to responsibly take and understand real revenue.*

### 3.1 Billing and subscription lifecycle — engineering complete; needs a real Stripe account to go live
- **Objective:** Stripe integration, one flat plan to start, subscription status tracked and gated gracefully (a lapsed payment communicates plainly before restricting anything).
- **Why:** The Constitution's own definition of success — *"Could this business confidently operate without ReplyFlow?"* — cannot be tested without a real paying relationship to ask.
- **Dependencies:** 0.1 (cost data to price against), Phase 1 complete (irresponsible to take payment before the safety net exists).
- **Complexity:** Medium.
- **Business Impact:** High — the literal precondition for revenue.
- **Risk if postponed:** No paying customers, ever, regardless of how ready everything else is.
- **Success criteria:** A real card can be charged, a real subscription tracked, a real cancellation handled gracefully.
- **Blocks:** Phase 4 (launch) entirely.
- **Shipped as:** full detail in `DOCS/SPECS/ReplyFlow-Billing-Subscription-Lifecycle.md`. Investigation found zero existing billing infrastructure and no decided price point anywhere — only the flat-plan pricing *model* was settled. Built: schema (migration 0020 — `subscription_status`/`trial_ends_at`/`stripe_customer_id`/`stripe_subscription_id`, every pre-existing business grandfathered to `active` rather than retroactively starting a trial countdown), pure gating logic matching the Blueprint's "gated gracefully" instruction exactly (trialing/past_due always keep working, only ever warn — only an expired trial or a cancellation blocks), a Stripe Checkout + Customer Portal integration (no card number ever touches ReplyFlow's own code), and a Stripe webhook mirroring the WhatsApp webhook's exact signature-verify-then-always-200 discipline. A second, genuinely separate business-creation path (`app/api/whatsapp/connect/route.ts`) was found bypassing the documented single chokepoint and fixed to set the same trial window. One real edge case (a cancelled subscription showing "Manage billing" when Checkout was actually correct) was found and fixed before reaching production, during the session's own pre-deploy review, not after. Verified end-to-end against real production: the migration backfilled every existing business correctly, unauthenticated billing routes 401, the Stripe webhook correctly reports "not configured" rather than attempting real verification with no keys set, and SHABZ (grandfathered active) sees no gate, no banner, and no dead-end button in Settings. **Genuinely not done, and not engineering's to do:** actually charging a real card needs a real Stripe account and three values only the founder can create (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` — the last one is where the actual price gets decided, in the Stripe dashboard, never in this codebase). Success criteria ("a real card can be charged") is not met yet for that reason alone — everything engineering can do ahead of that decision is done.

### 3.2 Usage analytics (full build-out) — implemented
- **Objective:** A first-party events table capturing draft approve/edit/reject, escalation frequency, onboarding funnel completion, Work Card lifecycle events.
- **Why:** *"It earns responsibility over time"* needs to be measurable, not assumed.
- **Dependencies:** Benefits from 2.1 (Work Cards) existing for full event coverage, but can begin independently.
- **Complexity:** Medium.
- **Business Impact:** Medium directly, High as the feed for 3.4 and the future correction/learning loop.
- **Risk if postponed:** The product continues operating with no visibility into its own usage patterns.
- **Success criteria:** Every listed event type is captured and queryable.
- **Blocks:** Founder metrics dashboard (3.4).
- **Shipped as:** full detail and reasoning in `DOCS/SPECS/ReplyFlow-Usage-Analytics.md`. Investigation found most of the Blueprint's own literal event list already had a real, queryable timestamp on an existing table — building a duplicate event for those would be a second log, not new visibility, so the house style already established by `scripts/sli/*.mjs` (derive from existing columns, only add a new sink when the fact genuinely isn't captured) was followed instead of the literal list. New `product_events` table (migration 0021, same conventions as `error_events`/`ai_usage_events`) captures exactly the facts that had no trace anywhere before this: `draft.edited` (editing previously left zero record it happened), `draft.approved` (distinct from the reply engine's own auto-send, which lands on the identical `status='sent'` value and was otherwise indistinguishable from an owner's explicit action), `draft.rejected` (already derivable, but unified into the same stream for a clean approve/edit/reject ratio), and `onboarding.signup_completed` (the `onboarding_completed` boolean had no history behind it). Escalation frequency and Work Card lifecycle counts are derived directly from existing columns via a new read-only script, `scripts/analytics/usage-summary.mjs`, matching the SLI scripts' exact pattern rather than duplicating what `reply_drafts`/`work_cards` already store. **A real, named remaining gap:** the initial signup wizard's individual screens have no per-step timestamp, so drop-off *between* them isn't measurable yet — stated honestly rather than silently built around or silently dropped.

### 3.3 Internal admin tools — implemented; needs ADMIN_EMAILS set to actually open
- **Objective:** A minimal, properly access-controlled internal view: a business's conversation history alongside its stored reasoning trace, connection and subscription status, simple search by business.
- **Why:** What makes support (1.5) and incident response (1.3) actually executable well rather than guesswork.
- **Dependencies:** 1.4 (security baseline) — should not be built ahead of proper access control.
- **Complexity:** Medium.
- **Business Impact:** Medium now, High once past roughly 100 customers.
- **Risk if postponed:** Manageable for a very small first cohort via direct, careful database access; becomes a real support bottleneck past that point.
- **Success criteria:** A support request can be investigated without a raw database query.
- **Blocks:** Nothing at small scale; blocks efficient support past ~100 customers.
- **Shipped as:** full detail in `DOCS/SPECS/ReplyFlow-Internal-Admin-Tools.md`. No admin/staff/role concept existed anywhere before this — built the real, scoped authorization Security Baseline §5 already bound this task to: a genuine authenticated session (gated at the edge in `middleware.ts`) checked against a real, unit-tested email allowlist (`ADMIN_EMAILS`, `lib/admin.ts`) — never the service role held or proxied to whoever reaches the URL. Verified directly against production: a real authenticated business owner (not on the allowlist, which is currently unset) is genuinely redirected away from `/admin`, not shown an error page confirming it exists. Three pages — business search/list, one business's conversations plus recent errors and product events, and a deliberately **read-only** conversation view with each reply's reasoning trace (reusing `factSourceSummary`, now extracted into `lib/fact-source-summary.ts` so a Server Component could reuse it without importing from a `"use client"` module). Connection/subscription status reuses the owner dashboard's own pure functions unchanged, so the two views can never silently disagree. Read-only was a deliberate, investigated choice, not a shortcut: the existing interactive `ConversationStory` component's every action writes through the current session's own RLS-checked ownership, so reusing it for another business's conversation would either fail silently or require weakening tenant isolation. Also corrected `lib/supabase/service.ts`'s already-stale "only import this from" comment (2 files listed, 17 real consumers). **Genuinely not usable yet:** `ADMIN_EMAILS` is unset in production — the whole surface is built, verified to correctly deny everyone, and one Vercel environment variable away from being usable by the founder.

### 3.4 Founder metrics dashboard — implemented
- **Objective:** A view (a periodic report is enough at first) showing active businesses, trial-to-paid conversion, cost per business, escalation/error rates, and the draft approve/edit/reject ratio.
- **Why:** The founders need visibility into the precursor signals to ever responsibly answer the Constitution's own definition of success for their own business.
- **Dependencies:** 0.1, 3.1, 3.2.
- **Complexity:** Low (starting as a report) to Medium (a real dashboard UI later).
- **Business Impact:** Medium.
- **Risk if postponed:** The business runs on instinct rather than evidence.
- **Success criteria:** Every metric named above is visible in one place, refreshed at least weekly.
- **Blocks:** Nothing, but is the natural capstone of this phase.
- **Shipped as:** `/admin/metrics`, inside the admin surface 3.3 just built rather than a standalone script — the plan's own text allows starting as a report, but real access control already existed by the time this task started, so reuse cost almost nothing and a live page satisfies "refreshed at least weekly" more robustly than a script someone has to remember to run. Every metric named in the objective, all direct counts/sums/ratios over real rows: business status breakdown, trial-to-paid conversion (correctly excludes grandfathered pre-billing businesses, which were never shown the trial promise — including them would understate the real rate), AI cost per business from `ai_usage_events` (0.1), escalation rate from `reply_drafts`, error counts by severity from `error_events` (1.1), and the draft approve/edit/reject ratio from `product_events` (3.2) — the last one degrades to an honest "not available yet" rather than breaking the page if that migration hasn't landed in a given environment. Verified directly against production: gated identically to the rest of `/admin` (a real authenticated non-admin session is genuinely redirected away), and the rest of the app confirmed unaffected by the deploy. Phase 3 (Customer Readiness) is now fully implemented end to end.

---

## Phase 4 — Launch

*The actual cutover — not more building, but turning on what Phases 0–3 made responsible to turn on.*

### 4.1 Go/no-go review against this plan — audit complete; verdict is NO-GO pending founder action
- **Objective:** Confirm every Phase 0 and Phase 1 item is genuinely complete, not just scheduled, before opening billing to real customers.
- **Why:** The whole point of sequencing this plan the way it's sequenced — skipping this check defeats the purpose of the ordering.
- **Dependencies:** All of Phase 0, Phase 1, and 3.1.
- **Complexity:** Low.
- **Business Impact:** High.
- **Risk if postponed:** N/A — this is the gate itself.
- **Success criteria:** A named person confirms each Phase 0/1 item's success criteria has actually been met.
- **Blocks:** Enabling real billing.
- **Shipped as:** `DOCS/SPECS/ReplyFlow-Go-No-Go-Review.md`. This task's own success criteria explicitly wants a named person's confirmation, not an engineering check — so this session's contribution is the honest, re-verified input that confirmation needs, with a literal sign-off block at the end for the founder, not a self-issued pass. Every Phase 0/1 item plus 3.1 (the plan's own named dependency) was checked against its real current state, re-verified against live production today rather than trusted from each task's own older completion notes — the `product_events` migration is still unapplied, `SUPPORT_EMAIL`/`ADMIN_EMAILS`/Stripe keys are all still unset (confirmed via zero real Stripe customers across all 21 real businesses), and one real `critical` error_events row was found and correctly identified as this session's own Task 3.1 test artifact rather than mistaken for a real incident. **Overall verdict: NO-GO today** — every item that was engineering's to build is built and verified; what remains is entirely founder-or-external action (Stripe keys, a Supabase plan decision, an alert webhook URL, a real support address, a qualified legal review), none of which further engineering work can substitute for.

### 4.2 Initial pilot cohort
- **Objective:** A small, founder-led first cohort (per the existing `DOCS/SPECS/ReplyFlow-Pilot-Plan.md`), sourced via direct outreach and trade-specific communities rather than any wide channel, matching the Business Blueprint's own marketing findings.
- **Why:** *"Trust is earned over time"* — applies to the business's own customer base, not just the receptionist's behaviour within it. A small, closely supported first cohort is how that's tested honestly.
- **Dependencies:** 4.1.
- **Complexity:** Low (process), Medium (founder time investment).
- **Business Impact:** High — the first real test of every promise in this plan.
- **Risk if postponed:** N/A — this is the actual first real-world validation.
- **Success criteria:** A defined small number of real, paying businesses onboarded and supported through their first month.
- **Blocks:** Nothing further — this is the outcome the rest of the plan exists to enable.

---

## Founder Handbook v1.0 — governing document, layered above this plan

As of 2026-08-01, `ReplyFlow Founder Handbook/` is the highest product document in the company — where this plan and the handbook disagree, the handbook wins. A full review (understanding, Brain review, architecture review, product review, roadmap review) and a follow-up architectural design review (Learning Memory, Acknowledgement, Organise Checkpoint, Granular Authority, Trust Ladder — design only, not implemented) were both founder-approved and are recorded in this session's history, not duplicated here. This plan's own sequencing was found to already substantially align with the handbook (the interruption-budget principle, the Trust Ladder's real precursor in "earned autonomy," and Phase 5's own pilot-data gating all predate the handbook but already follow its logic).

### Organise Checkpoint — implemented (Brain Loop step 7)

Chosen ahead of the next numbered task (4.2, blocked entirely on founder actions from 4.1) and ahead of every pilot-data-gated Phase 5 item, per the founder-approved roadmap reconsideration: the one piece of the architecture review needing no pilot data and no external dependency, directly implementing Handbook Ch.4 (Brain Loop step 7, "Organise") and Ch.6 Principle 3 ("Guarantee the Next Step"). Full detail in `DOCS/SPECS/ReplyFlow-Organise-Checkpoint.md`. A new, permanent, stable stage in `lib/brain/reasoning.ts` (a rule-list architecture, `lib/brain/organise.ts`, that future handbook-driven rules get added to without changing its shape) shipped with exactly one deterministic rule — a conversation whose real goal has settled on a booking with no corresponding Work Card yet — surfaced through the existing Insight/InsightList mechanism already used on Receptionist and Diary, filtered on Front Desk specifically to avoid repeating signals it already shows elsewhere. `generate-reply.ts` was deliberately not touched (the rule evaluates as a state check at Brain-build time, which is more correct than a per-message event check, not just lower-risk) — confirmed inert there by running the 18-scenario adversarial suite anyway. Verified against real production both ways: the honest empty case (SHABZ has no real booking-goal conversations today) and the positive case (a safe, already-established internal test conversation, temporarily set and fully restored).

### Non-text messages no longer get complete silence — one of six SLI silent-drops closed

Resuming this plan's own new workflow (evidence over guessing; prefer improving existing systems), the next task was chosen by re-examining Task 0.3's own open finding rather than the next numbered item: `DOCS/SPECS/ReplyFlow-SLIs-SLOs.md` §3 had left a genuine, unresolved 5% silent-drop rate on record. Re-investigating it against real message/`error_events` data found the doc's own prior explanation (one shared "consolidation race" cause) didn't hold — the 6 real cases are heterogeneous, not one pattern (correction recorded directly in that doc, dated 2026-08-01). Of the 6, exactly one had a confirmed, specific, fixable root cause: the webhook handler only ever called `generateReplyForMessage` for `message.type === "text"` (Sprint 9.1 §8's own documented scope limit), so a non-text inbound message (image, video, etc.) was stored and then never entered the pipeline at all — not a low-confidence reply, not a deliberate silence, nothing.

**Closed**: `lib/reply-engine/attachment-acknowledgment.ts` (pure, unit-tested) builds a fixed, honest acknowledgment draft — never claims to have seen the attachment, never auto-sends, no escalation, no fabricated `facts_used` — written as a normal `pending` `reply_drafts` row. `generate-reply.ts` now takes the real inbound `messageType` and routes anything non-text straight to that acknowledgment instead of the LLM pipeline; `app/api/webhooks/whatsapp/route.ts`'s gate that used to skip non-text messages entirely was removed. Verified against real production via a genuine HMAC-signed webhook POST simulating an image message (fully cleaned up afterward), and the 18-scenario adversarial suite confirms no regression to the text pipeline.

**Deliberately not fixed further**: the other 5 of the 6 original cases (1 isolated message with no sibling or logged error; 4 rapid real exchanges with no logged `error_events` at all) don't have a confirmed root cause today — per this plan's own new rule, guessing at a fix for them would risk fixing the wrong thing. Left honestly open in `DOCS/SPECS/ReplyFlow-SLIs-SLOs.md` §3 as a named, unresolved gap rather than silently dropped or covered by an unconfirmed theory. No Brain Loop stage or memory type changed by this fix, so `DOCS/CONSTITUTION/10-ReplyFlow-Brain-Architecture.md` needed no update — stated explicitly rather than skipped, per the standing rule to keep that document honest.

### Architecture-Led Development (2026-08-01) — every future task is now chosen this way, not just picked next

The founder converted the working pattern from the last several tasks into a permanent rule: before any implementation, review the Handbook, the Brain Architecture, this plan, and the real current code, then choose the highest-value task that (a) moves ReplyFlow measurably closer to the Handbook, (b) is evidence-based, (c) is production-ready today, (d) needs no pilot data, (e) needs no founder-only business decision, and (f) doesn't add unnecessary complexity — explaining why it's or isn't already in this plan, rather than defaulting to the next numbered item.

**First task chosen under this rule: WhatsApp-disconnect detection, closed without new infrastructure.** `DOCS/SPECS/ReplyFlow-SLIs-SLOs.md` §2 had sat "not measurable" since 2026-07-29 — a broken WhatsApp connection (a real, previously-experienced incident, see `lib/front-desk-signals.ts`'s own docstring) went undetected until an owner happened to open the app, a total-outage failure mode directly opposed to the Constitution's Product Promise. Investigation found every piece needed already existed and just needed wiring together: `describeConnectionHealth()` (already tested), `recordErrorEvent()`/`notifyCriticalIncident()` (Tasks 1.1/1.3, already wired, already inert-until-`INCIDENT_ALERT_WEBHOOK_URL`-is-set), and the webhook handler itself, which every real inbound message already reaches regardless of whether our own token can still call the Graph API. **Shipped**: `lib/whatsapp/connection-health-alert.ts` (pure, unit-tested) + a check in `app/api/webhooks/whatsapp/route.ts` that records a deduplicated `critical`/`warning` `error_events` row on the next real inbound message after a connection expires or is about to. No cron, no new env vars, no founder decision needed to ship this — the founder-gated piece (setting the alert webhook URL) was already a known, separate pending action. Verified against real production: token expiry simulated on the real QA connection, confirmed the exact expected row got written once, confirmed a second inbound message within the dedup window didn't duplicate it, fully restored and cleaned up. Full detail and the honest remaining gap (detection is bounded by real customer contact, not a fixed interval — true interval-based detection still needs a Vercel plan decision, deliberately out of scope) in `DOCS/SPECS/ReplyFlow-SLIs-SLOs.md` §2. No Brain Loop stage or Business Brain memory type changed by this fix (it's observability/alerting infrastructure, not a decision the Brain makes), so `DOCS/CONSTITUTION/10-ReplyFlow-Brain-Architecture.md` needed no update — stated explicitly rather than skipped.

### WhatsApp connect-flow failures are no longer invisible

Second task chosen under Architecture-Led Development. A direct audit of every `catch` block in the codebase (`grep -rn "console.error"` against every file that also has real customer/business impact) found exactly one real, confirmed exception to an otherwise-consistent pattern: every other business-critical chokepoint (both webhooks, every reply-engine stage, both billing routes) already reports through `recordErrorEvent`, but `app/api/whatsapp/connect/route.ts` — the WhatsApp Embedded Signup completion route, already flagged in Task 3.1 as "a second, genuinely separate business-creation path" — only ever logged to Vercel's ephemeral console. A failure here is the most consequential kind: it means a business cannot use ReplyFlow at all until they retry successfully, and the founder had no durable, queryable way to know whether or how often that was happening.

**Shipped:** the route's catch block now calls `recordErrorEvent` (`severity: "error"`, `source: "whatsapp.connect_failed"`) — the exact same call already used identically at `billing/checkout` for the same reason (a single business's flow failing, not a total outage). `resolvedBusinessId` is tracked outside the try block so the event still names the right business even when the failure happens after the business row is created but before the connection itself saves.

**Verification, honestly scoped:** tsc/lint/128 unit tests/production build all pass; confirmed against real production that the deploy is live and the route's auth gate still correctly returns 401 before reaching any new code (no regression). The catch block itself reuses `recordErrorEvent` unchanged — the same function already verified end-to-end against production earlier this session (the WhatsApp-disconnect-detection task) — but the connect route's own catch path could not be live-triggered here: it requires a real authenticated Supabase session plus a real Meta Embedded Signup OAuth code, and this environment has no login credentials. Stated plainly rather than skipped, per this plan's own evidence-over-assumption rule.

## Phase 5 — Growth

*Deliberately last. Nothing here is a Constitution violation to leave unbuilt — these are capabilities, not gaps, and building them before Phase 4 would be exactly the kind of "feature before foundation" this whole consolidation exists to prevent.*

- **Widen auto-send beyond its current single category** — blocked on real evidence from Phase 4's pilot, not on engineering effort; an ongoing practice, not a discrete deliverable. The Founder Handbook's "Granular Authority" architecture (see the architecture design review) is the eventual shape of this; the underlying mechanism doesn't strictly need pilot data, but which categories deserve independent owner control does.
- **Correction/learning loop (full build)** — the design work can start once 3.2's usage data exists; the full build depends on real correction volume from Phase 4 to be meaningful. Corresponds to the Founder Handbook's "Learning Memory" architecture.
- **Business Personality as real structured data** — needs a design decision informed by real customer variety from Phase 4, not before.
- **Acknowledgement layer** (Founder Handbook Ch.5 — recognising what a relationship fact means, not just storing it) — added following the handbook review; same pilot-data gating as Learning Memory, for the same reason (needs real relationship variety to know which patterns are common enough to matter).
- **Trust Ladder** (Founder Handbook Ch.2) — added following the handbook review; depends on both Learning Memory and Granular Authority existing first, so it's the last of the handbook-driven items to become buildable, not merely deferred like the others.
- **Photo/attachment support** — a real, designed-but-unbuilt gap (`09-Receptionist-Intelligence-Architecture.md` §7); worth building once real customers ask for it, not speculatively. **Founder direction, 2026-08-01:** the deterministic acknowledgment shipped for non-text messages (`lib/reply-engine/attachment-acknowledgment.ts`) is a temporary bridge, not the final experience — when this item is eventually built, it should replace that fixed acknowledgment with real understanding, not merely sit alongside it. Honesty is correct behaviour until real multimodal capability exists, not a permanent design choice.
- **Proactive follow-up** — named in the product's own philosophy as a deliberate, not-yet-built capability; carries real risk of feeling intrusive if built without real usage patterns to design against.
- **Scaling milestones** (100 / 1,000 / 10,000 customers) — the operational and architectural changes each milestone requires are already catalogued in the Business Blueprint's own scaling analysis; revisit that document directly as each threshold approaches rather than pre-building for it now.

---

## How to use this document

Before scoping any new work, find it here first. If it isn't here, ask why before building it — the same discipline `08-Implementation-Roadmap.md` established and this document now carries forward. If something here needs reordering, check its stated dependencies first; that's a real decision, not a default. This document should be re-read before every sprint, not read once and filed away.
