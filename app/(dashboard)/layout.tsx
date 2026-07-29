import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/app/(dashboard)/sidebar";
import { Topbar } from "@/app/(dashboard)/topbar";
import { BottomNav } from "@/app/(dashboard)/bottom-nav";
import { groupForStatus } from "@/lib/conversations";
import { TEST_CONVERSATION_PHONE } from "@/lib/test-conversation";

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
    .select("id, business_name, logo_url, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();
  // A real query error is not "onboarding incomplete" — this guards
  // every dashboard page, so conflating the two here would silently
  // bounce the whole app into the onboarding wizard on any transient
  // failure. See the identical fix in dashboard/receptionist/page.tsx.
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);
  if (!business?.onboarding_completed) redirect("/welcome");

  const approvalsCount = await getApprovalsCount(supabase, business.id);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar approvalsCount={approvalsCount} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar businessName={business.business_name} logoUrl={business.logo_url} approvalsCount={approvalsCount} />
        {/* pb-24 keeps content clear of the mobile tab bar */}
        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-6 md:px-8 md:pb-8 md:pt-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}

/**
 * Master Execution Plan 2.4 — the same three real signals that make up
 * Front Desk's attention queue and the Approvals page's total (waiting
 * conversations, draft Work Cards, distinct conversations with a
 * pending reply draft), fetched lightly (no row content, just what's
 * needed to count) since this runs on every dashboard page load. Kept
 * in lockstep with those two so the nav badge, the Front Desk heading,
 * and the Approvals page always agree on the same number.
 */
async function getApprovalsCount(supabase: ReturnType<typeof createClient>, businessId: string): Promise<number> {
  const { data: testConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_phone", TEST_CONVERSATION_PHONE)
    .maybeSingle();
  const testConversationId = testConversation?.id ?? null;

  const [{ data: conversations }, { count: draftWorkCardCount }, { data: pendingReplyDrafts }] = await Promise.all([
    supabase
      .from("conversations")
      .select("status, last_message_at")
      .eq("business_id", businessId)
      .neq("customer_phone", TEST_CONVERSATION_PHONE),
    supabase.from("work_cards").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "draft"),
    (() => {
      let q = supabase.from("reply_drafts").select("conversation_id").eq("business_id", businessId).eq("status", "pending");
      if (testConversationId) q = q.neq("conversation_id", testConversationId);
      return q;
    })(),
  ]);

  const waitingCount = (conversations ?? []).filter((c) => groupForStatus(c.status) === "waiting" && c.last_message_at).length;
  const pendingReplyConversationCount = new Set((pendingReplyDrafts ?? []).map((d) => d.conversation_id)).size;

  return waitingCount + (draftWorkCardCount ?? 0) + pendingReplyConversationCount;
}
