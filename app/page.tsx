import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Every render depends on the caller's session — never attempt static
// prerendering. Without this, Next's build-time prerender pass can
// crash if env vars aren't available at build time (our Supabase
// client throws before Next's automatic dynamic-route detection, which
// relies on cookies() actually being called, ever kicks in).
export const dynamic = "force-dynamic";

/**
 * Root of the *application* (not the marketing site — the landing page
 * stays a separate static file for now per the current brief). Routes
 * the visitor to wherever they actually belong:
 *   no session            -> /login
 *   onboarding unfinished -> /welcome (Screen 1 of onboarding)
 *   onboarding complete   -> /dashboard
 *
 * A verified account with no businesses row shouldn't exist any more
 * (the row is created in /auth/callback), but if one does, /welcome ->
 * onboarding -> preparing repairs it — so both "no row" and "row, not
 * completed" resolve to the same place.
 */
export default async function RootPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business?.onboarding_completed) redirect("/welcome");

  redirect("/dashboard");
}
