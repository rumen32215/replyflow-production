import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WelcomeGreeting } from "@/components/onboarding/welcome-greeting";

export const metadata: Metadata = { title: "Welcome — ReplyFlow" };

// Checks the caller's session server-side — must not be statically
// prerendered (see app/page.tsx for the full explanation).
export const dynamic = "force-dynamic";

/**
 * Onboarding Screen 1 — the receptionist's first hello. This is still
 * the same /welcome route used as the auth->onboarding bridge; only
 * the content changed. No inputs, no feature list — a new employee
 * greeting the owner on her first day, then one CTA into the demo.
 */
export default async function WelcomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Returning users who already have a fully set-up business shouldn't
  // see the hiring pitch again — straight to work.
  const { data: business } = await supabase
    .from("businesses")
    .select("onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (business?.onboarding_completed) redirect("/dashboard");

  return <WelcomeGreeting />;
}
