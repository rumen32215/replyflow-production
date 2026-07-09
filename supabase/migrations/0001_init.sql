-- ReplyFlow — initial schema (Phase 2/4: Auth + Onboarding)
--
-- Deliberately one table for the business profile rather than five
-- normalized ones (separate services / service_areas / hours tables).
-- Per the Founder Handbook's "simplicity over complexity" principle:
-- a plumber has one profile, arrays are enough for v1, and normalizing
-- prematurely just adds joins we don't need yet. Split this out later
-- if a real requirement (e.g. per-area pricing) demands it.

create table if not exists public.businesses (
  id                        uuid primary key default gen_random_uuid(),
  owner_id                  uuid not null references auth.users(id) on delete cascade,

  -- Step 1: Business Information
  business_name             text not null,
  phone                     text not null,

  -- Step 2: Connect WhatsApp (placeholder until Phase 3)
  whatsapp_connected        boolean not null default false,

  -- Step 3: Business Details
  trade                     text not null default 'plumbing',
  opening_time              text not null default '08:00',
  closing_time              text not null default '17:30',
  offers_emergency_callouts boolean not null default true,
  service_areas             text[] not null default '{}',
  logo_url                  text,
  greeting_style            text not null default 'friendly'
                             check (greeting_style in ('professional', 'friendly', 'concise')),

  -- Step 4: AI Configuration
  business_description      text,
  services                  text[] not null default '{}',
  charges_callout_fee       boolean not null default false,
  callout_fee_amount        text,

  onboarding_completed      boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint businesses_owner_id_key unique (owner_id)
);

create index if not exists businesses_owner_id_idx on public.businesses (owner_id);

-- Keep updated_at honest on every write.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_businesses_updated_at on public.businesses;
create trigger set_businesses_updated_at
  before update on public.businesses
  for each row execute procedure public.set_updated_at();

-- Row Level Security: an owner can only ever see/edit their own business.
alter table public.businesses enable row level security;

drop policy if exists "Owners can view their own business" on public.businesses;
create policy "Owners can view their own business"
  on public.businesses for select
  using (auth.uid() = owner_id);

drop policy if exists "Owners can insert their own business" on public.businesses;
create policy "Owners can insert their own business"
  on public.businesses for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Owners can update their own business" on public.businesses;
create policy "Owners can update their own business"
  on public.businesses for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
