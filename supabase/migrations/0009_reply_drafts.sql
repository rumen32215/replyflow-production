-- ReplyFlow — 0009: AI-drafted replies (Sprint 10A)
--
-- The Reply Engine's output is never sent automatically — it always
-- lands here first, as its own row, exactly the same precedent already
-- set by jobs.status = 'draft' (a booking draft is a real row the
-- owner must approve/edit/reject, never a fake "booked" job pending
-- approval). A separate table rather than a `messages` row with a
-- pending status, because a message that *might* be sent is a
-- different kind of fact than a message that *happened* — blending
-- them would risk corrupting conversations.last_message_at/preview,
-- which the webhook only ever sets from real inbound messages.
--
-- Write access follows whatsapp_connections/conversations/messages
-- (service-role only), not jobs' owner-writable pattern: creating a
-- draft is always a backend pipeline event, and *resolving* one
-- (approve/edit/reject) requires sending a real WhatsApp message using
-- a stored access token the browser must never see — so resolution
-- goes through a server route, not a direct client update, unlike a
-- job's approve/reject which only ever touches Postgres.
--
-- customer_message_id is unique so re-processing the same inbound
-- message (webhook retry, reruns) can never produce two drafts for
-- one message — the pipeline upserts on conflict instead.

create table if not exists public.reply_drafts (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  conversation_id       uuid not null references public.conversations(id) on delete cascade,
  customer_message_id   uuid references public.messages(id) on delete set null,

  draft_text            text not null,
  final_text            text,

  intent                text not null,
  understanding_confidence text not null default 'unknown'
                        check (understanding_confidence in ('unknown', 'low', 'medium', 'high')),
  confidence            text not null default 'unknown'
                        check (confidence in ('unknown', 'low', 'medium', 'high', 'verified')),
  category              text not null,
  requires_escalation   boolean not null default false,
  escalation_reason     text,
  facts_used            jsonb not null default '[]'::jsonb,

  -- What the safety layer computed, kept for transparency/audit even
  -- though Sprint 10A never acts on it — every draft still requires a
  -- real approval, regardless of this value. Auto-send is future work.
  would_auto_send       boolean not null default false,
  safety_reasons        jsonb not null default '[]'::jsonb,

  status                text not null default 'pending'
                        check (status in ('pending', 'approved', 'edited', 'rejected', 'sent', 'failed')),
  error_message         text,

  created_at            timestamptz not null default now(),
  resolved_at           timestamptz,

  constraint reply_drafts_customer_message_id_key unique (customer_message_id)
);

create index if not exists reply_drafts_business_id_idx on public.reply_drafts (business_id);
create index if not exists reply_drafts_conversation_id_idx on public.reply_drafts (conversation_id, created_at desc);
create index if not exists reply_drafts_status_idx on public.reply_drafts (business_id, status);

alter table public.reply_drafts enable row level security;

drop policy if exists "Owners can view their own reply drafts" on public.reply_drafts;
create policy "Owners can view their own reply drafts"
  on public.reply_drafts for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

grant select on public.reply_drafts to authenticated;

notify pgrst, 'reload schema';
