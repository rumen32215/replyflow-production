-- ReplyFlow — 0033: Customers (Plumber Reset, Phase 3 step 1 — schema)
--
-- Root cause fix, per DOCS/SPECS/ReplyFlow-Plumber-Reset-Phase1-Audit.md
-- §3.1: there is no durable customer identity anywhere in this schema.
-- "Customer" is reconstructed live by matching work_cards.customer_name
-- to conversations.customer_name — a string match against WhatsApp's
-- own mutable profile-name field. A returning customer with a changed,
-- blank, or differently-spelled name is silently treated as new.
--
-- customers is phone-anchored (unique per business_id + phone, same
-- key conversations already uses) and becomes the identity backbone:
-- conversations and work_cards gain a nullable customer_id FK here;
-- the actual backfill is a separate migration (0034), following this
-- schema's own established convention (0031 schema / 0032 backfill).
--
-- Deliberately minimal — no separate "facts"/"preferences" table.
-- name/default_address/communication_preference/notes are the only
-- owner-editable fields, reusing the same "infer to propose, ask to
-- confirm" discipline already used for job_doc_fields provenance
-- rather than inventing a second memory system. Anything AI-suggested
-- (a relationship summary, a suggested note) is computed at read time
-- from the customer's job history — never silently written here.
--
-- RLS/grants follow the conversations (0003/0019) pattern exactly:
-- owners can SELECT the full row, but write access is a narrow,
-- explicit column grant (name, default_address, communication_
-- preference, notes) — identity resolution/creation (business_id,
-- phone) stays a service-role-only concern, done by the inbound
-- pipeline, never a client-side insert.

create table if not exists public.customers (
  id                        uuid primary key default gen_random_uuid(),
  business_id               uuid not null references public.businesses(id) on delete cascade,

  phone                     text not null,
  name                      text,
  default_address           text,
  communication_preference  text,
  notes                     text,

  last_contact_at           timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint customers_business_phone_key unique (business_id, phone)
);

create index if not exists customers_business_id_idx on public.customers (business_id);

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();

alter table public.customers enable row level security;

drop policy if exists "Owners can view their own customers" on public.customers;
create policy "Owners can view their own customers"
  on public.customers for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists "Owners can update their own customers" on public.customers;
create policy "Owners can update their own customers"
  on public.customers for update
  using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

grant select on public.customers to authenticated;
grant update (name, default_address, communication_preference, notes) on public.customers to authenticated;

-- ---------------------------------------------------------------------
-- Additive customer_id on the two tables that currently stand in for
-- "who is this" — nullable, backfilled by 0034, set by application
-- code on every new row going forward (Phase 3 step 2).

alter table public.conversations
  add column if not exists customer_id uuid references public.customers(id) on delete set null;
create index if not exists conversations_customer_id_idx on public.conversations (customer_id);

alter table public.work_cards
  add column if not exists customer_id uuid references public.customers(id) on delete set null;
create index if not exists work_cards_customer_id_idx on public.work_cards (customer_id);

notify pgrst, 'reload schema';
