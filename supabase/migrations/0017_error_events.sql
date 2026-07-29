-- ReplyFlow — 0017: Error events (Master Execution Plan 1.1)
--
-- "ReplyFlow will never leave a business owner wondering whether their
-- business is being looked after" (00-Founder-Constitution.md, Product
-- Promise) requires ReplyFlow to know first when something breaks —
-- today a caught exception is a line in Vercel's ephemeral function
-- logs and nothing else. This is the durable, queryable sink for it.
--
-- One row per caught failure at a real reply-engine/webhook chokepoint
-- (lib/error-events.ts is the only writer). business_id is nullable —
-- some failures (a webhook signature mismatch, a malformed payload)
-- happen before any business can be resolved at all.
--
-- Deliberately does NOT store customer message content, drafted reply
-- text, or any other free text a customer or owner authored — only
-- opaque IDs, error type/message strings, and route/call-site names.
-- Same non-negotiable data boundary this project already applies to
-- everything else (07-Engineering-Principles.md §7).
--
-- Write access is service-role only (mirrors ai_usage_events, 0016) —
-- every writer is deep pipeline code with no user session to write as.

create table if not exists public.error_events (
  id            uuid primary key default gen_random_uuid(),
  severity      text not null check (severity in ('warning', 'error', 'critical')),
  source        text not null,
  business_id   uuid references public.businesses(id) on delete cascade,

  message       text not null,
  error_name    text,
  context       jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now()
);

create index if not exists error_events_created_at_idx on public.error_events (created_at desc);
create index if not exists error_events_business_id_idx on public.error_events (business_id, created_at desc);
create index if not exists error_events_severity_idx on public.error_events (severity, created_at desc);

alter table public.error_events enable row level security;

drop policy if exists "Owners can view their own error events" on public.error_events;
create policy "Owners can view their own error events"
  on public.error_events for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

grant select on public.error_events to authenticated;

notify pgrst, 'reload schema';
