-- ReplyFlow — 0036: Autonomy tiers (Plumber Reset, Phase 3 step 5)
--
-- Per DOCS/SPECS/ReplyFlow-Plumber-Reset-Phase2-Architecture.md §7,
-- approved with explicit constraints in the Phase 3 sign-off: a real,
-- deterministic three-tier autonomy model, not a vague global "AI
-- autonomy" setting and not a learned trust score.
--
-- ai_configurations gains exactly one new owner-facing setting,
-- distinct from the existing auto_reply_general_enabled (0010) toggle
-- (plain greetings/FAQs) — this one governs a materially different,
-- higher-stakes action (confirming a real booking on the customer's
-- behalf) and is deliberately named for exactly what it does, per the
-- explicit instruction: "Automatic booking" / "Allow ReplyFlow to
-- confirm available bookings automatically when the customer has
-- clearly accepted a time." Off by default — autonomy here is opt-in,
-- never assumed.
--
-- reply_drafts gains four nullable, additive columns:
-- - autonomy_tier: which of the four tiers this message's outcome was
--   decided under, for audit and, later, UI (Phase 3 step 7 — not this
--   migration). Always set going forward; null on pre-existing rows.
-- - action_type/action_summary/action_payload: the structured "decision
--   the owner can approve or reject" the Phase 3 sign-off asked for
--   (e.g. "Sarah wants Tuesday at 10:00am... Confirm booking?"),
--   populated whenever a booking-related tool actually ran this turn —
--   set once, from real tool-execution output only, never invented.
--   This is data-layer only: no new UI renders it yet (Phase 3 step 7).

alter table public.ai_configurations
  add column if not exists auto_confirm_bookings_enabled boolean not null default false;

comment on column public.ai_configurations.auto_confirm_bookings_enabled is
  'Tier 1 autonomy — explicit, narrow, off by default. Only ever consulted when every other deterministic Tier 1 condition already holds (explicit customer acceptance of a genuinely available slot, non-urgent, complete job info).';

alter table public.reply_drafts
  add column if not exists autonomy_tier text
    check (autonomy_tier in ('tier0_auto', 'tier1_auto_action', 'tier2_prepare', 'tier3_owner_required'));
alter table public.reply_drafts
  add column if not exists action_type text
    check (action_type in ('confirm_booking', 'propose_booking', 'reschedule_booking', 'cancel_booking'));
alter table public.reply_drafts
  add column if not exists action_summary text;
alter table public.reply_drafts
  add column if not exists action_payload jsonb;

notify pgrst, 'reload schema';
