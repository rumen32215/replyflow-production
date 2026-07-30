# ReplyFlow Internal Admin Tools

**Master Execution Plan 3.3.** Operations Blueprint §11: *"No admin tooling exists anywhere — no way for the team to see across businesses, inspect a specific conversation's reasoning trace, or check an account's status without querying the database directly."* Directly names what this closes: §5 (Customer Support Workflow, 1.5) and §10 (Incident Response, 1.3) actually executable well rather than guesswork.

---

## The real design problem this task started from

No admin/staff/role concept exists anywhere in this codebase — confirmed before writing any code. Every table's RLS is scoped purely to `owner_id = auth.uid()`; there is no `is_admin` column, no role enum, not even an unused stub. This mattered because Security Baseline §5 (Task 1.4) already wrote the binding rule this task exists to satisfy:

> Any future internal tool that's reachable over HTTP by a human... must authenticate its own operator and authorize against a real, scoped check — never simply hold or proxy the service-role key to whoever can reach its URL.

## Access control

`ADMIN_EMAILS` — a comma-separated allowlist of real email addresses, checked in `app/admin/layout.tsx` via `lib/admin.ts`'s `isAdminEmail()` (pure, unit tested) against the **real, already-authenticated Supabase session's own email** — never the allowlist alone; a genuine session is the first, non-negotiable half of the check. `middleware.ts` now also treats `/admin` as a protected path, so an unauthenticated visitor is redirected to `/login` at the edge, before the request even reaches the layout. A real, authenticated business owner whose email isn't on the allowlist is redirected straight to their own `/dashboard` — never shown an error page that would confirm `/admin` exists at all.

**Verified directly against production, not assumed:** with `ADMIN_EMAILS` still unset, a real authenticated business owner's session (the founder's own SHABZ account) was redirected away from `/admin` to `/dashboard` — confirming the default is genuinely deny, not open. Unauthenticated requests to `/admin` and `/admin/businesses/[id]` both correctly 307 to `/login`.

## What was built

Three pages, deliberately the smallest set that satisfies "a support request can be investigated without a raw database query":

- **`/admin`** — search across every business (a plain client-side filter over the full list, the exact pattern `components/dashboard/customers/customer-list.tsx` already established for the same shape of problem — correct at the current pre-launch scale, not a premature server-search build). Each row's connection and subscription status is computed with the **same pure functions the owner's own dashboard already uses** (`describeConnectionHealth`, `describeSubscriptionGate`) — no new status logic invented, no risk of the admin view and the owner's own view ever disagreeing about what a status means.
- **`/admin/businesses/[id]`** — one business's conversations, recent `error_events`, and recent `product_events` (this phase's own 3.2 work, now put to its first real use) in one place.
- **`/admin/conversations/[id]`** — read-only message history, each AI-drafted reply's reasoning trace shown alongside it (facts used, confidence, category, escalation reason) — reusing `factSourceSummary`, the exact function that already powers "Based on…" on the owner's own Conversations page.

**Deliberately read-only.** The existing `ConversationStory` component (the owner's own interactive conversation view) was investigated for reuse and found unsuitable as-is: every action it offers (approve, edit, reject, send, mark complete) writes through the *current session's own* RLS-checked ownership. Reusing it for a different business's conversation under an admin session would either silently fail every action (RLS rejects an owner-mismatched write) or require weakening tenant isolation to let it through — the wrong side of that trade-off. Support and incident investigation only ever needs to read here; approving or sending a reply stays the owner's own action, on their own dashboard, exactly where the Constitution's "never guess, never decide alone on the owner's behalf" boundary already sits.

**A small, real refactor this required:** `factSourceSummary` previously only existed inside `conversation-story.tsx`, a `"use client"` component — importing a function from a client-boundary module into a Server Component is fragile (it pulls the whole client module, including `framer-motion` and browser-only imports, into the server bundling graph for no reason). Extracted into `lib/fact-source-summary.ts`, a plain pure-function file matching every other `lib/*.ts` convention already established; `conversation-story.tsx` now imports and re-exports it, so its two other existing consumers (`receptionist-playground.tsx`, `test-conversation.tsx`) needed no changes at all.

**Also corrected in passing:** `lib/supabase/service.ts`'s "only import this from" comment listed exactly 2 files — already stale before this task started (17 real files use it today). Rewritten to state the actual rule (Security Baseline §5) rather than an exhaustive, easily-drifting file list.

## What's still manual, honestly

- No audit log of which admin viewed which business — not asked for by this task, and adding one wasn't warranted by the objective as stated; a real, separate addition if ever needed.
- Search is a client-side substring filter, correct at today's scale (a handful of businesses); revisit if the business count grows enough to make loading the full list into the browser genuinely wasteful — the plan's own risk note already flags ~100 customers as the point this becomes a real bottleneck, matching that same threshold.
