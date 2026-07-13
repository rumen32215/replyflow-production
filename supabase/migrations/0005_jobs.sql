-- ReplyFlow — 0005: Jobs foundation
--
-- The missing link between "a customer messaged us" (conversations)
-- and "we did business" (revenue, bookings, completed work). Deliberately
-- one flat table, not normalized further — a status enum plus a handful
-- of optional fields covers everything Dashboard V2, Customers, and
-- Insights need, without inventing a job-history/audit table nobody
-- has asked for yet. Same reasoning as businesses/ai_configurations:
-- add real structure when a real feature needs it, not before.
--
-- customer_name is intentionally denormalized from conversations
-- (rather than always joining) so a job record stays meaningful and
-- queryable even if its source conversation is later deleted.

create table if not exists public.jobs (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  conversation_id  uuid references public.conversations(id) on delete set null,

  customer_name    text not null,
  job_title        text not null,
  status           text not null default 'new_enquiry'
                    check (status in (
                      'new_enquiry',
                      'quote_requested',
                      'quote_sent',
                      'quote_accepted',
                      'booked',
                      'in_progress',
                      'completed',
                      'cancelled'
                    )),

  estimated_value  numeric(10, 2),
  scheduled_for    timestamptz,
  completed_at     timestamptz,
  notes            text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists jobs_business_id_idx on public.jobs (business_id);
create index if not exists jobs_status_idx on public.jobs (business_id, status);
create index if not exists jobs_conversation_id_idx on public.jobs (conversation_id);

drop trigger if exists set_jobs_updated_at on public.jobs;
create trigger set_jobs_updated_at
  before update on public.jobs
  for each row execute procedure public.set_updated_at();

-- Normal owner RLS (select/insert/update) — jobs hold no secrets,
-- unlike whatsapp_connections, so this follows the businesses /
-- ai_configurations pattern rather than the service-role-only one.
alter table public.jobs enable row level security;

drop policy if exists "Owners can view their own jobs" on public.jobs;
create policy "Owners can view their own jobs"
  on public.jobs for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists "Owners can insert their own jobs" on public.jobs;
create policy "Owners can insert their own jobs"
  on public.jobs for insert
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists "Owners can update their own jobs" on public.jobs;
create policy "Owners can update their own jobs"
  on public.jobs for update
  using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

grant select, insert, update on public.jobs to authenticated;

notify pgrst, 'reload schema';
