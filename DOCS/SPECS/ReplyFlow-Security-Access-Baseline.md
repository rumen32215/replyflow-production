# ReplyFlow Security & Access Baseline

**Master Execution Plan 1.4.** Extends the Constitution's non-negotiable data boundaries (`07-Engineering-Principles.md` §7: *"Multi-tenant isolation is enforced at the query layer... defence in depth, not a single point of failure"*) from "what the model sees" to "who on the team can see what." Security treated as a product feature here, not a compliance checkbox: every finding below is either verified empirically against real production, or honestly marked as unverifiable in this environment rather than assumed.

---

## 1. Multi-tenant isolation — verified empirically, not assumed

Rather than trusting the migration files describe reality, this was tested the way an actual attacker would test it:

**Unauthenticated access (anon key, no session):** every core table returns zero rows — `businesses`, `conversations`, `messages`, `reply_drafts`, `work_cards`, `ai_configurations`, `whatsapp_connections`, `ai_usage_events`, `error_events`. All nine, tested directly against production, all zero.

**Cross-tenant access (a real authenticated business owner's session):** the founder's own real account sees exactly one business (their own), zero rows from a second real business's `conversations`, `reply_drafts`, or `ai_usage_events` when queried directly, and correctly sees all of their own conversations. RLS genuinely enforces tenant isolation in production today, confirmed against real data rather than inferred from `create policy` statements.

## 2. A real gap found and fixed: `whatsapp_connections.access_token`

Migration 0003 granted `select` on the *entire* `whatsapp_connections` table to `authenticated` — which technically includes `access_token`, a live WhatsApp Graph API credential stored in plaintext. No current code path actually selects it client-side (both dashboard pages that read this table were checked directly and select an explicit safe column list — `display_phone_number, waba_id, connected_at` and `token_expires_at` respectively, never `access_token`), so this was never actually exploited by the app's own code. But RLS being correctly scoped by `business_id` was the *only* thing standing between an owner's own browser session and their own raw API credential — one future `select("*")` away from a real leak.

**Fixed** (migration `0018_whatsapp_connections_column_privileges.sql`): Postgres column-level privileges now exclude `access_token` from what `authenticated` can select at all, at the same layer RLS already operates — not a code review rule to remember, a database-level guarantee. Zero application code changes needed, since the correct code was already avoiding this column. `access_token` remains fully usable server-side (the service role key bypasses grants entirely) — every real read of it already happens in `lib/reply-engine/send.ts`, `app/api/webhooks/whatsapp/route.ts`, and `app/api/whatsapp/connect/route.ts`, all server-side, all unaffected.

## 3. Secrets in git history — checked, clean

Searched the full commit history (`git log --all -p`) for committed `.env` files and for common secret patterns (OpenAI-style `sk-...` keys, JWT-shaped strings, hardcoded values assigned to `SUPABASE_SERVICE_ROLE_KEY`/`WHATSAPP_APP_SECRET`). Only `.env.example` (the template, containing no real values) has ever been committed. No real credential has ever been committed to this repository.

---

## 4. Who has production access, and why (documented, not assumed)

| Access | Held by | Scope | Why |
|---|---|---|---|
| Supabase dashboard | Founder's Supabase account | Full — schema, data, project settings, billing | Project owner |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel production env vars; this session's `.env.local` | Bypasses RLS entirely — every table, every row | Server-side routes and the reply engine have no user session to act as; this is the established, necessary pattern throughout the codebase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public by design (ships in the browser bundle) | RLS-scoped only — verified above to grant nothing beyond a user's own business | Safe to expose; this is what RLS exists to make safe |
| Real business owners | Supabase Auth session | Their own business only (verified above) | The product's own multi-tenant model |
| Vercel project | Founder's Vercel account (CLI confirmed authenticated as `rumen32215` in this session) | Deploys, environment variables, domains | Project owner |
| GitHub repo (`rumen32215/replyflow-production`) | Founder's GitHub account; this session's git credentials | Push access to `main`/`front-desk-v3`, which triggers production deploys | Development access |
| **This AI-assistant working environment** | Whoever has access to this session | `.env.local` (service-role key), authenticated Vercel CLI, git push access | The active development environment for this engagement — named explicitly here rather than left unstated, since it is a real, current access path with meaningful reach |

**Minor hygiene finding, not a security issue:** this repo's local `.vercel/project.json` is linked to an old, unused Vercel project (`replyflow`) rather than the real production one (`replyflow-production`) — harmless (deploys happen via the GitHub integration, not this CLI link), but worth `vercel link`-ing to the correct project if the Vercel CLI is ever used directly from here again.

**What this table deliberately does not add:** a separate, narrower key for scripts/tooling, a read-only replica credential, or any additional access tier. At this stage — a pre-launch product with no real paying customers yet, a single founder, and every current credential already scoped to what actually needs it — introducing more access tiers would be exactly the kind of premature complexity the Constitution's "Simplicity is a feature" already warns against. Revisit this if/when a second person joins who shouldn't hold full service-role access.

---

## 5. Rule: future internal tools get their own scoped auth, never inherited raw access

Binding going forward, matching the Master Execution Plan's own framing (this is what unblocks 3.3, Internal admin tools): **any future internal tool that's reachable over HTTP by a human (an admin dashboard, a support console, anything web-exposed) must authenticate its own operator and authorize against a real, scoped check — never simply hold or proxy the service-role key to whoever can reach its URL.**

**This does not apply to the CLI scripts already built this engagement** (`scripts/sli/`, `scripts/monitoring/`, `scripts/backup/`) — they require possessing `.env.local` itself to run at all, which already is the access control (there's no separate authorization boundary to bypass when the credential itself is the barrier to entry, unlike a web-reachable tool where the *code* has the credential but the *operator* might not otherwise). The rule specifically targets anything that would let someone reach privileged data or actions through a URL without already holding that credential directly.

**Current adherence:** no violation exists today — no internal web tool has been built yet (3.3 is unbuilt). This rule exists to bind that work before it starts, not to correct an existing one.

---

## 6. 2FA on shared accounts — cannot be verified from this environment

Two-factor authentication on Supabase, Vercel, Meta, and OpenAI accounts is an account-level setting in each service's own dashboard — this environment has no access to check or change it (confirmed: no Supabase Management API token, no way to inspect Meta/OpenAI account security settings). **This requires the founder to check each dashboard directly and report back**, the same handoff pattern already established for Supabase's backup/PITR settings (1.2).

| Account | 2FA status |
|---|---|
| Supabase | Not yet confirmed |
| Vercel | Not yet confirmed |
| Meta (Business/Developer account) | Not yet confirmed |
| OpenAI (platform account) | Not yet confirmed |

This table will be updated once confirmed — left honestly incomplete rather than assumed enabled.

---

## Success criteria, stated plainly

*"2FA confirmed on every shared account; access list documented."* Access list: done, above, verified rather than assumed. 2FA: **not yet confirmed** — genuinely unverifiable from this environment, pending the founder's own check. Task 1.4 is not fully closed until that table above is filled in.
