-- ReplyFlow — 0012: persisted conversation state (Conversation Intelligence Sprint)
--
-- The single schema change the state-machine redesign needs: a place to
-- carry forward what the receptionist already knows about where a
-- conversation is (stage, what's been collected, what's still open,
-- whether a greeting has already happened) so it's read and updated
-- turn by turn, never re-derived from scratch by re-reading the raw
-- transcript. One jsonb column on the existing conversation, not a new
-- table — this is state *about* a conversation, one-to-one with it,
-- the same relationship currentBooking already has with jobs.
--
-- Nullable, no default: a conversation with ai_state = null simply has
-- no state yet (brand new, or predates this migration) and the
-- pipeline bootstraps it fresh on its next processed message — never a
-- breaking read for existing rows.

alter table public.conversations add column if not exists ai_state jsonb;

notify pgrst, 'reload schema';
