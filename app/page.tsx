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
 *   no session          -> /login
 *   session, no business record yet -> /onboarding/business-info
 *   session, onboarding incomplete  -> resume at the right step
 *   session, onboarding complete    -> /dashboard
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

  if (!business) redirect("/onboarding/business-info");
  if (!business.onboarding_completed) redirect("/onboarding/business-info");

  redirect("/dashboard");
}
