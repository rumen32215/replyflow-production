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
 *
 * TEMPORARY DEBUG INSTRUMENTATION — remove before shipping.
 * Returns JSON instead of redirecting so the exact failure point of
 * the PKCE exchange can be inspected directly in the browser.
 */
export async function GET(request: Request) {
  const { searchParams, origin, href } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/welcome";

  // TEMP DEBUG: no code param present at all
  if (!code) {
    return NextResponse.json(
      {
        debug: true,
        step: "no_code_param",
        message: "No `code` query parameter was present on the incoming request.",
        fullUrl: href,
        origin,
        searchParams: Object.fromEntries(searchParams.entries()),
        next,
      },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // TEMP DEBUG: exchangeCodeForSession failed
  if (error) {
    return NextResponse.json(
      {
        debug: true,
        step: "exchange_code_for_session_failed",
        message: error.message,
        status: error.status ?? null,
        name: error.name ?? null,
        code,
        next,
        origin,
        fullUrl: href,
      },
      { status: 500 }
    );
  }

  // TEMP DEBUG: exchange succeeded
  return NextResponse.json({
    debug: true,
    step: "exchange_code_for_session_success",
    message: "exchangeCodeForSession() succeeded. Session cookies were set on this response.",
    next,
    origin,
    fullUrl: href,
  });
}