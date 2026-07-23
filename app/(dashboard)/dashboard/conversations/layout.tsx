import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationsShell } from "@/components/dashboard/conversations/conversations-shell";

/**
 * Sprint 8.5 IA review: this layout used to also build a full Shared
 * Brain (business/receptionist/diary/activity) purely to show a "you
 * still don't know X — teach me?" nudge and a "what I've learned
 * recently" list in the empty state. Conversations' job is live
 * customer communication, not a second Everything I Know / Front Desk
 * Recommendations — that content is now removed, and with it the
 * Brain call and the business/ai_configurations fetches that only
 * existed to feed it. This layout now does exactly one thing: load
 * the conversation list and which ones have a draft booking waiting.
 */
export default async function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  // A real query error is not "no business yet" — see the identical
  // fix and explanation in dashboard/receptionist/page.tsx.
  if (businessError) throw new Error(`Failed to load business: ${businessError.message}`);

  const [{ data: conversations }, { data: draftJobs }] = business
    ? await Promise.all([
        supabase
          .from("conversations")
          .select("id, customer_name, customer_phone, last_message_preview, last_message_at, status")
          .eq("business_id", business.id)
          .order("last_message_at", { ascending: false, nullsFirst: false }),
        // Which conversations have a booking waiting on the owner's
        // decision — an orthogonal signal to conversation status, so
        // the list can surface it without a 5th status group.
        supabase.from("work_cards").select("conversation_id").eq("business_id", business.id).eq("status", "draft"),
      ])
    : [{ data: [] }, { data: [] }];

  const draftConversationIds = (draftJobs ?? [])
    .map((j) => j.conversation_id)
    .filter((id): id is string => Boolean(id));

  return (
    <ConversationsShell conversations={conversations ?? []} draftConversationIds={draftConversationIds}>
      {children}
    </ConversationsShell>
  );
}
