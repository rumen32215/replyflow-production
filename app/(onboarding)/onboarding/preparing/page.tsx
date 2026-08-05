import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PreparingReceptionist } from "@/components/onboarding/preparing-receptionist";

export const metadata: Metadata = { title: "Preparing your receptionist — ReplyFlow" };

// Session check runs per-request — never statically prerender
// (same reasoning as app/page.tsx).
export const dynamic = "force-dynamic";

/**
 * Screen 5 — her first day starts. Middleware already guarantees a
 * session on /onboarding/*, but we re-check here (defence in depth)
 * and short-circuit users whose business is already fully set up so
 * revisiting this URL never replays onboarding.
 */
export default async function PreparingPage() {
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

  if (business?.onboarding_completed) redirect("/dashboard");

  return <PreparingReceptionist />;
}
