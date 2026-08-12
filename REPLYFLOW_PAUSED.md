# ReplyFlow — PAUSED

**Status as of 2026-08-12: ReplyFlow is paused indefinitely.**

This file exists to preserve the exact state of the project at the moment
of pausing, so it can be picked back up later without losing context. It
is intentionally a snapshot, not a plan — see "How to Resume ReplyFlow"
below before writing any new code.

---

## 1. What ReplyFlow was intended to do

ReplyFlow is an AI-powered WhatsApp "receptionist" for UK tradespeople
(starting with plumbers, with electricians as a planned expansion). A
customer messages the tradesperson's WhatsApp number; ReplyFlow reads the
message (and any photos), understands what the customer needs, drafts a
reply grounded in the business's own rules and availability, and — once
the owner trusts it enough — can send some replies automatically. The
underlying goal was never "a chatbot"; it was to behave like a competent
employee who reads messages, understands the job, drafts sensible
replies, escalates what it shouldn't handle alone, and gets better at
representing the business over time.

## 2. Current product direction

- **Audience**: UK plumbers (electricians planned as the next trade).
- **Positioning**: an operating layer around the work that arrives
  through WhatsApp — not a general messaging app, not a CRM bolt-on.
- **Core loop**: **Conversation → Job → Photos → Report.** A customer's
  WhatsApp conversation becomes a Job (a "Work Card"), photos attached to
  that conversation become part of the job's evidence/diagnosis, and the
  job resolves into a report of what happened.

## 3. Current production architecture (high level)

- **Frontend/backend**: Next.js 14 (App Router), deployed on Vercel.
- **Database/auth/storage**: Supabase (Postgres, Auth, Storage, RLS).
- **AI**: OpenAI (gpt-4o-mini class models) for message understanding,
  reply generation, and photo analysis ("Photo Intelligence").
- **Channel**: Meta WhatsApp Cloud API (Graph API), via a webhook that
  ingests inbound messages and a send path for outbound replies.
- **Core pipeline** (`lib/reply-engine/generate-reply.ts`): the single
  orchestrator wiring together episode resolution → Understanding
  (classification) → Context Assembly → Prompt/Generation → Safety Layer
  → Draft. Runs via `waitUntil` off the webhook so it never blocks Meta's
  fast ACK.
- **Conversation Episode Architecture**: a `conversation_episodes` table
  sits between the permanent `conversations` row (one per customer phone
  number, forever) and per-job data (`messages`, `conversation_photos`,
  `reply_drafts`, `work_cards`), each scoped by `episode_id`. This exists
  because a customer's `conversations` row never resets — without episode
  scoping, every job a customer ever had would blur into one
  undifferentiated AI context.
- **Work Cards**: the source-of-truth job record surfaced to the owner
  (status, scheduling, notes), linked 1:1 conceptually to an episode.

## 4. Current Git commit

```
bd7b8d0 — Fix booked-episode continuity so follow-ups on a confirmed job stay attached
```

This is the last commit made before pausing. It is on `main` and pushed
to `origin/main` (GitHub: `rumen32215/replyflow-production`).

## 5. Current production deployment status

At time of pausing, the Vercel project **`replyflow-production`** (live
domain `www.replyflow.co.uk`) had successfully deployed commit `bd7b8d0`
to Production — deployment `readyState: READY`, target `production`,
verified live (`HTTP 200`) and verified via the `-git-main-` branch alias
that it was genuinely built from `main`'s current HEAD.

Note: this repo's local `.vercel/project.json` links to a **different,
stale legacy Vercel project** (simply named `replyflow`, last deployed
several days prior). That link is orphaned — the real production project
is `replyflow-production`. Anyone resuming should re-link (`vercel link`)
before relying on local CLI project context.

## 6. Current Supabase/Meta/WhatsApp setup (high level — no secrets)

- **Supabase project**: one production project, storing all app data
  (businesses, conversations, conversation_episodes, messages,
  conversation_photos, work_cards, reply_drafts, ai_configurations,
  whatsapp_connections, etc.). Service-role access is used server-side
  only; RLS governs client access.
