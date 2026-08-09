-- ReplyFlow — 0027: Job Records draft-generation lock (Phase 2A hardening, BUG-14)
--
-- One additive, nullable column so only one Generate/Regenerate Draft
-- operation can ever be in flight per job record. NULL means nothing
-- is currently generating; a timestamp means one acquired the lock at
-- that moment. The route (POST app/api/job-docs/[id]/draft/route.ts)
-- acquires it with a single atomic conditional UPDATE — WHERE id = $1
-- AND (draft_generating_at IS NULL OR draft_generating_at < staleness
-- threshold) — so of two concurrent requests, exactly one UPDATE can
-- ever affect a row; the other affects zero rows and is rejected with
-- 409, with no read-then-write window for both to slip through.
--
-- Released (set back to NULL) in the route's own finally block
-- regardless of success or failure. The staleness window in that same
-- WHERE clause is a second, independent backstop for the case where a
-- request dies before ever reaching that finally (e.g. the function is
-- killed mid-flight) — the lock self-expires rather than staying stuck
-- forever and blocking every future attempt on that job record.

alter table public.job_docs
  add column if not exists draft_generating_at timestamptz;

notify pgrst, 'reload schema';
