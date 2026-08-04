import type { User } from "@supabase/supabase-js";

/**
 * V10 founder review (2026-08-04): sign-up now routes straight into
 * onboarding instead of stopping at a verification interstitial (see
 * `signup-form.tsx`) — but verification itself was never meant to go
 * away, only move to where it actually matters: "gently prompt the
 * user to verify before activating their receptionist or connecting
 * WhatsApp... treat this as a product decision, not a shortcut."
 *
 * This is the one place that decision is expressed. Supabase sets
 * `email_confirmed_at` the moment the confirmation link is clicked —
 * or, on a project with "Confirm email" switched off, immediately, in
 * which case this is always `true` and every gate built on it below
 * is a permanent no-op. Centralising the check here means re-tightening
 * verification anywhere else later (or adding a new gate in front of
 * some future production-use moment) is one more call site reading
 * this same function, never a redesign of how verification works.
 */
export function isEmailVerified(user: Pick<User, "email_confirmed_at">): boolean {
  return Boolean(user.email_confirmed_at);
}
