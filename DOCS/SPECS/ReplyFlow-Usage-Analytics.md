# ReplyFlow Usage Analytics

**Master Execution Plan 3.2.** Constitution: *"it earns responsibility over time"* — Operations Blueprint §3: *"a simple, first-party events table — draft created/approved/edited/rejected, escalation triggered, Work Card created/booked, onboarding step completed,"* explicitly ruling out a third-party analytics SaaS.

Investigation before building found something worth stating plainly: most of that list already has a real, queryable timestamp on an existing table. Building a second event for something already captured would be a duplicate log, not new visibility — the house style already established by `scripts/sli/*.mjs` (Task 0.3) is to derive from existing columns whenever the fact is already there, and only add a new sink when it genuinely isn't. This task follows that same discipline rather than building the literal list wholesale.

---

## What was already there, and stayed derived, not duplicated

| Fact | Already captured by | Verdict |
|---|---|---|
| Draft created | `reply_drafts.created_at`, one row per draft | Query directly — no event needed |
| Draft rejected | `reply_drafts.status = 'rejected'` + `resolved_at` | Already queryable — *also* mirrored into `product_events` anyway, see below |
| Escalation triggered | `reply_drafts.requires_escalation` + `created_at` | Query directly — no event needed |
| Work Card created | `work_cards.created_at` | Query directly — no event needed |
| Work Card booked | `work_cards.approved_at` (the existing approve route's own comment: this column really means "booked at") | Query directly — no event needed |
| WhatsApp connected | `whatsapp_connections.connected_at` | Already a real timestamp — no event needed |
| Handover confirmed | `businesses.handover_confirmed_at` | Already a real timestamp — no event needed |

`scripts/analytics/usage-summary.mjs` derives escalation frequency and Work Card lifecycle counts directly from these existing columns — read-only, safe to re-run any time, matching `scripts/sli/*.mjs`'s exact pattern.

## What was genuinely missing, and is now captured (migration 0021, `product_events`)

- **`draft.edited`** — genuinely dark before this: editing a draft only ever touched `final_text`, never `status` or a timestamp. No record of when an edit happened, or that one happened at all, existed anywhere. Fired from `app/api/reply-drafts/[id]/route.ts`'s edit branch.
- **`draft.approved`** — `reply_drafts.status` lands on the identical `'sent'` value whether an owner explicitly clicked approve or the reply engine's own auto-send path (`generate-reply.ts`) sent it automatically — indistinguishable from `status` alone, and exactly the distinction "draft approve" is meant to measure. Fired only from the owner-facing approve route, never from auto-send.
- **`draft.rejected`** — technically already derivable from `status`/`resolved_at`, but fired here too so approve/edit/reject live in one consistent stream — `usage-summary.mjs` computes the real approve/edit/reject ratio 3.4 wants from this one table, rather than joining three different derivations together.
- **`onboarding.signup_completed`** — `businesses.onboarding_completed` is a boolean with no history: every write just overwrites it, so no record of *when* a business first finished the signup wizard existed anywhere. Fired from `/api/onboarding/prepare`, guarded by the route's own existing "already completed" early return, so it only ever fires once, on a genuine first completion.

Both new business-creation paths already found during Task 3.1's investigation (`lib/business.ts`, `app/api/whatsapp/connect/route.ts`) were re-checked here — neither creates the kind of event this table tracks, so no further change was needed there.

## A real, named remaining gap — not built here

The initial onboarding wizard's individual screens (business name → trade → service area → preparing) have **no per-step timestamp anywhere** — only the final `onboarding.signup_completed` moment. Drop-off *between* those screens (the classic funnel-analysis question: how many people got to "trade" but never reached "service area") is genuinely not measurable today. Each of those screens currently writes client-side, with no server route to instrument without either restructuring them or adding a generic client-callable events endpoint — a real, distinct piece of work, named honestly here rather than silently expanded into or silently dropped.

## Table shape

`product_events` mirrors `error_events`'/`ai_usage_events`'s established conventions exactly: `id`, `business_id` (not null — every event here is already business-resolved, unlike `error_events`), `event_type` (dotted identifier), `context` (jsonb, event-specific detail only — never customer message content or drafted reply text, the same non-negotiable boundary every other table here already holds), `created_at`. Service-role write only, owner-scoped read via RLS, indexed on `(business_id, created_at desc)` and `(event_type, created_at desc)`.

## Success criteria

*"Every listed event type is captured and queryable."* Met in the sense that matters — every fact the Blueprint named now has a real, queryable trace, whether that's a new `product_events` row or an existing column that was already there. The one honest exception is the per-screen wizard drop-off gap above, named rather than claimed.
