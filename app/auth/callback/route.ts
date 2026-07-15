import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureBusinessRow } from "@/lib/business";

export const dynamic = "force-dynamic";

/**
 * Every Supabase email link (signup confirmation, password reset) that
 * uses `emailRedirectTo`/`redirectTo` sends the browser here first,
 * with a `?code=...` query param — @supabase/ssr defaults to the PKCE
 * flow, which requires exchanging that code for a session via
 * exchangeCodeForSession() before any page can see the user as logged
 * in.
 *
 * This route is also where the journey guarantee begins:
 *
 *   Verify Email -> /auth/callback -> Authenticated Session
 *     -> Business Row Created -> Onboarding
 *
 * The moment the session exists we make sure the owner has exactly one
 * `businesses` row (idempotent — see lib/business.ts). Onboarding then
 * only ever *fills in* that row; it never has to create anything, and
 * the dashboard's owner_id lookup can never come back empty for a
 * verified account. The user never knows this happened.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only ever forward to a same-origin path — never a full URL.
  const nextParam = searchParams.get("next") ?? "/welcome";
  const next = nextParam.startsWith("/") ? nextParam : "/welcome";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Best-effort here: if this insert ever fails (transient DB
        // hiccup), /api/onboarding/prepare repeats the same guarantee
        // at the end of onboarding, so the journey still completes.
        await ensureBusinessRow(supabase, user.id);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Missing or invalid code — send the visitor somewhere sensible
  // instead of a dead end. /login shows a friendly error state.
  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
