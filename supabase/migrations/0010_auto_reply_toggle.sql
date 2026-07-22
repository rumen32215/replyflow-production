-- ReplyFlow — 0010: opt-in auto-send for the lowest-risk reply category
--
-- Every AI-drafted reply has always required manual owner approval
-- before sending (Sprint 10A). This adds the first, narrowly-scoped
-- exception: when explicitly turned on, replies the Reply Engine's
-- own safety layer already classifies as category "general" (plain
-- greetings, business-information questions, status checks — never
-- booking, pricing, cancellation, complaints, or emergencies, which
-- remain manual-approval-only regardless of this setting) may send
-- automatically if they also clear the existing confidence and
-- fact-grounding checks. Off by default — an owner must deliberately
-- turn this on; nothing changes for anyone who doesn't.

alter table public.ai_configurations
  add column if not exists auto_reply_general_enabled boolean not null default false;

notify pgrst, 'reload schema';
