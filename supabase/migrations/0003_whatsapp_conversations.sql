-- ReplyFlow — 0003: WhatsApp Cloud API integration (connections, conversations, messages)
--
-- Security model, spelled out because it's the part most likely to be
-- gotten wrong: none of these three tables grant INSERT/UPDATE to the
-- `authenticated` role. Owners can only ever SELECT. Every write comes
-- from server-side code using the Supabase *service role* key — the
-- token-exchange route (app/api/whatsapp/connect) and the webhook
-- (app/api/webhooks/whatsapp) — because neither has a browser session
-- to authenticate as an owner. Service role bypasses RLS entirely by
-- design, so these policies are really just "owners can read their own
-- data," full stop.

create table if not exists public.whatsapp_connections (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,

  waba_id           text not null,           -- WhatsApp Business Account ID
  phone_number_id   text not null,           -- the specific number ReplyFlow sends/receives from
  display_phone_number text,
  access_token      text not null,           -- system-user token from Embedded Signup token exchange
  token_expires_at  timestamptz,

  webhook_verified  boolean not null default false,
  connected_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint whatsapp_connections_business_id_key unique (business_id),
  constraint whatsapp_connections_phone_number_id_key unique (phone_number_id)
);

create table if not exists public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,

  customer_phone      text not null,
  customer_name       text,
  status              text not null default 'open' check (status in ('open', 'closed')),

  last_message_at     timestamptz,
  last_message_preview text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint conversations_business_customer_key unique (business_id, customer_phone)
);

create table if not exists public.messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.conversations(id) on delete cascade,
  business_id         uuid not null references public.businesses(id) on delete cascade, -- denormalized for simpler RLS + querying

  direction           text not null check (direction in ('inbound', 'outbound')),
  whatsapp_message_id text unique,            -- Meta's message id, used to de-duplicate webhook retries
  from_number         text not null,
  to_number            text not null,
  message_type        text not null default 'text',
  body                 text,
  status               text,                  -- sent / delivered / read / failed (outbound only, for later)

  created_at          timestamptz not null default now()
);

create index if not exists whatsapp_connections_business_id_idx on public.whatsapp_connections (business_id);
create index if not exists conversations_business_id_idx on public.conversations (business_id);
create index if not exists conversations_last_message_at_idx on public.conversations (business_id, last_message_at desc);
create index if not exists messages_conversation_id_idx on public.messages (conversation_id, created_at);
create index if not exists messages_business_id_idx on public.messages (business_id);

drop trigger if exists set_whatsapp_connections_updated_at on public.whatsapp_connections;
create trigger set_whatsapp_connections_updated_at
  before update on public.whatsapp_connections
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
  before update on public.conversations
  for each row execute procedure public.set_updated_at();

alter table public.whatsapp_connections enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Owners can view their own WhatsApp connection" on public.whatsapp_connections;
create policy "Owners can view their own WhatsApp connection"
  on public.whatsapp_connections for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists "Owners can view their own conversations" on public.conversations;
create policy "Owners can view their own conversations"
  on public.conversations for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

drop policy if exists "Owners can view their own messages" on public.messages;
create policy "Owners can view their own messages"
  on public.messages for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

-- Read-only grants to `authenticated` — no insert/update/delete. Writes
-- happen exclusively via the service role key from server-side routes.
grant select on public.whatsapp_connections to authenticated;
grant select on public.conversations to authenticated;
grant select on public.messages to authenticated;

notify pgrst, 'reload schema';
