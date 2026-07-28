# ReplyFlow Operations Blueprint

**The operational foundation required to keep the promises made in `DOCS/CONSTITUTION/00-Founder-Constitution.md`.** Not a coding task, not a feature roadmap — a design document. Every recommendation below is a decision the founders still need to make theirs; nothing here is implemented, and nothing here should be read as already decided.

This blueprint exists because the Constitution Compliance Audit found the same thing twice: ReplyFlow's product judgement is already largely aligned with the Constitution, and the gap that remains is almost entirely operational. This document is the answer to that gap — not new philosophy, just the plumbing the existing philosophy depends on to be true in production, not just on paper.

**A note on tone:** this is written for a production SaaS startup preparing for real paying customers, not a checklist copied from a larger company's playbook. Every recommendation is sized to ReplyFlow's actual current stage — a handful of customers, one or two founders, a codebase that's already disciplined. Where something can wait, it says so, in line with the Constitution's own instruction not to build for hypothetical future requirements.

---

## 1. Monitoring & Observability

**Why it matters:** Confirmed in the Business Blueprint: no error tracking, no APM, no uptime monitoring, no log aggregation beyond whatever Vercel retains by default. Today, if something breaks, the first person to know is the customer.

**How it supports the Founder Constitution:** Directly serves *"ReplyFlow will never leave a business owner wondering whether their business is being looked after."* That promise requires ReplyFlow to know first — this is the single most literal piece of infrastructure the Constitution's central claim depends on.

**MVP implementation:** A hosted error/APM tool with first-class Next.js support (Sentry is the obvious choice — generous free tier at this scale, minimal setup, Vercel-native). Wrap the existing `console.error`/`console.warn` call sites so failures report somewhere durable instead of vanishing into ephemeral function logs. Add lightweight external uptime monitoring against the app's health and the WhatsApp webhook endpoint specifically, alerting by email or a shared channel the moment either goes quiet. This alone closes the largest single gap found across both prior reports.

**Scaling plan:** As volume grows, add real dashboards for latency and error-rate trends, route logs to a proper aggregation store, and tie alert thresholds to the SLOs defined in §7 rather than to raw error counts.

**Priority: Critical**

---

## 2. Error Reporting

**Why it matters:** Distinct from general monitoring — this is specifically about turning a caught exception (a webhook failure, an OpenAI call failure, a database error) into an actionable signal with enough context to actually debug, rather than a line of console output.

**How it supports the Founder Constitution:** *"Build for reliability before intelligence."* A system that can't tell its operators what broke, and why, can't be reliable no matter how good its reasoning is.

**MVP implementation:** Every API route and every reply-engine catch block reports to the tool chosen in §1, tagged with `business_id`/`conversation_id` for triage — deliberately never with customer message content or PII in the error payload itself, consistent with the Constitution's existing non-negotiable data boundaries (`07-Engineering-Principles.md` §7). A basic severity convention (e.g., "customer-visible" vs "internal-only") from day one, so an alert firing at 2am can be triaged at a glance.

**Scaling plan:** Formal error-triage ownership, a response-time expectation per severity tier, and a direct feed into the incident response process (§10) rather than a parallel, disconnected system.

**Priority: Critical**

---

## 3. Usage Analytics

**Why it matters:** Distinct from AI cost tracking (§4) — this is product usage: messages handled, drafts approved/edited/rejected, onboarding funnel completion, escalation frequency. None of it is currently captured anywhere. The correction/learning loop's own data model (`reply_outcomes`, `reply_corrections`) remains undesigned, meaning ReplyFlow currently can't see its own usage patterns at all.

**How it supports the Founder Constitution:** *"It earns responsibility over time"* needs to be measurable, not assumed. And *"the owner should think less"* is a claim that should be checked against real behaviour, not just design intent.

