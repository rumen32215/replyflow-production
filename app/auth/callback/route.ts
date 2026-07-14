import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Every Supabase email link (signup confirmation, password reset) that
 * uses `emailRedirectTo`/`redirectTo` sends the browser here first,
 * with a `?code=...` query param — @supabase/ssr defaults to the PKCE
 * flow, which requires exchanging that code for a session via
 * exchangeCodeForSession() before any page can see the user as logged
 * in. This route is that missing step: exchange the code, then forward
 * to wherever the link was actually meant to go (`next`, e.g. /welcome
 * for signup or /login for password reset).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/welcome";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
