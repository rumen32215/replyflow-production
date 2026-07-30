import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The ONE place a `businesses` row is ever created.
 *
 * Journey guarantee (Decision Log / auth audit): the moment a session
 * exists, the owner has exactly one businesses row — never zero, never
 * duplicates. Called from:
 *
 *   1. /auth/callback  — right after the email-verification code is
 *      exchanged for a session, so the row exists *before* onboarding
 *      even starts. The owner never knows this happened.
 *   2. /api/onboarding/prepare — defence in depth for accounts created
 *      before this flow existed (their first login after verification
 *      may never pass through the callback again).
 *
 * Idempotent and race-safe: a concurrent insert (double-click, two
 * tabs) trips the `businesses_owner_id_key` unique constraint, which
 * simply means the row now exists — success either way.
 */

const NEW_BUSINESS_DEFAULTS = {
  business_name: "Your business",
  trade: "plumbing",
  phone: "",
  onboarding_completed: false,
} as const;

// Master Execution Plan 3.1 — matches the "7-day free trial" already
// promised at signup (components/auth/signup-form.tsx). Computed fresh
// per call, never a column default, so it's always anchored to the
// real moment this specific business was created.
const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type BusinessRow = {
  id: string;
  business_name: string;
  trade: string;
  onboarding_completed: boolean;
};

export async function ensureBusinessRow(
  supabase: SupabaseClient,
  ownerId: string
): Promise<{ business: BusinessRow | null; error: string | null }> {
  const select = "id, business_name, trade, onboarding_completed";

  const { data: existing, error: lookupError } = await supabase
    .from("businesses")
    .select(select)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (lookupError) return { business: null, error: lookupError.message };
  if (existing) return { business: existing as BusinessRow, error: null };

  const { data: created, error: insertError } = await supabase
    .from("businesses")
    .insert({
      owner_id: ownerId,
      ...NEW_BUSINESS_DEFAULTS,
      trial_ends_at: new Date(Date.now() + TRIAL_DURATION_MS).toISOString(),
    })
    .select(select)
    .single();

  if (!insertError) return { business: created as BusinessRow, error: null };

  // 23505 = unique_violation: someone else won the race — re-read.
  if (insertError.code === "23505") {
    const { data: raced, error: rereadError } = await supabase
      .from("businesses")
      .select(select)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (rereadError) return { business: null, error: rereadError.message };
    return { business: raced as BusinessRow, error: null };
  }

  return { business: null, error: insertError.message };
}
