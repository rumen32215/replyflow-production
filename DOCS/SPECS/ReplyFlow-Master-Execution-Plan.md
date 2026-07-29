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

## Phase 1 — Operational Safety

*The safety net. Nothing in Phase 3 or 4 should ship ahead of this — a real customer should never be the first one to discover a gap here.*

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

  **Honest gap, not glossed over: this does not yet produce an "alert."** The original success criteria ("produce a real alert within minutes") isn't fully met — what exists is the prerequisite (structured, queryable, durable capture), not push notification. Active alerting needs either a notification channel the founder provides (an email address or Slack webhook — the same kind of external, founder-actioned dependency as the Sentry account) or adopting the hosted APM tool, whichever is decided first. Recommended as the very next increment, most naturally alongside or as part of Incident response (1.3) rather than reopening this item.

### 1.2 Backup and recovery
- **Objective:** Confirm or enable Supabase point-in-time recovery; perform and document one real restore; define a rough tolerable data-loss window.
- **Why:** *"Reliable. Consistent."* A business's entire customer history lives here — this has to include "the data survives."
- **Dependencies:** None.
- **Complexity:** Low.
- **Business Impact:** High (low probability, catastrophic consequence).
- **Risk if postponed:** An unverified backup is a hope, not a plan.
- **Success criteria:** A real restore has been performed at least once and documented.
- **Blocks:** Nothing directly, but should complete before Phase 4.

### 1.3 Incident response process
- **Objective:** A short written runbook: who's notified when an alert fires, a simple severity classification, a plain-language owner-communication approach, a lightweight postmortem habit for anything customer-visible.
- **Why:** *"The owner should always feel supported"* — and the same honesty the receptionist owes customers, applied to the founders' own operational conduct.
- **Dependencies:** 1.1 (something has to fire the alert this process responds to).
- **Complexity:** Low.
- **Business Impact:** Medium directly, High in combination with 1.1.
- **Risk if postponed:** An alert fires with nobody clear on what happens next.
- **Success criteria:** The runbook exists and has been walked through at least once against a simulated incident.
- **Blocks:** Nothing else, but should precede Phase 4.

### 1.4 Security and access baseline
- **Objective:** 2FA on every shared admin account (Supabase, Vercel, Meta, OpenAI); a clear, short answer to who has production database access and why; a rule that any future internal tool gets its own scoped auth rather than inheriting raw access.
- **Why:** Extends the Constitution's existing non-negotiable data boundaries from "what the model sees" to "who on the team can see what."
- **Dependencies:** None.
- **Complexity:** Low.
- **Business Impact:** Medium directly, High as a prerequisite for 3.3.
- **Risk if postponed:** A single compromised shared credential currently has broad, unaudited reach.
- **Success criteria:** 2FA confirmed on every shared account; access list documented.
- **Blocks:** Internal admin tools (3.3) shouldn't be built ahead of this.

### 1.5 Customer support workflow (MVP)
- **Objective:** A real, monitored support inbox and a short runbook for the two most likely failure modes (a wrong AI reply, a broken WhatsApp connection), with an honest response-time expectation.
- **Why:** *"Whether the answer is action, advice or reassurance, the owner should always feel supported."*
- **Dependencies:** None structurally; stronger paired with 1.1 (visibility into what actually broke).
- **Complexity:** Low.
- **Business Impact:** High.
- **Risk if postponed:** No first real customer can be responsibly onboarded without this existing at all.
- **Success criteria:** A real inbox exists, is monitored, and the runbook has been used at least once in a dry run.
- **Blocks:** Phase 4 (launch).

### 1.6 Privacy policy and terms of service review
- **Objective:** A qualified legal review of how customer conversation data is collected, processed by a third-party AI provider, retained, and deleted.
- **Why:** Underpins every trust-related line in the Constitution — asking for trust without having answered this honestly undercuts the ask.
- **Dependencies:** None; requires a qualified reviewer, not engineering time.
- **Complexity:** Low (engineering); external dependency on legal availability.
- **Business Impact:** High.
- **Risk if postponed:** Real regulatory and reputational exposure the moment there's a real UK customer's real customer data in the system.
- **Success criteria:** A reviewed, published privacy policy and ToS exist.
- **Blocks:** Phase 4 (launch) — should not enable billing without this in place.

---

## Phase 2 — Core Product Completion

*The acknowledged UX gaps, re-sequenced after the safety net because nothing here is time-critical the way Phase 1 is.*

