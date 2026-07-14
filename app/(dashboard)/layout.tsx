import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/app/(dashboard)/sidebar";
import { Topbar } from "@/app/(dashboard)/topbar";

/**
 * Guards the whole (dashboard) route group server-side, same pattern as
 * app/(onboarding)/onboarding/success/page.tsx: no session -> /login,
 * onboarding not finished -> back into the wizard. Fetching the business
 * row here (not per-page) means every dashboard page gets it via layout
 * without refetching.
 */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name, logo_url, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business?.onboarding_completed)
  redirect("/welcome");
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar businessName={business.business_name} logoUrl={business.logo_url} />
        <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
