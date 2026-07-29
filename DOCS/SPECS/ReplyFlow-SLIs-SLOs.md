# ReplyFlow SLIs & SLOs

**Master Execution Plan 0.3.** A small number of real, owner-relevant reliability targets, each defined precisely enough to check — not aspirational language, a specific number computed from real data. Constitution: *"ReplyFlow should create a peace of mind that is: Confident. Reliable. Consistent. Predictable... Owners should not wonder: Did it remember? Did it understand? Did it miss something?"* (`00-Founder-Constitution.md`, Peace Of Mind). A promise like that only means something if it's checkable.

Internal targets, not customer-facing SLAs — matching `ReplyFlow-Operations-Blueprint.md` §7's own recommendation for this stage. These are what Phase 1's monitoring (1.1) will alert against once it exists; they don't replace it, they define what it should watch for.

Each SLI below states: **what it measures**, **whether it's measurable today** (and how, precisely — no new instrumentation was added for this task beyond what's noted), **the real baseline as of 2026-07-29**, and **the target**.

---

## 1. Message-to-draft latency

**What it measures:** elapsed time between a real inbound customer message arriving (`messages.created_at`) and the reply pipeline producing its draft (`reply_drafts.created_at`), joined on the existing unique `customer_message_id` key.

**Measurable today:** yes, directly — both columns have existed since Sprint 9/10A; no schema change was needed. `scripts/sli/message-to-draft-latency.mjs` computes it from real data (excludes Test Conversations and the adversarial suite's synthetic traffic).

**Real baseline (last 30 days, 114 real customer messages):**
- p50: **4.32s**
- p95: **6.23s**
- max: **9.29s**

**Target:** p95 < 10s. Set with headroom above the observed real p95 (6.23s) — codifying current real performance as the floor to hold steady or improve, not an arbitrary aspirational number.

---

## 2. WhatsApp-disconnect detection time

**What it measures:** elapsed time between a business's WhatsApp connection actually breaking (token expiry) and ReplyFlow surfacing that to the owner.

**Measurable today: no — stated honestly rather than forcing a number.** `describeConnectionHealth()` (`lib/front-desk-signals.ts`) is a pure, on-demand comparison of `tokenExpiresAt` against "now," evaluated only when a page (Front Desk / WhatsApp settings) actually renders. There is no active polling, background job, or alert — detection today depends entirely on the owner happening to open the app after the connection has broken. There is nothing to compute a real baseline from, because nothing is currently watching.

**Target (aspirational, for Phase 1 to build against):** detect and surface a broken connection within 15 minutes of expiry, without the owner needing to open the app. This SLI stays unmeasurable — not "measured at 0%" or any other invented number — until Monitoring & error reporting (1.1) ships an active check. Building that check is explicitly out of scope for 0.3 (a documentation task); this target exists so 1.1 has a concrete number to build against rather than inventing one later.

**Update (1.1, 2026-07-29):** still not measurable. 1.1 shipped `error_events` and a health endpoint, but neither actively polls WhatsApp token expiry — `error_events` only captures failures that already threw somewhere in the pipeline, and a connection quietly expiring isn't one of those (nothing calls WhatsApp *proactively* to notice). This target remains open work, most naturally a small scheduled check added alongside the existing `describeConnectionHealth()` logic.

---

## 3. Reply-engine silent-drop rate

**What it measures:** real inbound customer messages, for businesses currently ready to act alone, with **zero** corresponding `reply_drafts` row at all — a total pipeline miss, distinct from a low-confidence-but-handled reply (which still gets a row) or a deliberate silence (`status: "no_reply_needed"`, which also still gets a row).

**Measurable today:** yes, approximately. `scripts/sli/silent-drop-rate.mjs` computes it from real data. Caveat stated plainly: "ready" uses each business's *current* `ai_configurations` state, not its state at the historical moment the message arrived (not versioned) — an honest approximation for a business that's been ready a while, not an exact retroactive audit.

**Real baseline (last 30 days, 120 real inbound messages, 1 ready business):** **5.00%** (6 of 120).

**Target:** 0%. Not a typo — the Constitution's Product Promise (*"ReplyFlow will never leave a business owner wondering whether their business is being looked after"*) doesn't leave room for a tolerated non-zero drop rate the way a p95 latency target does. The real baseline below shows this target is **not currently met** — that's the honest finding this task exists to surface, not something to round away.

### What the real 5% actually is

All 6 instances happened in one long-running real conversation (the founder's own connected test business) and, on inspection, share one precise pattern: **two inbound messages arrived within seconds of each other, before the first one's asynchronous processing (`waitUntil`) had finished.** The second message's processing read the first as recent history and answered both together in one reply — but only wrote a `reply_drafts` row keyed to the *second* message's `customer_message_id`. The first message's own row never got created. In every one of the 6 cases, a real, contextually-relevant outbound reply followed within seconds — the customer was not actually left hanging — but the earlier message has no auditable row of its own. One of the 6 was an inbound image (`[image message]`, the placeholder text stored for the already-documented photo/attachment gap, `09-Receptionist-Intelligence-Architecture.md` §7) that got consolidated the same way.

This means the 5% figure, read literally as "customers ignored," overstates the real severity — but it's still a genuine, reproducible gap (not every inbound message gets its own audit trail, which matters for anything downstream that reads `facts_used`/`reply_drafts` per-message, e.g. a future Work Card assembled from a specific message). **Flagged as a follow-up, deliberately not fixed here** — this is exactly the "reveal an improvement outside 0.3's scope, document it separately" case:

- **Candidate fix:** ensure every inbound message gets its own `reply_drafts` row even when consolidated into one drafted reply (e.g. write linked rows sharing the same draft text), so the SLI and any downstream per-message consumer are both accurate.
- **Where it belongs:** Phase 1 (closest to Monitoring/1.1) or a small standalone fix; not scoped or estimated here.
- **Update (1.1, 2026-07-29):** still open. 1.1's `reply-engine.pipeline_failure` event covers the *throwing* half of "silent drop" — a real uncaught exception in `generateReplyForMessage`. The rapid-consecutive-message consolidation pattern described above never throws (the code runs successfully, it just doesn't write a row for the earlier message), so it's a different mechanism and 1.1 doesn't close it. Two related but distinct gaps, not one.

### The other real gap this surfaced

A genuine LLM call failure inside `classifyMessage()`/`generateReplyDraft()` (their own internal `catch` blocks) degrades gracefully into the same low-confidence/escalated path as a genuinely uncertain real message, by design (`classify.ts`, `generate.ts`) — logged to Vercel's function logs via `console.error`, never persisted anywhere queryable. Today, **"the model call itself errored" and "the model was just genuinely unsure" are indistinguishable in the data.**

**Update (1.1, 2026-07-29): closed, partially.** Both catch blocks now also report to `error_events` (`reply-engine.classify_failed`/`reply-engine.generate_failed`, `warning` severity) — a genuine call failure is queryable now, not just a discarded log line. What's still true: the *drafted reply itself* still can't distinguish "the model call errored, so this is the fallback" from "the model answered but was genuinely unsure" purely by looking at `reply_drafts` — that distinction now lives in a separate table (`error_events`), correlatable by time/business but not joined automatically. Good enough to know *that* it's happening and *how often*; a deeper fix (e.g. a flag on the draft itself) would be a further, smaller follow-up, not needed to close the original observability gap.

---

## How to use this document

Re-run `scripts/sli/message-to-draft-latency.mjs` and `scripts/sli/silent-drop-rate.mjs` periodically (both read-only, safe against production) to track these against real data as volume grows — don't let the baselines above go stale without noticing. When Monitoring & error reporting (1.1) is built, its alert thresholds should come from the targets here, not be chosen independently.
