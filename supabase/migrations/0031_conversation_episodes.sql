-- ReplyFlow — 0031: Conversation Episodes (Phase 1 — schema)
--
-- Root cause fix: conversations has `unique (business_id,
-- customer_phone)` — one row per phone number, forever. Every job a
-- customer ever has shares that one row's ai_state, messages, photos,
-- and drafts. A live test found a brand new, unrelated job silently
-- merging into an old one's stale state.
--
-- conversation_episodes sits between the permanent customer identity
-- (conversations, unchanged) and the four tables that currently key
-- off conversation_id directly. conversation_id stays on all four
-- (denormalized, same reasoning already used for business_id
-- throughout this schema) — this is additive, not a replacement.
--
-- Only 'active'/'waiting_owner' count as "in progress" for the
-- one-open-episode constraint below — a 'booked' episode (a confirmed
-- future appointment) does not block a new, unrelated episode from
-- opening; a customer can have a booked job for tomorrow and a
-- genuinely new problem today at the same time.

create table if not exists public.conversation_episodes (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  business_id     uuid not null references public.businesses(id) on delete cascade,

  status          text not null default 'active'
                  check (status in ('active', 'waiting_owner', 'booked', 'completed', 'abandoned')),
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,

  -- Moves here from conversations.ai_state (Phase 3 stops writing to
  -- the old column) — this episode's own working understanding, never
  -- the customer's lifetime history.
  ai_state        jsonb not null default '{}'::jsonb,

  -- A short label for the Customers timeline ("Toilet leak"), set
  -- from ai_state.slots.issue once known — never a separately invented
  -- description, same discipline work_cards.conversation_summary
  -- already follows.
  summary_label   text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- At most one genuinely in-progress episode per customer at a time —
-- the deterministic guarantee that makes "the current episode" always
-- an unambiguous lookup, never a guess.
create unique index if not exists conversation_episodes_one_in_progress_per_conversation
  on public.conversation_episodes (conversation_id)
  where status in ('active', 'waiting_owner');

create index if not exists conversation_episodes_conversation_id_idx on public.conversation_episodes (conversation_id);
create index if not exists conversation_episodes_business_status_idx on public.conversation_episodes (business_id, status);

drop trigger if exists set_conversation_episodes_updated_at on public.conversation_episodes;
create trigger set_conversation_episodes_updated_at
  before update on public.conversation_episodes
  for each row execute procedure public.set_updated_at();

-- RLS follows the exact reply_drafts / conversation_photos pattern:
-- this is real pipeline output, never something the owner types in
-- directly, so owners get SELECT only — every write goes through the
-- service role.
alter table public.conversation_episodes enable row level security;

drop policy if exists "Owners can view their own conversation episodes" on public.conversation_episodes;
create policy "Owners can view their own conversation episodes"
  on public.conversation_episodes for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

grant select on public.conversation_episodes to authenticated;

-- ---------------------------------------------------------------------
-- Additive episode_id on every table that currently keys off
-- conversation_id. Nullable — Phase 2 backfills existing rows; Phase 3
-- application code sets it on every new row going forward.

alter table public.messages
  add column if not exists episode_id uuid references public.conversation_episodes(id) on delete set null;
create index if not exists messages_episode_id_idx on public.messages (episode_id);

alter table public.conversation_photos
  add column if not exists episode_id uuid references public.conversation_episodes(id) on delete set null;
create index if not exists conversation_photos_episode_id_idx on public.conversation_photos (episode_id);

alter table public.reply_drafts
  add column if not exists episode_id uuid references public.conversation_episodes(id) on delete set null;
create index if not exists reply_drafts_episode_id_idx on public.reply_drafts (episode_id);

alter table public.work_cards
  add column if not exists episode_id uuid references public.conversation_episodes(id) on delete set null;
create index if not exists work_cards_episode_id_idx on public.work_cards (episode_id);

-- Stale-draft prevention (Phase 3 writes this status): a superseded
-- draft is neither pending nor one of the terminal outcomes — it was
-- overtaken by a newer draft in the same episode, or its episode
-- closed while it was still unresolved.
alter table public.reply_drafts drop constraint if exists reply_drafts_status_check;
alter table public.reply_drafts add constraint reply_drafts_status_check
  check (status in ('pending', 'approved', 'edited', 'rejected', 'sent', 'failed', 'no_reply_needed', 'superseded'));

notify pgrst, 'reload schema';
