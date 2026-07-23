-- ReplyFlow — 0013: Work Cards (Track B, formally adopted two-track
-- roadmap — DOCS/CONSTITUTION/07)
--
-- "Job" is retired as a concept, replaced by "Work Card"
-- (DOCS/SPECS/Work-Card-Object.md §0). The rename reaches the schema,
-- not just UI labels — cheaper now than after Front Desk, Diary, and
-- Customers all depend on the old name. Nothing about the booking/
-- approval workflow changes; only the name and shape of the object.
--
-- New columns are the object's automatic fields (§2 of the spec):
-- address (receptionist-proposed, never trusted un-confirmed —
-- address_confirmed is a soft warning per the owner's explicit
-- decision, never a hard blocker on booking), collected_details (the
-- Commitments ledger's resolved customer_fact entries, one field —
-- not split into parking/access, since classifying free text into
-- those buckets automatically would be exactly the kind of guessing
-- this product's fact-grounding discipline exists to avoid),
-- conversation_summary (receptionist-drafted, never invented),
-- approved_by/approved_at (audit trail — set by the existing approve
-- route in the same write that flips status to booked).
--
-- The status enum is deliberately left unchanged. The owner's own
-- call: "I would not collapse them yet... Changing status values
-- ripples through a lot of code... Only simplify if implementation
-- proves it's genuinely improving the product."

alter table public.jobs rename to work_cards;
alter table public.work_cards rename column job_title to issue;

alter index if exists jobs_pkey rename to work_cards_pkey;
alter index if exists jobs_business_id_idx rename to work_cards_business_id_idx;
alter index if exists jobs_status_idx rename to work_cards_status_idx;
alter index if exists jobs_conversation_id_idx rename to work_cards_conversation_id_idx;

alter table public.work_cards rename constraint jobs_business_id_fkey to work_cards_business_id_fkey;
alter table public.work_cards rename constraint jobs_conversation_id_fkey to work_cards_conversation_id_fkey;
alter table public.work_cards rename constraint jobs_status_check to work_cards_status_check;

drop trigger if exists set_jobs_updated_at on public.work_cards;
create trigger set_work_cards_updated_at
  before update on public.work_cards
  for each row execute procedure public.set_updated_at();

drop policy if exists "Owners can view their own jobs" on public.work_cards;
create policy "Owners can view their own work cards"
  on public.work_cards for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists "Owners can insert their own jobs" on public.work_cards;
create policy "Owners can insert their own work cards"
  on public.work_cards for insert
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists "Owners can update their own jobs" on public.work_cards;
create policy "Owners can update their own work cards"
  on public.work_cards for update
  using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

alter table public.work_cards
  add column if not exists address text,
  add column if not exists address_confirmed boolean not null default false,
  add column if not exists collected_details text,
  add column if not exists conversation_summary text,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz;

comment on column public.work_cards.address_confirmed is
  'Soft warning, never a hard blocker — a Work Card can be booked with an unconfirmed address. Owner decision, DOCS/SPECS/Work-Card-Object.md §5.';
comment on column public.work_cards.collected_details is
  'Automatic — assembled from the Commitments ledger''s resolved customer_fact entries (lib/work-card.ts). Owner-editable after.';

grant select, insert, update on public.work_cards to authenticated;

notify pgrst, 'reload schema';
