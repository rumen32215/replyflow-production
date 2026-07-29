# ReplyFlow Backup & Recovery

**Master Execution Plan 1.2.** Constitution: *"Peace of mind that is... Reliable. Consistent"* and *"Build for reliability before intelligence"* (`00-Founder-Constitution.md`) — a business's entire customer relationship history lives in ReplyFlow; "the data survives" is part of that promise, not a nice-to-have.

**This document leads with an honest limitation, not a completed checklist.** The original success criteria for this task was *"a real restore has been performed at least once and documented."* That has not happened, and this document says so plainly rather than rounding it away — per the founder's own explicit instruction not to claim a requirement is satisfied when it isn't.

---

## The real current state (confirmed directly, 2026-07-29)

The founder checked the production Supabase project's dashboard directly (Settings → Database → Backups). Confirmed:

| Capability | Status |
|---|---|
| Plan | **Free** |
| Scheduled backups | **Not available** |
| Point-in-time recovery (PITR) | **Not available** |
| Restore to a new project | **Not available on this plan** |

**What this means, stated plainly: ReplyFlow currently has no managed backup or recovery capability of any kind.** If the production database were lost, corrupted, or had a destructive query run against it today, there is no Supabase-native mechanism to recover any of it. This is not a hypothetical gap being pre-emptively documented — it is the actual, current state of the only environment this product runs in.

## Tolerable data-loss window

**Target (what should be true):** no more than 24 hours of data loss in a worst-case scenario — a reasonable, low-cost bar for an early-stage product with a small number of businesses, matching the Operations Blueprint's own instruction to size targets to ReplyFlow's actual current stage rather than a larger company's playbook.

**Actual current state: unbounded.** With no scheduled backup running, the honest floor is "however long it's been since someone last manually ran the export tool below" — which could be zero (never run) at any given moment. This target is **not currently met**, and cannot be met by application-level tooling alone; it requires the infrastructure change described below.

---

## What was built: a manual snapshot tool (a stopgap, not a fix)

`scripts/backup/export-snapshot.mjs` — reuses the same service-role-client pattern as every other operational script this engagement (0.1's `ai_usage_events`, 0.3's SLI scripts, 1.1's `error-summary.mjs`). Run on demand, it:

- Exports the core business-relationship tables (`businesses`, `conversations`, `messages`, `reply_drafts`, `work_cards`, `ai_configurations`, `whatsapp_connections`) to a single timestamped JSON file in `./backups/` (gitignored — this data must never be committed).
- **Excludes `whatsapp_connections.access_token`** — a live credential, not data to snapshot into a local file. Verified directly: the exported file genuinely does not contain the field.
- **Verifies its own completeness** — compares the number of exported rows per table against a live `count` query taken during the same run, so a silently truncated export is caught rather than trusted blindly.
- **Verifies referential consistency** — confirms every exported message and reply draft references a conversation that was actually captured in the same snapshot.

**Verified for real, 2026-07-29:** run against production. All 7 tables exported completely (row counts matched live counts exactly: 21 businesses, 9 conversations, 175 messages, 119 reply drafts, 1 work card, 12 AI configurations, 1 WhatsApp connection). Zero orphaned messages or drafts. `access_token` confirmed absent from the output. The verification snapshot was deleted immediately after confirming this — real business data should not sit in this working directory longer than it takes to verify the mechanism works.

### What this tool honestly does NOT provide

- **No schedule.** It only runs when a human runs it. A backup that depends on someone remembering is a much weaker guarantee than an automated one.
- **No redundant storage.** The output lands wherever the operator's machine is — if that machine is also lost, so is the backup. A real disaster-recovery posture needs the backup to live somewhere independent of the primary system.
- **No retention policy.** Nothing prunes old snapshots or manages how many exist.
- **No verified restore path.** See below.

This tool exists because zero automated recovery capability is worse than a manual stopgap costs to build (a few dozen lines, zero new infrastructure, zero new cost) — not because it's an adequate substitute for real backups. It should not be mistaken for one.

## Restore — documented, deliberately not built or claimed as verified

A genuine restore drill (actually loading a snapshot back into a database and confirming the result is correct) was **not performed**, and no restore script was written. Reasoning, not an oversight:

- Supabase Free provides no branching and no scratch/staging project. The only "target" available to test a restore against would be the live production project itself — restoring into production purely to test restoring is a destructive, unnecessary risk for zero real verification value, and directly conflicts with "preserve existing behaviour."
- Shipping a restore *script* that has never actually been run against a real target would be worse than not having one — untested "recovery" code creates false confidence, which is precisely what this Constitution's fact-grounding discipline exists to prevent everywhere else in this product. The same standard applies to the tooling that protects the product's own data.

**The documented (unverified) procedure, for whenever it's actually needed:**
1. Identify the most recent `backups/snapshot-*.json` file.
2. For each table in the snapshot, the exported rows can be re-inserted via the Supabase REST API (`POST /rest/v1/<table>` with the service role key) or pasted into the SQL Editor as `insert` statements generated from the JSON — either is mechanical, since the exported shape matches each table's real columns exactly (bar the deliberately-excluded `access_token`).
3. `whatsapp_connections.access_token` cannot be restored from this snapshot (it was never exported) — a reconnected business would need to redo the WhatsApp Embedded Signup flow to obtain a new token.
4. This procedure should be **run once for real against a genuine test target** (a scratch Supabase project, or once Pro-tier branching is available) before ever being relied on — until then, treat it as a plan, not a proven capability.

---

## The actual fix: a Supabase plan upgrade, when justified

Per the founder's own framing: the smallest production-ready path to a *real* recovery guarantee is upgrading the Supabase project to a paid tier (Pro, at time of writing) that includes automated daily backups, with point-in-time recovery available as an add-on — not more bespoke tooling. This is a genuinely managed, tested-by-Supabase, zero-maintenance capability that the application-level stopgap above cannot match no matter how much more code is written around it.

**Recommended trigger point:** before real paying customers depend on ReplyFlow, and no later than Phase 4 (Launch) — consistent with the Master Execution Plan's own framing that nothing in Phase 3/4 should ship ahead of the operational safety net existing for real. Exact current Supabase pricing should be checked directly at the time this decision is made rather than cited here, since it may change.

Once upgraded, this document should be revisited: confirm PITR/backup status directly in the dashboard (same as this task's opening step), define the retention window from what's actually configured, and — this time — perform and document one real restore, since Pro-tier branching or a scratch project would finally make that safe to do.
