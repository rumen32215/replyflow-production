-- ReplyFlow — 0038: optional owner-entered charges on the Job Report
--
-- Production test finding (2026-08-15): there was no way for the
-- owner to put a price on a completed Job Report at all. Two nullable
-- numeric fields, both null by default — a report with neither entered
-- shows no Charges section at all (see selectCharges,
-- lib/job-docs/report-content.ts), never a fabricated "£0.00" that
-- could be mistaken for a real, deliberate price.
--
-- Deliberately minimal, per the explicit product decision: not a
-- quotation engine, not accounting software. Labour and materials only;
-- the total is always computed (labour + materials), never a third,
-- separately-entered figure that could disagree with its own
-- breakdown. AI never writes these columns — there is no AI code path
-- that touches them anywhere in this codebase; only the owner's own
-- edit (app/api/job-docs/[id]/charges) does.

alter table public.job_docs
  add column if not exists charge_labour numeric(10, 2);
alter table public.job_docs
  add column if not exists charge_materials numeric(10, 2);

comment on column public.job_docs.charge_labour is
  'Owner-entered labour/work charge, GBP. Null when not entered — never AI-generated, never defaulted to zero.';
comment on column public.job_docs.charge_materials is
  'Owner-entered materials charge, GBP. Null when not entered — never AI-generated, never defaulted to zero.';

notify pgrst, 'reload schema';