### 2.1 Work Cards
- **Objective:** A dedicated Work Card page and a real object (address, access notes, photos placeholder, collected details) — everything a technician needs to walk out the door prepared, assembled automatically from the conversation.
- **Why:** *"The owner should think less."* Today a job is a title, a status, and a date — not enough to act on without reconstructing it from a WhatsApp thread by hand.
- **Dependencies:** None structurally (per `08-Implementation-Roadmap.md` B1, the one genuinely foundational item in that track). Full object definition already lives in `DOCS/SPECS/Work-Card-Object.md`.
- **Complexity:** High.
- **Business Impact:** High — the single biggest remaining product gap.
- **Risk if postponed:** Front Desk, Diary, and Customers all continue pointing at a thin data model.
- **Success criteria:** A technician with no other context could complete a job using only this screen.
- **Blocks:** Materially enriches 2.2 (Diary), 2.3 (Customers), and 2.4 (Approvals) — none are *blocked* by it, but all are weaker without it.

### 2.2 Diary reframe
- **Objective:** Reframe the existing Diary/Hours page around "what does my day look like, and what changed" rather than a calendar grid, once it can be made of real Work Cards.
- **Why:** *"The owner should think less"* — a calendar answers "what's on this date"; an owner needs "what changed since I last checked."
- **Dependencies:** 2.1, for the "what changed" signal to be honest rather than built against thin rows.
- **Complexity:** Medium — smaller in scope than originally estimated, since the existing booking-rules page already satisfies much of the original intent (chip-based, non-calendar-feeling); the remaining work is specifically the Work-Card integration.
- **Business Impact:** Medium.
- **Risk if postponed:** Low on its own — the underlying page already functions reasonably well.
- **Success criteria:** A day's schedule reads as "what changed," not a static grid.
- **Blocks:** Nothing.

