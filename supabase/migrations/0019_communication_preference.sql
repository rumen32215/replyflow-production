-- ReplyFlow — 0019: Communication preference (Master Execution Plan 2.3)
--
-- One of the three real fields Customers completion names as missing
-- (06-Experience-Architecture.md §4) that genuinely has no data home
-- anywhere in the schema — confirmed directly against the live
-- `conversations` table before writing this migration, not assumed.
--
-- Deliberately a single, owner-entered, free-text field — never
-- AI-inferred (matching this page's own existing discipline: "nothing
-- here infers a preference from message content," customer-memory-
-- signals.ts) and deliberately not a structured dropdown of contact
-- hours/channels. A short note in the owner's own words ("prefers a
-- text over a call") reads like a receptionist's memory; a form field
-- reads like a CRM — the Founder Constitution's own drawn boundary
-- ("We are not a CRM... helps owners understand customer relationships
-- rather than simply manage them").
--
-- Lives on `conversations` rather than a new `customers` table, since
-- a customer is still a real `conversations` row in this data model
-- (unique per business_id + customer_phone, migration 0003) — adding
-- a new first-class entity for one text field would be exactly the
-- premature structure the Constitution warns against.

alter table public.conversations
  add column if not exists communication_preference text;

-- 0006 narrowed owner UPDATE access to `status` only (conversations
-- are otherwise service-role-write-only). This is the second
-- legitimately owner-editable field — widen the same way, not by
-- loosening the row-level policy itself.
grant update (status, communication_preference) on public.conversations to authenticated;

notify pgrst, 'reload schema';
