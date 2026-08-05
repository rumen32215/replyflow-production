import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TestConversation } from "@/components/dashboard/receptionist/test-conversation";

export const metadata: Metadata = { title: "Try your receptionist — ReplyFlow" };

/**
 * Test Conversations — "Try to break me" (`03-Trust-Experience.md`
 * §3-4; roadmap items A2/A3; `DOCS/SPECS/Hiring-Experience-
 * Redesign.md` §4). Reached directly from Meet Your Receptionist's
 * confirm button, before WhatsApp is ever mentioned — the "wow, she
 * already understands my business" moment, using everything real
 * taught so far, before asking for access to anything real.
 */
export default async function TryReceptionistPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, business_name, trade, receptionist_name")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);
  if (!business) redirect("/onboarding/preparing");

  return (
    <TestConversation
      businessName={business.business_name}
      trade={business.trade}
      receptionistName={business.receptionist_name}
    />
  );
}
