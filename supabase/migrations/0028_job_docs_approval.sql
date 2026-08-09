-- ReplyFlow — 0028: Job Records internal approval (Stage 2)
--
-- Two additive, minimal schema changes needed before any owner-facing
-- approval action can be built. Nothing here wires up an approval
-- route or UI — that's Stage 3, deliberately not started here.
--
-- job_docs — 'approved' widens the existing status lifecycle (draft ->
-- review -> approved -> signed -> exported) to represent the owner's
-- own internal confirmation that a generated report is accurate and
-- ready, distinct from the existing 'signed' stage (a customer-facing
-- e-signature step, out of scope here — no sharing/portal exists to
-- reach a customer with yet). approved_by follows the exact pattern
-- created_by already uses (an authenticated owner, not free text);
-- approved_at follows the exact pattern signed_at/exported_at already
-- use (a plain nullable timestamp, no default). No existing row can
-- have status = 'approved' yet — nothing writes it before Stage 3 — so
-- widening the check constraint changes no existing data.
--
-- job_doc_photos — included_in_report lets a later stage exclude a
-- specific photo from the generated/exported report without deleting
-- it. Defaults to true for both existing rows and any new insert: a
-- photo already on a job record is implicitly part of that record's
-- report today (nothing filters photos out currently), so `true`
-- preserves that real, existing behaviour rather than silently
-- changing what an already-created job record produces.

alter table public.job_docs drop constraint if exists job_docs_status_check;
alter table public.job_docs
  add constraint job_docs_status_check
  check (status in ('draft', 'review', 'approved', 'signed', 'exported'));

alter table public.job_docs
  add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.job_docs
  add column if not exists approved_at timestamptz;

alter table public.job_doc_photos
  add column if not exists included_in_report boolean not null default true;

notify pgrst, 'reload schema';
