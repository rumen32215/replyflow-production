-- ReplyFlow — 0021: Product events (Master Execution Plan 3.2)
--
-- "It earns responsibility over time" (00-Founder-Constitution.md)
-- needs to be measurable, not assumed. Investigation before writing
-- this migration found several existing tables (reply_drafts,
-- work_cards, businesses) already carry real, queryable timestamps for
-- most of what Operations Blueprint §3 asks for — this table exists
-- only for the facts genuinely not captured anywhere yet, not as a
-- duplicate log of data that's already there. See
-- DOCS/SPECS/ReplyFlow-Usage-Analytics.md for exactly which events
-- are new captures versus already-derivable from existing columns.
--
-- One row per real product event (lib/product-events.ts is the only
-- writer). business_id is not null — unlike error_events, every event
-- this table records happens for a business that's already resolved.
-- Same shape and conventions as error_events (0017) and ai_usage_events
-- (0016): service-role write, owner-scoped read, a short dotted-
-- identifier categorical column, a jsonb context for event-specific
-- detail. Same non-negotiable data boundary as every other table here:
-- context never holds customer message content or drafted reply text.

create table if not exists public.product_events (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  event_type    text not null,
  context       jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now()
);

create index if not exists product_events_created_at_idx on public.product_events (created_at desc);
create index if not exists product_events_business_id_idx on public.product_events (business_id, created_at desc);
create index if not exists product_events_event_type_idx on public.product_events (event_type, created_at desc);

alter table public.product_events enable row level security;

drop policy if exists "Owners can view their own product events" on public.product_events;
create policy "Owners can view their own product events"
  on public.product_events for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

grant select on public.product_events to authenticated;

notify pgrst, 'reload schema';
