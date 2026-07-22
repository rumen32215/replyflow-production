-- ReplyFlow — 0011: "no reply needed" as a real, auditable outcome
--
-- Voice doc 07 §2 "Ending conversations" and Judgement doc 08 "deliberately
-- do nothing": silence is a deliberate, correct outcome for a bare
-- acknowledgement with nothing outstanding, not a gap in the system. Before
-- this migration there was no way to represent "the Receptionist looked at
-- this and correctly decided not to reply" as a real record — only
-- pending/approved/edited/rejected/sent/failed, all of which imply either a
-- pending action or an actual message. Widening the status enum, not adding
-- a new table or workflow: the existing pending-drafts query already
-- filters on status = 'pending', so a row landing here is automatically
-- excluded from the owner's approval queue with no UI change required.

alter table public.reply_drafts drop constraint if exists reply_drafts_status_check;
alter table public.reply_drafts
  add constraint reply_drafts_status_check
  check (status in ('pending', 'approved', 'edited', 'rejected', 'sent', 'failed', 'no_reply_needed'));

notify pgrst, 'reload schema';
