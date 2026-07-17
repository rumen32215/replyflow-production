-- ReplyFlow — 0007: free-text teaching for tone
--
-- Receptionist V3.1 lets an owner teach every topic — tone, behaviours,
-- house rules, escalation — in their own words, not just from chips.
-- Behaviours/rules/escalation already have a free-text home (their
-- existing plain-text columns already losslessly preserve anything
-- typed beyond the known chip options — see lib/receptionist.ts
-- parseOptions/composeOptions). Tone is the one exception: it's a
-- constrained enum column with no room for freeform text, so it gets
-- its own small, additive column, matching the shape of its siblings.
alter table public.ai_configurations
  add column if not exists tone_notes text not null default '';

notify pgrst, 'reload schema';
