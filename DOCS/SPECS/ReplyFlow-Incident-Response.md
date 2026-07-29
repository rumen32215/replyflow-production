# ReplyFlow Incident Response

**Master Execution Plan 1.3.** Constitution: *"the owner should always feel supported"* (`00-Founder-Constitution.md`, Product Promise) — mirrored back onto ReplyFlow's own operational conduct: own a mistake plainly, no defensive template language, the same standard the receptionist herself is held to in every customer-facing failure (`ReplyFlow-Operations-Blueprint.md` §10).

This is a short, written runbook — not tooling. What exists to support it: `error_events` (1.1, durable capture of every real pipeline/webhook failure), `notifyCriticalIncident` (1.3, active alerting — currently inert, see below), and the honest state of `DOCS/SPECS/ReplyFlow-Backup-Recovery.md` (1.2, no managed backups on the current plan).

---

## Severity classification

Reuses `error_events.severity` as the technical signal, mapped to the Operations Blueprint's own customer-impact framing — the classification that actually matters for how to respond is about who's affected, not which line of code caught the error:

| Customer-impact tier | What it means | Maps to `error_events.severity` / real sources today |
|---|---|---|
| **Customer-visible outage** | A real customer's message went unanswered, or a business's WhatsApp connection is fully broken | `critical` — `reply-engine.pipeline_failure`, `webhook.processing_failed`, `webhook.signature_invalid` (missing-secret case only — see below) |
| **Degraded but working** | The system recovered on its own (a fallback fired, an approved reply failed to send once) but something real broke | `error`/`warning` — `reply-engine.send_failed`, `reply-engine.classify_failed`, `reply-engine.generate_failed` |
| **Internal-only** | Nothing a customer or business owner would ever notice | `warning` — `webhook.signature_invalid` (routine scanner noise — see 1.1's own reasoning for why this stays low-severity by default), `webhook.invalid_payload`, `receptionist.live_reply_failed` (owner-facing preview only) |

Not every `critical` row is automatically a customer-visible outage and vice versa — `webhook.signature_invalid` is `critical` only when `WHATSAPP_APP_SECRET` itself is unset (a real, total outage of the receive path); the far more common "one bad signature" case is `warning` (near-certainly scanner noise, judged by rate not by any single occurrence — 1.1's own documented reasoning). Use judgement against `scripts/monitoring/error-summary.mjs`'s actual output, not the severity label alone in isolation.

---

## Who's notified, and how

**Today, honestly:** a `critical` `error_events` row triggers `notifyCriticalIncident()` (`lib/incident-alert.ts`), which POSTs to `INCIDENT_ALERT_WEBHOOK_URL` — **an environment variable that is not currently set in production.** The function is fully built and verified (see below), but is deliberately inert until a real channel exists — no alert fires today, and this document does not claim otherwise.

**To activate it:** set `INCIDENT_ALERT_WEBHOOK_URL` to a Slack or Discord incoming webhook URL (both accept the exact JSON shape this sends, `{"text": "..."}`, unmodified), or any other endpoint that accepts a JSON POST. A five-minute task once a channel is chosen — not an engineering task.

**Until then, the interim process:** run `node scripts/monitoring/error-summary.mjs [hours]` manually and regularly (daily, at minimum, until active alerting is on). This is a real, working gap-filler, not a placeholder — it was exactly this script that surfaced the real incident walked through below.

---

## Owner communication — telling an affected business

When a **customer-visible outage** affects a specific business (identifiable via `error_events.business_id`), the Constitution's own voice standard applies to the founders' own words, not just the receptionist's: plain language, own it, no jargon, no over-explaining, no under-explaining. A short template:

> Hi [name] — wanted to let you know [what happened, in one plain sentence] between [time] and [time]. [What we did / are doing about it]. [Any action needed from them, or "nothing you need to do"]. Sorry for the disruption — reach out if anything looks off.

What this deliberately avoids, matching the same discipline already enforced in the reply engine's own safety layer: no invented cause before it's actually known, no over-promising a fix time that hasn't been confirmed, no corporate-incident-report tone. If the cause isn't known yet, the honest version is *"we're still looking into exactly why — I'll update you once we know."*

**Degraded-but-working** incidents (the system recovered on its own) generally don't need proactive owner outreach — matching the Constitution's own "sometimes the most valuable update is nothing needs to change" instinct — unless the same business is affected repeatedly, at which point it crosses into customer-visible territory and should be communicated.

---

## Postmortem habit

For anything that reached **customer-visible outage**, mirroring the exact discipline already used for reply-engine bugs (`07-Engineering-Principles.md` §5: *"every real bug found through adversarial testing becomes a permanent scenario in this suite, never just a one-off fix"*) — applied here to operational incidents instead of reply-quality ones:

1. **What happened** — plain description, timestamps, which business(es)/how many messages.
2. **Why** — the real root cause, not the first plausible guess.
3. **Customer/owner impact** — was anyone actually told; should they have been.
4. **What changes as a result** — every real incident should leave something more resilient than it found: a new `error_events` source if one was missing, a runbook correction, a code fix, or (for a reply-engine bug specifically) a new scenario in `scripts/reply-engine-tests/scenarios.mjs`. An incident that changes nothing was not actually learned from.

No tooling for this — a short written note (this document, or a dated addendum to it) is sufficient at this stage, matching the Operations Blueprint's own "size the process to ReplyFlow's actual current stage" instruction.

---

## Walkthrough against a real incident (required before calling this runbook complete)

Per Task 1.3's own success criteria, this runbook needs to be walked through against a real or simulated incident. A real one already existed in production telemetry — using it rather than fabricating a scenario:

**1. What happened.** During 1.1's post-deploy regression suite run (2026-07-29), `scripts/monitoring/error-summary.mjs` surfaced 4 real `reply-engine.send_failed` events (`error` severity) for business `fa01c62e-…` ("SHABZ", the founder's own connected test business) within a two-minute window, each with `errorDetail: "Graph API send message failed: Authentication Error"`.

**2. Classify it.** `error` severity, `reply-engine.send_failed` — per the table above, this is **degraded but working**: the reply pipeline itself worked correctly (a draft was produced, the safety layer evaluated it, auto-send was attempted), but the final WhatsApp delivery step failed. Not a `critical` pipeline failure.

**3. Who's notified.** Under the classification above, degraded-but-working doesn't page anyone automatically (correctly — a single business's stale token isn't a systemic outage). It was caught by manually running `error-summary.mjs`, exactly the interim process this document specifies for exactly this severity tier.

**4. Investigate the real cause.** Cross-checked against `reply_drafts.error_message` history: the identical `"Graph API send message failed: Authentication Error"` string already appeared for the same business on 2026-07-24 and 2026-07-26 — this is a **pre-existing, real condition**: the QA business's WhatsApp access token has been stale for days, not something the 1.1 deploy caused. (Confirmed directly in `1.1`'s own commit history — this exact cross-check is what distinguished "did my change break something" from "this was already true.")

**5. Owner communication.** This business is the founder's own test account, not a real paying customer — no external communication was needed for this specific occurrence. Had this been a real business, the template above would apply: *"Hi [name] — I noticed messages haven't been sending to your customers since [date] because your WhatsApp connection needs reconnecting. Nothing else was affected. Here's how to reconnect: [link] — let me know once it's done and I'll confirm everything's flowing again."*

**6. What changes as a result.** Two real, small findings, recorded here rather than acted on mid-walkthrough (correctly out of scope for this task):
   - The QA business's WhatsApp connection should be reconnected as routine housekeeping (trivial, not urgent, not a code change).
   - `reply-engine.send_failed` is currently `error`, not `critical` — correct for a single occurrence, but this runbook doesn't yet define an escalation rule for *repeated* failures against the *same* business (3 occurrences across 5 days here). That's a real gap worth a small, future addition (e.g., `error-summary.mjs` flagging repeat offenders) — recorded as a follow-up, not built now, to stay within 1.3's scope.

**This walkthrough is the "performed against a simulated incident" this task's success criteria asks for** — using a real one instead of an invented scenario, since one was already sitting in the data.
