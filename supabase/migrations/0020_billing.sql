-- Master Execution Plan 3.1 — Billing and subscription lifecycle.
-- Status values match the set already named in
-- DOCS/SPECS/ReplyFlow-Operations-Blueprint.md §6: trialing, active,
-- past_due, canceled.
alter table businesses
  add column subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  add column trial_ends_at timestamptz,
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text unique;

-- Every business that already existed before billing existed was never
-- shown the "7-day free trial" promise (components/auth/signup-form.tsx)
-- and was never asked to pay — grandfather them as active rather than
-- retroactively starting a trial countdown (and an eventual gate) on a
-- real, already-operating business. Only genuinely new signups going
-- forward get 'trialing' with a real trial_ends_at, set explicitly at
-- creation time in lib/business.ts (never a column default, so the
-- 7-day window is computed fresh at signup, not frozen at migration time).
update businesses set subscription_status = 'active';
