-- ReplyFlow — 0032: Conversation Episodes (Phase 2 — backfill)
--
-- Exactly one episode per existing conversation, preserving every
-- existing row exactly as it is. Additive only: nothing is deleted,
-- nothing is overwritten, no historical message/photo content is
-- rewritten. Every existing conversations row keeps every existing
-- column unchanged — this only populates the new episode_id columns
-- 0031 just added.
--
-- Status mapping is a best-effort translation of the coarse
-- conversation-level status into the new episode-level one — it
-- doesn't need to be perfect, only safe: every existing conversation
-- ends up with exactly one real episode that legitimately represents
-- "everything that happened so far," and the one-in-progress-per-
-- customer constraint (0031) is satisfied by construction, since this
-- inserts exactly one row per conversation.

insert into public.conversation_episodes (conversation_id, business_id, status, opened_at, ai_state)
select
  c.id,
  c.business_id,
  case c.status
    when 'booked' then 'booked'
    when 'completed' then 'completed'
    when 'closed' then 'completed'       -- legacy: reads as completed
    when 'waiting_owner' then 'waiting_owner'
    when 'open' then 'waiting_owner'     -- legacy: reads as waiting
    else 'active'                        -- 'new', 'gathering', anything else
  end,
  c.created_at,
  coalesce(c.ai_state, '{}'::jsonb)
from public.conversations c
where not exists (
  select 1 from public.conversation_episodes e where e.conversation_id = c.id
);

update public.messages m
set episode_id = e.id
from public.conversation_episodes e
where e.conversation_id = m.conversation_id
  and m.episode_id is null;

update public.conversation_photos p
set episode_id = e.id
from public.conversation_episodes e
where e.conversation_id = p.conversation_id
  and p.episode_id is null;

update public.reply_drafts d
set episode_id = e.id
from public.conversation_episodes e
where e.conversation_id = d.conversation_id
  and d.episode_id is null;

update public.work_cards w
set episode_id = e.id
from public.conversation_episodes e
where e.conversation_id = w.conversation_id
  and w.episode_id is null;

notify pgrst, 'reload schema';
