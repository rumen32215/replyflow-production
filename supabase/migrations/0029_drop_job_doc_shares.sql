-- ReplyFlow — 0029: drop job_doc_shares (ReplyFlow V2 cleanup)
--
-- job_doc_shares (0025_job_docs.sql) was built as foundation-only
-- scaffolding for a future "share this job doc externally" feature —
-- its own migration comment says so explicitly ("nothing writes to
-- this table yet ... sharing is explicitly out of scope"). It was
-- never wired to any application code: zero references anywhere
-- outside that migration file.
--
-- ReplyFlow V2 (DOCS/SPECS — Implementation Blueprint) explicitly
-- defers external job-doc sharing rather than building it now, so
-- this table has no near-term feature to serve. Dropping it now,
-- while it holds no real data, is safe cleanup; keeping unused schema
-- around only for a feature we've deliberately chosen not to build
-- yet is pure weight. The `job-doc-media` storage bucket is untouched
-- — it's real, active storage for job_doc_photos, not exclusive to
-- sharing.

drop policy if exists "Owners can view their own job doc shares" on public.job_doc_shares;
drop table if exists public.job_doc_shares;

notify pgrst, 'reload schema';
