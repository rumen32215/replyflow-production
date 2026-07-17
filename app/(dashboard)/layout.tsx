import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/app/(dashboard)/sidebar";
import { Topbar } from "@/app/(dashboard)/topbar";
import { BottomNav } from "@/app/(dashboard)/bottom-nav";

/**
 * Guards the whole (dashboard) route group server-side: no session ->
 * /login, onboarding not finished -> back into the wizard. Mobile-first
 * shell (Implementation Pack): bottom tab bar on phones, sidebar on
 * desktop — the same five destinations, desktop simply gains space.
 */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("business_name, logo_url, onboarding_completed, receptionist_name")
    .eq("owner_id", user.id)
    .maybeSingle();
  // A real query error is not "onboarding incomplete" — this guards
  // every dashboard page, so conflating the two here would silently
  // bounce the whole app into the onboarding wizard on any transient
  // failure. See the identical fix in dashboard/receptionist/page.tsx.
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);
  if (!business?.onboarding_completed) redirect("/welcome");

  return (
    <div className="flex h-screen bg-background">
      <Sidebar receptionistName={business.receptionist_name} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar businessName={business.business_name} logoUrl={business.logo_url} />
        {/* pb-24 keeps content clear of the mobile tab bar */}
        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-6 md:px-8 md:pb-8 md:pt-8">{children}</main>
      </div>
      <BottomNav receptionistName={business.receptionist_name} />
    </div>
  );
}
