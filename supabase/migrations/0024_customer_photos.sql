-- ReplyFlow — 0024: Customer photo intake (Phase B — the
-- differentiating loop)
--
-- Two additions, following existing conventions exactly:
--
-- 1. messages gains three nullable columns describing the media Meta
--    delivered for a non-text inbound message. Deliberately flat
--    columns on the existing table, not a new one — one WhatsApp
--    message carries at most one media item, same reasoning as every
--    other "add real structure when a real feature needs it" decision
--    already in this schema (see 0005_jobs.sql's own comment).
--
-- 2. conversation_photos is new because a job can accumulate several
--    photos across a conversation — a real many-to-one relationship a
--    flat column on messages can't express. Keyed by conversation_id
--    (not work_card_id): a photo can arrive before any Work Card
--    exists yet (Work Cards are owner-created, see
--    components/dashboard/conversations/conversation-story.tsx), so
--    tying this to conversation_id — already the stable, always-
--    present anchor every other pipeline table uses — avoids an
--    ordering dependency entirely.
--
-- RLS follows the exact whatsapp_connections/reply_drafts pattern:
-- this is real pipeline output, never something the owner types in
-- directly, so owners get SELECT only — every write is service-role
-- (lib/reply-engine/media-intake.ts).
--
-- The storage bucket is created here too, private (public=false) and
-- with no RLS policy granted to `authenticated` at all — the only
-- reader is the service role (server-side signed URLs, generated only
-- after the requesting owner's RLS-scoped conversation lookup already
-- proved ownership — see the conversation detail page), the same
-- "never public by default" principle 0018 already established for
-- whatsapp_connections.access_token, applied to a new kind of secret:
-- a customer's own photo of their property.

alter table public.messages
  add column if not exists media_id text,
  add column if not exists media_mime_type text,
  add column if not exists storage_path text;

create table if not exists public.conversation_photos (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  conversation_id     uuid not null references public.conversations(id) on delete cascade,
  message_id          uuid not null references public.messages(id) on delete cascade,

  storage_path        text not null,
  visible_summary     text not null,
  possible_summary    text not null,
  unknown_note        text not null,
  analysis_confidence text not null default 'low' check (analysis_confidence in ('low', 'medium', 'high')),

  created_at          timestamptz not null default now(),

  constraint conversation_photos_message_id_key unique (message_id)
);

create index if not exists conversation_photos_conversation_id_idx on public.conversation_photos (conversation_id);
create index if not exists conversation_photos_business_id_idx on public.conversation_photos (business_id);

alter table public.conversation_photos enable row level security;

drop policy if exists "Owners can view their own conversation photos" on public.conversation_photos;
create policy "Owners can view their own conversation photos"
  on public.conversation_photos for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

grant select on public.conversation_photos to authenticated;

insert into storage.buckets (id, name, public)
values ('customer-media', 'customer-media', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
