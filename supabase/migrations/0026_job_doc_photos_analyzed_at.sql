-- ReplyFlow — 0026: job_doc_photos analysis status (Phase 2A)
--
-- One additive column, exactly as approved. NULL means analysis
-- hasn't reached a terminal state yet (pending); set means it has —
-- whether that's a successful analysis, an honest "nothing useful
-- found," or a recorded analysis error. Deliberately not a status
-- enum and not a separate analysis-events table — the existing
-- visible_summary/possible_summary/unknown_note/analysis_confidence
-- columns already carry the outcome; this column only answers
-- "is there an outcome yet."

alter table public.job_doc_photos
  add column if not exists analyzed_at timestamptz;

notify pgrst, 'reload schema';
