import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. Needed wherever there's
 * no owner session to check RLS against (a webhook Meta/Stripe calls
 * server-to-server) or where deep pipeline code legitimately needs to
 * write across the data it's processing (the reply engine, usage/error
 * tracking). By now this is the majority of server-side code, not two
 * files — the rule that actually matters (Security Baseline §5, Master
 * Execution Plan 1.4) isn't "which files," it's: **any consumer
 * reachable over HTTP by a human operator must authenticate that
 * operator and authorize against a real, scoped check before this
 * client is ever touched — never simply hold or proxy the service role
 * to whoever can reach the URL.** Every current web-reachable consumer
 * (API routes) already re-derives and checks the caller's own session
 * first; the one exception is app/admin/* (Master Execution Plan 3.3),
 * which checks the session against a real admin allowlist
 * (lib/admin.ts) before this client is used for anything.
 *
 * The `server-only` import makes this throw a build error if anything
 * tries to pull it into a Client Component bundle — the service role
 * key must never reach the browser. A plain Server Component/page that
 * just needs the current owner's own data should still prefer
 * lib/supabase/server.ts (the RLS-respecting client) — this one is for
 * genuinely no-session or genuinely cross-tenant cases only.
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
