-- ReplyFlow — 0030: link Job Records to the Work Card that produced them
--
-- V4 architecture decision (DOCS/SPECS — V4 audit): Work Card stays the
-- operational source of truth; a Job Record becomes a linked,
-- generated customer-facing document rather than a disconnected blank
-- form the owner had to retype everything into. This is the one schema
-- change that unblocks it — purely additive, nullable, no backfill
-- needed (no real customer data exists in this environment yet, only
-- founder dogfooding).
--
-- One Job Record per Work Card (unique partial index, null-safe) — a
-- conscious, revisitable choice, not a hard product law: if a later
-- need for revised/multiple reports per job emerges, this constraint
-- is the one thing that would need to change, not the column itself.
--
-- job_docs.conversation_id (0025) is untouched and keeps its original,
-- independent purpose — a Job Record may still exist without a Work
-- Card (the manual "New Job Record" path stays available as a
-- fallback for jobs that never went through WhatsApp).

alter table public.job_docs
  add column if not exists work_card_id uuid references public.work_cards(id) on delete set null;

create unique index if not exists job_docs_work_card_id_key
  on public.job_docs (work_card_id)
  where work_card_id is not null;

create index if not exists job_docs_work_card_id_idx on public.job_docs (work_card_id);

notify pgrst, 'reload schema';
