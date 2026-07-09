import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StepSuccess } from "@/components/onboarding/step-success";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "You're all set — ReplyFlow" };

// Checks the caller's session and business record server-side — must
// not be statically prerendered (see app/page.tsx for the full explanation).
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business?.onboarding_completed) redirect("/onboarding/business-info");

  return <StepSuccess businessName={business.business_name} />;
}