- **WhatsApp connection**: a single `whatsapp_connections` row for the
  one test business ("Rumen Plumber"), linked to one WABA and one test
  phone number. **At the moment of pausing, the WhatsApp access token had
  expired and the row was marked `revoked_at` (non-null) — the connection
  was mid-refresh** (a new-token SQL statement had been prepared for the
  owner to run manually in the Supabase SQL Editor, but had not yet been
  confirmed as applied) when the pause instruction arrived. **The
  WhatsApp connection should be assumed non-functional until this is
  redone.**
- **Meta Business Verification**: per earlier session notes, Meta
  Business Verification (not code) was the known blocker to moving beyond
  the single test WhatsApp number toward real customer numbers.
- No tokens, keys, or credentials are recorded in this file or anywhere
  else as part of this pause.

## 7. Major things that currently work

- Full inbound WhatsApp message pipeline: webhook → conversation/episode
  resolution → Understanding (intent/entity/state classification) →
  Context Assembly → reply generation → Safety Layer → `reply_drafts` row
  (pending / auto-sent / escalated / silence, depending on category).
- Photo intake and Photo Intelligence: incoming images are downloaded,
  stored, and analysed (visible/possible/unknown), and that analysis
  feeds both classification and generation.
- Conversation Episode Architecture: episodes correctly scope AI state
  per job rather than per customer, with a deterministic (non-LLM)
  in-progress vs. booked vs. new-episode resolution.
- **Booked-episode continuity** (the last major fix — see §9): a
  recently-booked job can still receive same-job follow-up text/photos
  without losing its booking or being misclassified as a new emergency.
- Work Cards as the owner-facing job record, with booking/scheduling.
- Deterministic safety backstops: EMERGENCY/COMPLAINT always escalate
  regardless of a conflicting safety tag; forced silence only for
  exact-match acknowledgements with nothing outstanding; auto-send scoped
  to a narrow, opt-in, lowest-risk category.
- Full automated test suite (394+ tests as of the last fix) covering
  datetime/timezone handling, episode resolution, the reply-engine
  orchestrator, safety, billing, availability, and more.
- Full onboarding flow, receptionist configuration, and dashboard
  (Front Desk / Conversations / Work Cards) — built and previously
  verified in earlier live testing.

## 8. Major known issues at the time of pausing

- **See §10 below — a specific, reproduced, NOT-yet-investigated bug**
  found in the final live test session before pausing.
- WhatsApp access token had expired and was mid-refresh (§6) — the
  connection's actual live health was never re-confirmed before pausing.
- Two unreconciled Job Record creation paths were flagged in an earlier
  architecture audit (V4 verification findings) — not resolved as of
  pausing.
- A broader Product Reset Blueprint (from a full product/architecture
  audit) identified further KEEP/FIX/CLEAN UP/RENEW/REMOVE/BUILD-NEXT
  items beyond the one continuity fix that was actually implemented
  (§9) — the rest of that blueprint was never executed.
- Migration 0030 was noted as not yet applied as of the last architecture
  verification pass (V4 verification findings) — status at time of
  pausing was not re-checked.

## 9. The exact last major engineering fix: booked-episode continuity

**Problem**: a `conversation_episodes` row transitions to status
`"booked"` once a job is scheduled, and `booked` was deliberately excluded
from the "in progress" set (so a confirmed future appointment wouldn't
block a genuinely new, unrelated job from opening its own episode).
However, that same exclusion meant **any** message arriving after a
booking — including more photos of the exact same job — was routed into a
brand-new, context-free episode, with the Understanding classifier never
even consulted. Live testing traced this directly: a booked kitchen-sink
leak, followed minutes later by photos of that same leak, opened a fresh
episode and misclassified the photos as a new EMERGENCY.

**Fix** (`lib/reply-engine/episode.ts`, `lib/reply-engine/generate-reply.ts`):
`resolveEpisodeForMessage` now has three branches — an in-progress episode
(unchanged priority), else a still-"live" recently-booked episode (new:
`findRecentlyBookedEpisode`, offered as a continuity candidate whenever
its linked Work Card's appointment is still upcoming, or within a
deterministic 48-hour grace window after the appointment time — never an
LLM judgment), else create a new episode. A new `wasBookedCandidate` flag
ensures that if the classifier later returns `episode_continuity: "new_job"`
against a booked candidate, the orchestrator does **not** call
`closeEpisode(..., "abandoned")` on it — a booked job superseded by an
unrelated new request is still a real, valid future appointment and is
left exactly as `"booked"`. Only a genuinely in-progress (never-booked)
episode is marked abandoned when superseded, exactly as before.

