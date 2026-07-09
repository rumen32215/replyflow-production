import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. This is intentional and
 * required: the webhook and token-exchange routes have no user session
 * to authenticate as (Meta is calling us, not a logged-in owner), so
 * there's no `auth.uid()` for RLS to check against.
 *
 * The `server-only` import makes this throw a build error if anything
 * tries to pull it into a Client Component bundle — the service role
 * key must never reach the browser.
 *
 * Only import this from:
 *   - app/api/webhooks/whatsapp/route.ts
 *   - app/api/whatsapp/connect/route.ts
 * Anything else that needs business data should use lib/supabase/server.ts
 * (the RLS-respecting client) instead.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role configuration. Check that NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY are set in .env.local (the service role key is in your " +
        "Supabase project's API settings — keep it server-side only, never NEXT_PUBLIC_)."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
