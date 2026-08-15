-- ReplyFlow — 0035: Bookings (Plumber Reset, Phase 3 step 3 — schema)
--
-- Per DOCS/SPECS/ReplyFlow-Plumber-Reset-Phase2-Architecture.md §9,
-- approved with constraints in the Phase 3 sign-off: a real, minimal
-- booking model — not a calendar product. No multi-technician
-- scheduling, no travel-time optimisation, no external calendar sync.
--
-- One row per appointment, tied to a Job (work_cards) and a Customer.
-- reschedule_of_id keeps a reschedule chain visible instead of
-- silently overwriting a previous booking's row — cancelling/moving a
-- plumber's day is a real business event worth keeping a trail of.
-- timezone is stored explicitly (Europe/London default — this is a
-- UK-only product) alongside timestamptz start/end, so wall-clock
-- display is never guessed from server time.
--
-- RLS/grants follow the reply_drafts / conversation_episodes pattern,
-- not the work_cards one: a booking's correctness depends on the
-- deterministic conflict check in the booking engine (Phase 3 step 5)
-- always running, so every write — including an owner manually booking
-- a job from the UI — goes through a server-side route using the
-- service role, never a raw client insert. Owners get SELECT only.
--
-- work_cards gains next_booking_id (nullable FK, not a duplicated
-- timestamp) — this is the deliberate fix for the exact data-drift bug
-- Phase 1 found in job_docs.job_date going stale against the Work
-- Card: there is no second "when" value that can ever fall out of
-- sync, because there isn't a second value at all. Anything that needs
-- "when" joins through this FK.
--
-- work_cards also gains its report state columns here (customer_id was
-- already added by 0033): report_status/report_approved_by/
-- report_approved_at/report_snapshot. Per the Phase 3 sign-off on
-- REPORT: Job stays the source of truth (live columns + job_doc_fields
-- + job_doc_photos, both untouched by this migration), a draft report
-- is always computed live from that current state, and report_snapshot
-- is the frozen jsonb copy written once, at approval time, so an
-- approved report can never silently change if the Job is edited
-- afterward. This deliberately does not touch job_docs at all — no
-- new duplicated architecture, and job_docs stays exactly as it is,
-- per the explicit instruction not to drop or alter legacy structures
-- in this phase.

create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  job_id            uuid not null references public.work_cards(id) on delete cascade,
  customer_id       uuid references public.customers(id) on delete set null,

  scheduled_start   timestamptz not null,
  scheduled_end     timestamptz not null,
  timezone          text not null default 'Europe/London',

  status            text not null default 'proposed'
                     check (status in ('proposed', 'confirmed', 'completed', 'cancelled')),
  source            text not null default 'ai' check (source in ('ai', 'owner')),
  reschedule_of_id  uuid references public.bookings(id) on delete set null,

  confirmed_at      timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint bookings_scheduled_window_check check (scheduled_end > scheduled_start)
);

create index if not exists bookings_business_id_idx on public.bookings (business_id);
create index if not exists bookings_job_id_idx on public.bookings (job_id);
create index if not exists bookings_customer_id_idx on public.bookings (customer_id);
-- The conflict-check's hot path: "what's already booked for this business in this window."
create index if not exists bookings_business_window_idx
  on public.bookings (business_id, scheduled_start, scheduled_end)
  where status in ('proposed', 'confirmed');

drop trigger if exists set_bookings_updated_at on public.bookings;
create trigger set_bookings_updated_at
  before update on public.bookings
  for each row execute procedure public.set_updated_at();

alter table public.bookings enable row level security;

drop policy if exists "Owners can view their own bookings" on public.bookings;
create policy "Owners can view their own bookings"
  on public.bookings for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

grant select on public.bookings to authenticated;

-- ---------------------------------------------------------------------

alter table public.work_cards
  add column if not exists next_booking_id uuid references public.bookings(id) on delete set null;
create index if not exists work_cards_next_booking_id_idx on public.work_cards (next_booking_id);

alter table public.work_cards
  add column if not exists report_status text not null default 'draft'
    check (report_status in ('draft', 'approved'));
alter table public.work_cards
  add column if not exists report_approved_by uuid references auth.users(id) on delete set null;
alter table public.work_cards
  add column if not exists report_approved_at timestamptz;
alter table public.work_cards
  add column if not exists report_snapshot jsonb;

comment on column public.work_cards.report_snapshot is
  'Frozen copy of the rendered report content, written once at approval time. Null until first approval. The Job''s own live fields/photos remain the source of truth for the draft view; this column exists only so an approved report can never silently change if the Job is edited afterward.';

grant select, insert, update on public.work_cards to authenticated;

notify pgrst, 'reload schema';
