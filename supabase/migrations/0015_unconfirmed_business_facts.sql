-- ReplyFlow — 0015: unconfirmed business facts must stay unknown
-- (Product Guarantee 1: the receptionist must never invent business
-- facts)
--
-- offers_emergency_callouts defaulted to `true` for every new
-- business — meaning a brand-new, never-configured business was
-- already being represented to real customers (in the live phone
-- preview, the Meet Your Receptionist recap, and the real Reply
-- Engine's grounded facts) as offering emergency call-outs, something
-- nobody ever taught. Every other boolean on this table correctly
-- defaults to `false` (the safe "nothing claimed until taught"
-- direction) — this was the one exception. charges_callout_fee has
-- the same shape of problem: `false` is a specific, confident claim
-- ("you don't charge a fee") that's just as unconfirmed as `true`
-- would be for a business that's never touched the setting.
--
-- Both become nullable, with no default — a genuinely new business
-- now has an honest "not yet known" state the recap, the live
-- preview, and the Reply Engine's grounded facts can all disclose
-- instead of guessing. Existing rows are left untouched: retroactively
-- nulling out already-live businesses' real, working configuration
-- would risk silently changing what an existing real customer hears
-- for a fact that may well have been genuinely true by coincidence —
-- this fixes the guarantee going forward, not by guessing backward.

alter table public.businesses
  alter column offers_emergency_callouts drop not null,
  alter column offers_emergency_callouts drop default,
  alter column charges_callout_fee drop not null,
  alter column charges_callout_fee drop default;

notify pgrst, 'reload schema';