### 2.3 Customers completion
- **Objective:** Fix the placeholder list view, add the three missing fields (outstanding work, communication preferences, previous quotations), and explicitly verify the page still reads as *understanding* a relationship rather than *managing* one.
- **Why:** *"We are not a CRM. ReplyFlow helps owners understand customer relationships rather than simply manage them."* (Folds in the Compliance Roadmap's M2 — this is now a success criterion of this task, not a separate one.)
- **Dependencies:** None structurally; enriched by 2.1, not blocked by it.
- **Complexity:** Medium.
- **Business Impact:** Medium.
- **Risk if postponed:** Low — the detail page already functions; this rounds out an already-working experience.
- **Success criteria:** List view is real (not a placeholder); the three fields have a home; a reviewer can confirm the page still reads as a handover sentence, not a database view.
- **Blocks:** Nothing.

### 2.4 Approvals queue
- **Objective:** A dedicated page showing every pending decision across the business in one place.
- **Why:** *"The owner should think less"* — plus the Constitution's own reading of a long queue as a signal, not a design problem: *"it's a signal the receptionist isn't yet trusted with enough."*
- **Dependencies:** None structurally; better with 2.1.
- **Complexity:** Medium.
- **Business Impact:** Medium.
- **Risk if postponed:** Approvals stay inline-only; no legible, aggregate signal of how much trust has genuinely been earned.
- **Success criteria:** Every pending decision across the business is visible from one screen.
- **Blocks:** Nothing, but feeds the Confidence Timeline's own visibility over time.

### 2.5 Small presentation and cleanup items
- **Objective:** Knowledge-page relationship polish, Receptionist "why it matters" copy, legacy redirect stub verification, and a deliberate review of the Welcome logo's idle pulse and the Preparing screen's ambient particles against *"nothing exists purely for decoration."*
- **Why:** Presentation-only refinements already scoped as low-cost, opportunistic work; the decorative review directly serves *"everything exists to improve understanding."*
- **Dependencies:** None.
- **Complexity:** Low.
- **Business Impact:** Low.
- **Risk if postponed:** None material — genuinely fine to do opportunistically.
- **Success criteria:** Each item resolved individually; no single acceptance bar.
- **Blocks:** Nothing.

---

## Phase 3 — Customer Readiness

*Now that the safety net exists, build what's needed to responsibly take and understand real revenue.*

### 3.1 Billing and subscription lifecycle
- **Objective:** Stripe integration, one flat plan to start, subscription status tracked and gated gracefully (a lapsed payment communicates plainly before restricting anything).
- **Why:** The Constitution's own definition of success — *"Could this business confidently operate without ReplyFlow?"* — cannot be tested without a real paying relationship to ask.
- **Dependencies:** 0.1 (cost data to price against), Phase 1 complete (irresponsible to take payment before the safety net exists).
- **Complexity:** Medium.
- **Business Impact:** High — the literal precondition for revenue.
- **Risk if postponed:** No paying customers, ever, regardless of how ready everything else is.
- **Success criteria:** A real card can be charged, a real subscription tracked, a real cancellation handled gracefully.
- **Blocks:** Phase 4 (launch) entirely.

### 3.2 Usage analytics (full build-out)
- **Objective:** A first-party events table capturing draft approve/edit/reject, escalation frequency, onboarding funnel completion, Work Card lifecycle events.
- **Why:** *"It earns responsibility over time"* needs to be measurable, not assumed.
- **Dependencies:** Benefits from 2.1 (Work Cards) existing for full event coverage, but can begin independently.
- **Complexity:** Medium.
- **Business Impact:** Medium directly, High as the feed for 3.4 and the future correction/learning loop.
- **Risk if postponed:** The product continues operating with no visibility into its own usage patterns.
- **Success criteria:** Every listed event type is captured and queryable.
- **Blocks:** Founder metrics dashboard (3.4).

### 3.3 Internal admin tools
- **Objective:** A minimal, properly access-controlled internal view: a business's conversation history alongside its stored reasoning trace, connection and subscription status, simple search by business.
- **Why:** What makes support (1.5) and incident response (1.3) actually executable well rather than guesswork.
- **Dependencies:** 1.4 (security baseline) — should not be built ahead of proper access control.
- **Complexity:** Medium.
- **Business Impact:** Medium now, High once past roughly 100 customers.
- **Risk if postponed:** Manageable for a very small first cohort via direct, careful database access; becomes a real support bottleneck past that point.
- **Success criteria:** A support request can be investigated without a raw database query.
- **Blocks:** Nothing at small scale; blocks efficient support past ~100 customers.

### 3.4 Founder metrics dashboard
- **Objective:** A view (a periodic report is enough at first) showing active businesses, trial-to-paid conversion, cost per business, escalation/error rates, and the draft approve/edit/reject ratio.
- **Why:** The founders need visibility into the precursor signals to ever responsibly answer the Constitution's own definition of success for their own business.
- **Dependencies:** 0.1, 3.1, 3.2.
- **Complexity:** Low (starting as a report) to Medium (a real dashboard UI later).
- **Business Impact:** Medium.
- **Risk if postponed:** The business runs on instinct rather than evidence.
- **Success criteria:** Every metric named above is visible in one place, refreshed at least weekly.
- **Blocks:** Nothing, but is the natural capstone of this phase.

---

## Phase 4 — Launch

*The actual cutover — not more building, but turning on what Phases 0–3 made responsible to turn on.*

### 4.1 Go/no-go review against this plan
- **Objective:** Confirm every Phase 0 and Phase 1 item is genuinely complete, not just scheduled, before opening billing to real customers.
- **Why:** The whole point of sequencing this plan the way it's sequenced — skipping this check defeats the purpose of the ordering.
- **Dependencies:** All of Phase 0, Phase 1, and 3.1.
- **Complexity:** Low.
- **Business Impact:** High.
- **Risk if postponed:** N/A — this is the gate itself.
- **Success criteria:** A named person confirms each Phase 0/1 item's success criteria has actually been met.
- **Blocks:** Enabling real billing.

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

## Phase 5 — Growth

*Deliberately last. Nothing here is a Constitution violation to leave unbuilt — these are capabilities, not gaps, and building them before Phase 4 would be exactly the kind of "feature before foundation" this whole consolidation exists to prevent.*

- **Widen auto-send beyond its current single category** — blocked on real evidence from Phase 4's pilot, not on engineering effort; an ongoing practice, not a discrete deliverable.
- **Correction/learning loop (full build)** — the design work can start once 3.2's usage data exists; the full build depends on real correction volume from Phase 4 to be meaningful.
- **Business Personality as real structured data** — needs a design decision informed by real customer variety from Phase 4, not before.
- **Photo/attachment support** — a real, designed-but-unbuilt gap (`09-Receptionist-Intelligence-Architecture.md` §7); worth building once real customers ask for it, not speculatively.
- **Proactive follow-up** — named in the product's own philosophy as a deliberate, not-yet-built capability; carries real risk of feeling intrusive if built without real usage patterns to design against.
- **Scaling milestones** (100 / 1,000 / 10,000 customers) — the operational and architectural changes each milestone requires are already catalogued in the Business Blueprint's own scaling analysis; revisit that document directly as each threshold approaches rather than pre-building for it now.

---

## How to use this document

Before scoping any new work, find it here first. If it isn't here, ask why before building it — the same discipline `08-Implementation-Roadmap.md` established and this document now carries forward. If something here needs reordering, check its stated dependencies first; that's a real decision, not a default. This document should be re-read before every sprint, not read once and filed away.