Covered by 22 new/modified tests across `episode.test.ts` (new) and
`generate-reply.test.ts`, verified effective via a revert-and-rerun check
against the pre-fix source. This is commit `bd7b8d0` (§4), reviewed and
approved before merge, deployed to production, and confirmed live (§5).

## 10. Unresolved bug found in the final live test

During the live WhatsApp test session immediately before pausing, a
conversation containing **6 photos** produced a suggested reply that
**incorrectly stated it could not view attachments** — i.e. the reply
claimed no ability to see the photos despite Photo Intelligence
infrastructure existing and (per §7) generally working in isolated
testing.

## 11. This issue was NOT investigated

**The bug in §10 was observed and recorded, but was not diagnosed, not
root-caused, and not fixed.** The project was paused before any
investigation began. Do not assume a cause — none was determined.
Plausible surface-level hypotheses (e.g. an attachment-acknowledgment
fallback branch firing instead of the photo-analysis path, a burst of 6
photos hitting a per-message or episode-resolution edge case, a stale
`reply_drafts` row being surfaced instead of the real one) are just that —
hypotheses, not findings. Reinvestigate from scratch.

## 12. Important directories/files if ReplyFlow is ever resumed

- `lib/reply-engine/` — the core pipeline: `generate-reply.ts`
  (orchestrator), `episode.ts` (Conversation Episode resolution — see §9),
  `understanding/` (classification/state), `context/` (context assembly),
  `prompt/` (generation), `safety/` (safety evaluation), `send.ts`,
  `media-intake.ts` / `media-storage.ts` / `vision/` (Photo Intelligence),
  `attachment-acknowledgment.ts` (the fallback path relevant to §10).
- `lib/work-card.ts`, `lib/work-card-state.ts`, `lib/work-card-format.ts`
  — Work Card (job record) logic.
- `lib/whatsapp/` — WhatsApp Cloud API integration.
- `lib/brain/` — the "Shared Brain" readiness/context signal used to gate
  AI auto-drafting.
- `lib/datetime.ts` — London-timezone-aware date handling (has its own
  regression history — see `lib/datetime.test.ts`).
- `app/api/` — webhook and other API routes.
- `app/(dashboard)/` — the owner-facing app (Conversations, Work Cards,
  Front Desk, etc.).
- `app/(onboarding)/` — onboarding flow.
- `supabase/migrations/` — all schema history, including the Conversation
  Episode Architecture migrations and the 0030/0031 migrations referenced
  in §8/§9.
- `DOCS/CONSTITUTION/` — the philosophy/architecture documents governing
  product decisions (numbered 00–16), including the Trust Architecture,
  Learning Memory Architecture, and Adaptation Architecture specs.
- `DOCS/SPECS/ReplyFlow-Master-Execution-Plan.md` — the canonical
  Phase 0–5 roadmap as of the last update.
- `.vercel/project.json` — **currently points at a stale/wrong project;
  see §5.**
- `.env.local` / `.env.example` — environment variable shape (never
  commit real secrets here).

## 13. How to Resume ReplyFlow

Do not resume by picking up a task list or continuing mid-stream. First:

1. **Audit the project fresh** — codebase, database state, production
   deployment, and the live WhatsApp connection — before writing any
   code. Treat this document as a starting map, not current ground
   truth; verify everything in it.
2. Re-investigate §10 (the unresolved attachment-visibility bug) as a
   first-class item — it was live and unresolved at pause time.
3. Re-establish the WhatsApp connection (§6) and confirm it's genuinely
   healthy (not just that a token was pasted in) before any further live
   testing.
4. Only after a fresh audit and a re-confirmed baseline should new
   feature or fix work begin.

## 14. Before resuming development

**Do not assume the old product architecture is still the correct
architecture. Reassess the product before resuming development.**
