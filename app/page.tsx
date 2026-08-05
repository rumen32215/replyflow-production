import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/marketing/landing-page";

export const metadata: Metadata = {
  title: "ReplyFlow — Never miss another job because you were up a ladder",
  description:
    "ReplyFlow is the AI receptionist for UK tradespeople — it answers your WhatsApp while you work, and actually knows your business, not just how to chat.",
};

// Every render depends on the caller's session — never attempt static
// prerendering. Without this, Next's build-time prerender pass can
// crash if env vars aren't available at build time (our Supabase
// client throws before Next's automatic dynamic-route detection, which
// relies on cookies() actually being called, ever kicks in).
export const dynamic = "force-dynamic";

/**
 * Root of the app, and — as of the Landing Experience (`DOCS/SPECS/
 * ReplyFlow-Landing-Experience-Design.md` §10) — the real landing page
 * too. Routes the visitor to wherever they actually belong:
 *   no session            -> the Landing Experience, rendered directly
 *   onboarding unfinished -> /onboarding/preparing (screen 5)
 *   onboarding complete   -> /dashboard
 *
 * /login is no longer the de facto front door — it still exists,
 * reached only by an explicit "Log in" action, never as the default
 * unauthenticated experience.
 *
 * The three real questions (`(hire)/hire/*`) now come before an
 * account exists, and the account itself is created only at signup —
 * so the only way to hold a session without onboarding_completed is
 * to have already answered them and created the account, meaning
 * screen 5 is genuinely where they left off (`DOCS/SPECS/ReplyFlow-
 * Onboarding-Implementation-Architecture.md` §1, §3.2).
 */
export default async function RootPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <LandingPage />;

  const { data: business } = await supabase
    .from("businesses")
    .select("onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business?.onboarding_completed) redirect("/onboarding/preparing");

  redirect("/dashboard");
}
