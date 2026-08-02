-- ReplyFlow — 0022: Learning proposals (Brain Loop Stage 8, "Learning Memory")
--
-- DOCS/CONSTITUTION/12-ReplyFlow-Learning-Memory-Architecture.md is the
-- permanent architecture this table implements. Not a fifth Business
-- Brain memory type — a confirmed learning is written straight into
-- the same place teaching already writes to (ai_configurations.business_rules).
-- This table exists only to hold a *proposal* between the moment it's
-- generated and the moment the owner responds — the same operational
-- role error_events/product_events already play for their own
-- mechanisms, not a new memory concept.
--
-- "Infer to propose, ask to confirm": proposed_lesson is always a
-- hedged hypothesis, never a claimed fact, and is never read by
-- anything else in the product until status moves to 'confirmed' or
-- 'clarified'. Deliberately does NOT store the raw customer message —
-- only the two draft texts being compared, matching the same data
-- boundary every other table here already applies (opaque references
-- and short generated text, never free-form customer content beyond
-- what the reply itself already contained).
--
-- Write access is service-role only (the same pattern as reply_drafts):
-- creating a proposal is a backend pipeline event, and resolving one
-- writes to ai_configurations, which the browser must never do directly.

create table if not exists public.learning_proposals (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  reply_draft_id    uuid references public.reply_drafts(id) on delete set null,

  category          text not null,
  original_text     text not null,
  edited_text       text not null,
  proposed_lesson   text not null,

  status            text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'ignored', 'clarified', 'deferred')),
  -- What actually got written to business_rules on confirm/clarify —
  -- proposed_lesson verbatim for 'confirmed', the owner's own words
  -- for 'clarified'. Null until resolved.
  confirmed_text    text,

  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

create index if not exists learning_proposals_business_id_idx on public.learning_proposals (business_id, created_at desc);
create index if not exists learning_proposals_status_idx on public.learning_proposals (business_id, status, created_at asc);

alter table public.learning_proposals enable row level security;

drop policy if exists "Owners can view their own learning proposals" on public.learning_proposals;
create policy "Owners can view their own learning proposals"
  on public.learning_proposals for select
  using (business_id in (select id from public.businesses where owner_id = auth.uid()));

grant select on public.learning_proposals to authenticated;

notify pgrst, 'reload schema';
