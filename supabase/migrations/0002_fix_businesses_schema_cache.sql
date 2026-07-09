-- ReplyFlow — 0002: guarantee `businesses` exists and is visible to PostgREST
--
-- Root cause of "Could not find the table 'public.businesses' in the
-- schema cache": this is a PostgREST error, not a Postgres error. It
-- fires when either (a) the table genuinely doesn't exist yet — most
-- likely, 0001_init.sql was written into the repo but never actually
-- run against the live Supabase project — or (b) it exists but
-- PostgREST's cached schema is stale. This migration is written to be
-- safe to re-run in either case: every statement is idempotent
-- (create-if-not-exists / drop-then-create), and it ends by forcing
-- PostgREST to reload its schema cache so the fix takes effect
-- immediately, without waiting on Supabase's automatic reload.

create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id                        uuid primary key default gen_random_uuid(),
  owner_id                  uuid not null references auth.users(id) on delete cascade,

  business_name             text not null,
  phone                     text not null,

  whatsapp_connected        boolean not null default false,

  trade                     text not null default 'plumbing',
  opening_time              text not null default '08:00',
  closing_time              text not null default '17:30',
  offers_emergency_callouts boolean not null default true,
  service_areas             text[] not null default '{}',
  logo_url                  text,
  greeting_style            text not null default 'friendly'
                             check (greeting_style in ('professional', 'friendly', 'concise')),

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

-- RLS policies control *which rows* are visible, but the `authenticated`
-- role also needs baseline table-level privileges to attempt the query
-- at all under Supabase's default grants. This is easy to miss because
-- it fails with the same schema-cache-style error as a missing table.
grant select, insert, update on public.businesses to authenticated;

-- Force PostgREST to pick up the new/changed schema immediately rather
-- than waiting for its next automatic reload. This is the direct fix
-- for the exact error message reported.
notify pgrst, 'reload schema';