**MVP implementation:** A simple, first-party events table — draft created/approved/edited/rejected, escalation triggered, Work Card created/booked, onboarding step completed — logged server-side, queryable internally. Deliberately not a third-party product-analytics SaaS bolted onto customer conversations at this stage: the data involved is sensitive (real customer conversations about real people's homes and problems), and a lightweight, purpose-built, first-party approach is more consistent with the Constitution's own restraint (*"Simplicity is a feature"*) than adopting a general-purpose analytics platform before there's a proven need for one.

**Scaling plan:** This becomes the feed for the correction/learning loop and the founder metrics dashboard (§12). A dedicated analytics tool only becomes worth the added data-handling surface once usage volume genuinely outgrows what first-party queries can answer.

**Priority: High**

---

## 4. AI Token and Cost Tracking

**Why it matters:** The single highest-leverage, lowest-effort item on this entire blueprint. Confirmed directly in the Business Blueprint: the OpenAI SDK returns token counts on every call already, and nothing in the codebase reads or stores them. This isn't a build-from-scratch problem — it's a "start persisting data that's already being handed to you" problem.

**How it supports the Founder Constitution:** *"Peace of mind that is: Confident. Reliable. Consistent. Predictable."* ReplyFlow cannot offer predictability it doesn't have visibility into for itself. This is also the precondition for responsible pricing (§6) and for the reliability targets in §7.

**MVP implementation:** Persist token counts and an estimated cost for every real OpenAI call, tagged by business, conversation, and call site (classify vs. generate vs. the onboarding demo). Given how directly this connects to real spend, this should ship in the same pass as the rate-limiting and onboarding-demo-cost-bug fix already flagged Critical in the Compliance Roadmap (C2) — the fix and the visibility into whether it worked belong together.

**Scaling plan:** Per-business cost dashboards, automatic alerts on anomalous spend, and eventually a real per-business cost ceiling — none of which are possible until this baseline exists.

**Priority: Critical**

---

## 5. Customer Support Workflow

**Why it matters:** Zero support tooling or channel exists today. No support email, no help widget, no way for a real owner to reach a real person.

**How it supports the Founder Constitution:** *"Whether the answer is action, advice or reassurance, the owner should always feel supported."* This is currently a claim with no operational backing at all.

**MVP implementation:** A real, monitored inbox — doesn't need to be a full helpdesk platform yet; a well-organised shared inbox is enough at this stage. Paired with a short internal runbook for the two failure modes most likely to actually occur (the AI said something wrong; the WhatsApp connection broke), and an honest, even informal, response-time expectation stated to early customers rather than left unsaid.

**Scaling plan:** A proper helpdesk tool once volume justifies it, an in-app contact surface, a self-serve FAQ, and eventually a dedicated support hire — none of which change the MVP requirement that a channel exists at all before the first paying customer.

**Priority: Critical**

---

## 6. Billing and Subscription Lifecycle

**Why it matters:** Confirmed in the Business Blueprint: no Stripe, no plan or trial state anywhere in the schema. "7-day free trial, no credit card required" is marketing copy with nothing behind it — ReplyFlow cannot take a paying customer today.

**How it supports the Founder Constitution:** The Constitution's own definition of success — *"Could this business confidently operate without ReplyFlow? ... 'I genuinely wouldn't want to.'"* — cannot be tested without a real paying relationship to ask the question of.

**MVP implementation:** Stripe, for the same reason most SaaS products reach for it — mature Next.js integration, and it keeps payment credentials entirely off ReplyFlow's own systems, which is itself consistent with the Constitution's existing data-boundary discipline (never handling anything resembling payment credentials). One flat plan to start, matching the pricing-philosophy conclusion already reached in the Business Blueprint — predictability over usage-based billing complexity, for a buyer who already deals with unpredictable income job to job. Subscription status (trialing/active/past_due/canceled) should gate access gracefully and honestly — a lapsed payment should be communicated plainly before anything restricts, never a silent lockout, consistent with *"Understanding before explanation."*

**Scaling plan:** Multiple plan tiers once real usage/cost data (§3, §4) justifies them, self-serve plan management, and proper dunning for failed payments.

**Priority: High** — not blocking the operational safety net itself, but blocking the ability to respond­sibly take money from a first real customer, and sequenced accordingly (see §Recommended Order).

---

## 7. Reliability Targets (SLIs/SLOs)

**Why it matters:** No reliability target is currently defined anywhere. Monitoring (§1) needs something to alert *against* — without a target, an alert threshold is just a guess.

**How it supports the Founder Constitution:** *"Reliable. Consistent. Predictable."* are specific claims, and specific claims need a specific, checkable definition behind them — the same discipline the Constitution already applies to the receptionist's own conversational honesty, applied here to the business's operational honesty.

**MVP implementation:** A small number of real, owner-relevant SLIs, not a large formal SRE programme — internal targets at this stage, not customer-facing SLA commitments, in keeping with *"trust is earned,"* not asserted via an unproven badge:
- Message-to-draft latency (e.g., a target that the large majority of real customer messages produce a drafted reply within a defined window).
- WhatsApp connection health detection latency (a broken connection should be detected and alerted on quickly, not discovered days later).
- Reply-engine failure rate (the honest fallback path already exists in code — the target is that it's rarely needed, and always logged when it is).

**Scaling plan:** As real data accumulates, these can mature into genuine, publicly stated commitments, with an error budget that governs how aggressively new features can ship without risking them.

**Priority: High** — cheap to define, and defining them shapes what §1 should actually alert on, so this belongs early even though the infrastructure to formally guarantee them matures later.

---

## 8. Security and Access Controls

**Why it matters:** The Business Blueprint confirmed genuine database-level Row Level Security — a real strength. What hasn't been assessed is *operational* security: who on the team can access what, how secrets are managed, whether shared admin accounts (Supabase, Vercel, Meta, OpenAI) have real protection, and what access trail exists into real customer data.

**How it supports the Founder Constitution:** Extends the existing *"non-negotiable data boundaries"* principle (already applied to what the model sees) to who on the team can see what — the same discipline, a different surface.

**MVP implementation:** 2FA enforced on every shared administrative account. A clear, short answer to "who has production database access, and why" — ideally a small, named list, not "everyone with the service-role key." Any internal tool built under §11 gets its own scoped authentication from day one, rather than inheriting raw database access as a shortcut that's harder to undo later.

**Scaling plan:** A periodic access review, formal offboarding checklist as the team grows, and SOC2-style controls if and when an enterprise customer or an investor actually requires them — not before, per the Constitution's own instruction against building for hypothetical requirements.

**Priority: High**

---

## 9. Backup and Recovery Strategy

**Why it matters:** No documented backup policy exists. Supabase's infrastructure may provide some default protection, but this hasn't been confirmed, and — more importantly — never tested as an actual, working restore.

**How it supports the Founder Constitution:** A business's entire customer relationship history lives in ReplyFlow. *"Reliable. Consistent."* has to include "the data survives," not just "the app responds."

**MVP implementation:** Confirm and, if needed, upgrade to Supabase's point-in-time recovery. Document — and actually perform once — a real restore, since a backup that's never been tested is a hope, not a plan. Define, even roughly, how much data loss would be tolerable in the worst realistic case.

**Scaling plan:** Automated, periodic restore testing rather than a one-time exercise, and longer retention windows if compliance requirements ever demand them.

**Priority: High**

---

## 10. Incident Response Process

**Why it matters:** §1–§4 are about detecting a problem. This is about what happens in the moment after detection — currently, nothing is defined.

**How it supports the Founder Constitution:** Directly serves *"the owner should always feel supported,"* and mirrors a principle the product already applies to customers back onto the founders' own operational conduct — own a mistake plainly, no defensive template language, the same standard the receptionist herself is held to in every customer-facing failure.

**MVP implementation:** A short, written runbook: who gets notified when an alert fires, a simple severity classification (customer-visible outage / degraded but working / internal-only), and a plain-language communication approach for telling an affected owner what happened, honestly, without over-explaining or under-explaining. A lightweight postmortem habit for anything customer-visible — what happened, why, what changes as a result — mirroring the exact discipline the adversarial reply-engine test suite already applies to product bugs (`07-Engineering-Principles.md` §5: every real bug becomes a permanent regression scenario), just applied to operational incidents instead.

**Scaling plan:** A real on-call rotation once there's a team to rotate, a public status page, and a more formal postmortem process with tracked follow-up actions.

**Priority: High**

---

## 11. Internal Admin Tools

**Why it matters:** No admin tooling exists anywhere — no way for the team to see across businesses, inspect a specific conversation's reasoning trace, or check an account's status without querying the database directly.

**How it supports the Founder Constitution:** This is what actually makes §5 (support) and §10 (incident response) executable well rather than guesswork. It also indirectly protects *"the owner always remains the decision maker"* — good tooling makes it easier to see and correct a mistake quickly, which is the operational side of the same principle.

**MVP implementation:** A minimal, internal-only, properly access-controlled view (never customer-facing) showing: a business's real conversation history alongside the reasoning trace already computed and stored for every reply (`facts_used`, confidence, escalation reason — none of this needs building fresh, only surfacing), basic connection and account status, and simple lookup by business. Built with its own real authentication from the start (ties directly to §8), not as an internal script that quietly becomes load-bearing.

**Scaling plan:** Richer tooling as volume grows — consent-based support login for hands-on debugging, bulk operations, and a cost/usage view per business fed directly by §4.

**Priority: Medium** — genuinely valuable, but a very small early cohort can be supported via direct, careful database access; this becomes urgent specifically around the "100 customers" mark the Business Blueprint already identified as the point manual support stops scaling, not necessarily before the very first customer.

---

## 12. Metrics Dashboard for Founders

**Why it matters:** The founders currently have no single place to see how the business is actually doing — retention, cost per customer, message volume, escalation rate. Every item the Business Blueprint's "Success Metrics" section flagged as unmeasurable traces back to this gap.

**How it supports the Founder Constitution:** *"Success is measured by one question: Could this business confidently operate without ReplyFlow?"* — the founders need visibility into the precursor signals (retention, satisfaction, real cost) to ever responsibly answer that question about their own business, not just their customers'.

**MVP implementation:** Once §3 and §4 exist, even a simple periodic report (a query, not necessarily a polished UI at first) surfacing: active businesses, trial-to-paid conversion once §6 exists, average and outlier cost per business, escalation and error rates, and the draft approve/edit/reject ratio — currently the closest available proxy for "is she genuinely getting better," in the absence of the full correction/learning loop.

**Scaling plan:** A real internal dashboard UI, cohort retention curves over time, and automatic flags on any business whose usage or error pattern looks anomalous.

**Priority: Medium** — depends on §3/§4 existing first, and matters more for running the business well once there are customers to measure than for reaching the first one.

---

## Recommended Implementation Order

Sequenced to minimise risk specifically — fix active harm first, build the safety net before money changes hands, then enable revenue, then invest in scale. Not sequenced by ease.

**Phase 0 — Stop the bleeding, cheap and foundational**
1. AI token/cost tracking (§4) — the data already exists; this is persistence, not invention.
2. Fix the onboarding demo's uncapped-cost bug and add basic rate limiting (already Critical in the Compliance Roadmap, C2) — ships alongside §4 since both are the same underlying problem.
3. Define the initial SLIs/SLOs (§7) — cheap, and shapes what Phase 1 should actually alert on.

**Phase 1 — The safety net, before any customer is exposed to its absence**
4. Monitoring, observability, and error reporting (§1, §2) — bundled; both need the same underlying tool.
5. Confirm and test real backup/recovery (§9) — cheap to verify, catastrophic if skipped and never checked.

**Phase 2 — The human safety net**
6. Customer support workflow MVP (§5) — a real inbox and a runbook.
7. Incident response process (§10) — what actually happens when Phase 1's alerts fire.
8. Security and access baseline (§8) — 2FA and access hygiene, before any new privileged tooling (§11) gets built on top of a weak foundation.

**Phase 3 — Now it's responsible to take money**
9. Billing (§6) — real pricing, informed by the cost data Phase 0 produced, entered into only once Phases 1–2 mean a paying customer isn't exposed to an undetected, unsupported failure.
10. Usage analytics, broadened (§3) — some of this starts informally in Phase 0; this is where it becomes a real, structured events pipeline.

**Phase 4 — Scale-enabling, follows shortly after the first real customers, not necessarily before them**
11. Internal admin tools (§11) — becomes urgent as manual support stops scaling.
12. Founder metrics dashboard (§12) — once there's real usage, cost, and billing data worth looking at.

The logic throughout: nothing in Phase 3 should ship ahead of Phase 1 — taking a real customer's money before the safety net exists means the first real test of *"ReplyFlow will never leave a business owner wondering whether their business is being looked after"* would be run without anything in place to keep that promise if it's tested for real.
