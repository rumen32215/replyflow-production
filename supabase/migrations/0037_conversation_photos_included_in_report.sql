-- ReplyFlow — 0037: included_in_report for conversation_photos
--
-- Real production test (2026-08-15): a customer sent an irrelevant
-- screenshot over WhatsApp alongside a genuine job photo. The owner had
-- no way to exclude it from the customer-facing report — trying to
-- "remove" it failed outright, because the removal route only ever
-- looked in job_doc_photos, and even a working delete would have been
-- wrong here: an inbound WhatsApp photo is real conversation evidence
-- and must never be destroyed just because the owner doesn't want it in
-- the report. That distinction (conversation evidence vs. report
-- content) already exists for manually-uploaded photos via
-- job_doc_photos.included_in_report (0028) — this migration is the
-- same column, same default, same meaning, on the other photo source,
-- closing the gap rather than inventing a new mechanism.
--
-- Additive only: existing rows default to true (unchanged report
-- behaviour for every photo already in a report today).

alter table public.conversation_photos
  add column if not exists included_in_report boolean not null default true;

notify pgrst, 'reload schema';
