-- ReplyFlow — 0034: Customers (Plumber Reset, Phase 3 step 1 — backfill)
--
-- Exactly one customer per existing (business_id, customer_phone) pair,
-- preserving every existing conversations/work_cards row unchanged —
-- this only populates the new customers table and the customer_id
-- columns 0033 added. Additive only: nothing deleted, nothing
-- overwritten. Mirrors 0032's own schema/backfill split.
--
-- work_cards has no phone column of its own (it only ever had
-- conversation_id) — its customer_id is backfilled by joining through
-- the conversation it came from, not by a direct phone match.

insert into public.customers (business_id, phone, name, communication_preference, last_contact_at, created_at)
select
  c.business_id,
  c.customer_phone,
  c.customer_name,
  c.communication_preference,
  c.last_message_at,
  c.created_at
from public.conversations c
where not exists (
  select 1 from public.customers cu
  where cu.business_id = c.business_id and cu.phone = c.customer_phone
);

update public.conversations c
set customer_id = cu.id
from public.customers cu
where cu.business_id = c.business_id
  and cu.phone = c.customer_phone
  and c.customer_id is null;

update public.work_cards w
set customer_id = c.customer_id
from public.conversations c
where c.id = w.conversation_id
  and c.customer_id is not null
  and w.customer_id is null;

notify pgrst, 'reload schema';
