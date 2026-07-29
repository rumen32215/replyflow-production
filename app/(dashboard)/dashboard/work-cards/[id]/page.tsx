import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkCardDetail } from "@/components/dashboard/work-cards/work-card-detail";
import { groupForStatus, type ConversationGroup } from "@/lib/conversations";
import { toConversationState } from "@/lib/reply-engine/understanding/state";

export const metadata: Metadata = { title: "Work Card — ReplyFlow" };

/**
 * Master Execution Plan 2.1 — the dedicated Work Card page
 * (`DOCS/SPECS/Work-Card-Object.md`, `06-Experience-Architecture.md`
 * §2). Every current reference to a Work Card across Front Desk and
 * Customers now points here instead of the parent conversation. The
 * test this page is built against: could a technician who has never
 * touched ReplyFlow walk out the door with only this screen open and
 * do the job competently?
 *
 * No Photos section — the `messages` table has no media/attachment
 * storage anywhere yet (a real, separately-tracked gap,
 * `Work-Card-Object.md` §6), so this deliberately doesn't render a
 * section that could never have real content.
 */
export default async function WorkCardDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS (0013) scopes this to the signed-in owner's business.
  const { data: workCard } = await supabase
    .from("work_cards")
    .select(
      "id, business_id, conversation_id, customer_name, issue, status, estimated_value, scheduled_for, completed_at, notes, created_at, address, address_confirmed, collected_details, conversation_summary, approved_at"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!workCard) notFound();

  const [{ data: conversation }, { data: siblingCards }] = await Promise.all([
    workCard.conversation_id
      ? supabase
          .from("conversations")
          .select("id, customer_phone, status, ai_state")
          .eq("id", workCard.conversation_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Relationship context (Work-Card-Object.md §2: "computed live, not
    // stored") — other Work Cards from the same conversation thread,
    // the same scoping `RelationshipOverview` already uses on the
    // Customer page.
    workCard.conversation_id
      ? supabase
          .from("work_cards")
          .select("id, status")
          .eq("conversation_id", workCard.conversation_id)
          .neq("id", workCard.id)
      : Promise.resolve({ data: [] }),
  ]);

  const conversationState = conversation ? toConversationState(conversation.ai_state) : null;
  const isEmergency = Boolean(
    conversationState &&
      conversationState.goal.type === "handle_emergency" &&
      conversationState.goal.status !== "completed" &&
      conversationState.goal.status !== "abandoned"
  );
  const conversationGroup: ConversationGroup | null = conversation ? groupForStatus(conversation.status) : null;

  const completedSiblingCount = (siblingCards ?? []).filter((c) => c.status === "completed").length;

  return (
    <WorkCardDetail
      workCard={{
        id: workCard.id,
        conversationId: workCard.conversation_id,
        customerName: workCard.customer_name,
        customerPhone: conversation?.customer_phone ?? null,
        issue: workCard.issue,
        status: workCard.status,
        estimatedValue: workCard.estimated_value,
        scheduledFor: workCard.scheduled_for,
        completedAt: workCard.completed_at,
        notes: workCard.notes,
        createdAt: workCard.created_at,
        address: workCard.address,
        addressConfirmed: workCard.address_confirmed,
        collectedDetails: workCard.collected_details,
        conversationSummary: workCard.conversation_summary,
        approvedAt: workCard.approved_at,
      }}
      conversationGroup={conversationGroup}
      isEmergency={isEmergency}
      completedSiblingCount={completedSiblingCount}
    />
  );
}
