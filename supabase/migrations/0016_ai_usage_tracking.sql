-- ReplyFlow — 0016: AI token/cost usage tracking (Master Execution Plan,
-- Phase 0.1)
--
-- Every OpenAI call already returns token usage in its response — until
-- now that data was read once and discarded, everywhere it happens. No
-- pricing, reliability, or billing decision downstream can be made on
-- evidence rather than a guess without this. Constitution: "Build for
-- reliability before intelligence" (00-Founder-Constitution.md,
-- Engineering Principles).
--
-- One row per real completion call (`lib/reply-engine/llm/client.ts`,
-- the single provider-agnostic chokepoint every LLM call already passes
-- through). call_site distinguishes the Understanding Engine's
-- classification call from the Reply Engine's generation call — the
-- only two call sites that exist today (see usage-tracking.ts).
--
-- Write access is service-role only (the pipeline has no user session
-- to write as, same precedent as reply_drafts) and best-effort — a
-- failed insert here must never block a reply being drafted, so this
-- table can be safely missing or briefly unreachable without breaking
-- anything else.

create table if not exists public.ai_usage_events (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses(id) on delete cascade,

  call_site             text not null,
  model                 text not null,
  tier                  text not null check (tier in ('small', 'large')),

  input_tokens          integer not null check (input_tokens >= 0),
  output_tokens         integer not null check (output_tokens >= 0),
  estimated_cost_usd     numeric(10, 6),

  created_at            timestamptz not null default now()
);

create index if not exists ai_usage_events_business_id_idx on public.ai_usage_events (business_id, created_at desc);
create index if not exists ai_usage_events_created_at_idx on public.ai_usage_events (created_at desc);

alter table public.ai_usage_events enable row level security;

drop policy if exists "Owners can view their own AI usage" on public.ai_usage_events;
create policy "Owners can view their own AI usage"
  on public.ai_usage_events for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

grant select on public.ai_usage_events to authenticated;

notify pgrst, 'reload schema';
