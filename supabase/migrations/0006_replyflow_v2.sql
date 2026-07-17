-- ReplyFlow — 0006: V2 product experiences
--
-- Three additive, idempotent changes — no tables dropped, no data
-- rewritten, existing rows all stay valid (Implementation Pack:
-- "avoid unnecessary schema changes").
--
-- 1. Conversation lifecycle. Conversations V1 defines the real
--    statuses a receptionist works with (New -> Gathering ->
--    Waiting for Owner -> Booked -> Completed -> Closed). The old
--    binary open/closed stays legal so nothing existing breaks;
--    'open' simply reads as "active" in the UI.
alter table public.conversations
  drop constraint if exists conversations_status_check;
alter table public.conversations
  add constraint conversations_status_check
  check (status in ('open', 'closed', 'new', 'gathering', 'waiting_owner', 'booked', 'completed'));

-- 2. Availability — the receptionist's diary (Availability V1).
--    One jsonb document per business: weekly hours, days off, fully
--    booked days, booking rules. Same "arrays are enough for v1"
--    reasoning as the original businesses table — normalize only when
--    a real feature demands it.
alter table public.businesses
  add column if not exists availability jsonb not null default '{}'::jsonb;

-- 3. Business memory (Business Experience V2). The living profile's
--    growing knowledge sections (jobs declined, guarantees, payment
--    methods, certifications, parking, personality...) in one
--    owner-editable document. Structured columns that already exist
--    (services, service_areas, description...) remain the source of
--    truth for what they cover — this holds only the new sections.
alter table public.businesses
  add column if not exists business_knowledge jsonb not null default '{}'::jsonb;

-- Owners already have select/insert/update on businesses via 0001's
-- RLS policies; jsonb columns inherit that. Conversations remain
-- read-only for owners (writes are service-role only) — except status,
-- which the owner legitimately changes from the app (approve, complete,
-- close). Grant a narrow update path with RLS still enforcing ownership.
drop policy if exists "Owners can update their own conversations" on public.conversations;
create policy "Owners can update their own conversations"
  on public.conversations for update
  using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

grant update (status) on public.conversations to authenticated;

notify pgrst, 'reload schema';
