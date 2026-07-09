-- ReplyFlow — 0004: AI Receptionist configuration + notification preferences
--
-- Unlike whatsapp_connections, this table holds no secrets — it's pure
-- owner-editable settings — so it gets normal owner RLS (select/insert/
-- update), written directly from the client via upsert, same pattern
-- as `businesses`. Kept as its own table rather than more columns on
-- `businesses` because it's a distinct, independently-growing concern
-- (FAQs in particular will likely grow past a handful of rows) and
-- because AI config and business profile are edited on separate pages
-- for separate reasons — one table per page keeps each query minimal.

create table if not exists public.ai_configurations (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,

  tone               text not null default 'friendly'
                      check (tone in ('professional', 'friendly', 'concise')),
  system_prompt      text not null default '',
  business_rules     text not null default '',
  escalation_rules   text not null default '',
  faqs               jsonb not null default '[]'::jsonb, -- [{ question: string, answer: string }]

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint ai_configurations_business_id_key unique (business_id)
);

create index if not exists ai_configurations_business_id_idx on public.ai_configurations (business_id);

drop trigger if exists set_ai_configurations_updated_at on public.ai_configurations;
create trigger set_ai_configurations_updated_at
  before update on public.ai_configurations
  for each row execute procedure public.set_updated_at();

alter table public.ai_configurations enable row level security;

drop policy if exists "Owners can view their own AI configuration" on public.ai_configurations;
create policy "Owners can view their own AI configuration"
  on public.ai_configurations for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists "Owners can insert their own AI configuration" on public.ai_configurations;
create policy "Owners can insert their own AI configuration"
  on public.ai_configurations for insert
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists "Owners can update their own AI configuration" on public.ai_configurations;
create policy "Owners can update their own AI configuration"
  on public.ai_configurations for update
  using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

grant select, insert, update on public.ai_configurations to authenticated;

-- Settings page notification toggles need somewhere real to persist.
alter table public.businesses
  add column if not exists notify_new_enquiry boolean not null default true,
  add column if not exists notify_daily_summary boolean not null default true;

notify pgrst, 'reload schema';
