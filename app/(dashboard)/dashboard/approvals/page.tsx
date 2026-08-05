import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AttentionQueue } from "@/components/dashboard/home/attention-queue";
import { EmptyState } from "@/components/shared/empty-state";
import { minutesSince } from "@/lib/dashboard-signals";
import {
  buildAttentionQueue,
  groupPendingRepliesByConversation,
  isNoteworthyRelationship,
  type AttentionWaitingConversation,
  type AttentionDraftWorkCard,
} from "@/lib/front-desk-signals";
import { relationshipStrengthFor } from "@/lib/customer-memory-signals";
import { groupForStatus } from "@/lib/conversations";
import { TEST_CONVERSATION_PHONE } from "@/lib/test-conversation";
import { toConversationState } from "@/lib/reply-engine/understanding/state";

export const metadata: Metadata = { title: "Approvals — ReplyFlow" };

/**
 * Approvals (Experience Architecture §7) — the dedicated queue Front
 * Desk's own Needs Your Attention list only ever partially showed
 * (capped to an interruption budget of 8). Same real data, same
 * buildAttentionQueue()/AttentionQueue as Front Desk — deliberately a
 * second, independent fetch rather than a shared one, so nothing here
 * can ever change what Front Desk itself shows.
 */
export default async function ApprovalsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!business) redirect("/onboarding/preparing");

  const businessId = business.id;
  const { data: testConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_phone", TEST_CONVERSATION_PHONE)
    .maybeSingle();
  const testConversationId = testConversation?.id ?? null;

  const [{ data: conversations }, { data: draftWorkCards }, { data: pendingReplyDrafts }, { data: completedWorkCardConversations }] =
    await Promise.all([
      supabase
        .from("conversations")
        .select("id, customer_name, customer_phone, last_message_preview, last_message_at, status, ai_state")
        .eq("business_id", businessId)
        .neq("customer_phone", TEST_CONVERSATION_PHONE)
        .order("last_message_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("work_cards")
        .select("id, conversation_id, customer_name, issue, created_at")
        .eq("business_id", businessId)
        .eq("status", "draft")
        .order("created_at", { ascending: true }),
      (() => {
        let q = supabase
          .from("reply_drafts")
          .select("id, conversation_id, requires_escalation, created_at")
          .eq("business_id", businessId)
          .eq("status", "pending");
        if (testConversationId) q = q.neq("conversation_id", testConversationId);
        return q.order("created_at", { ascending: true });
      })(),
      // "Surface, don't build" (2026-08-02) — same real signal, same
      // reasoning as Front Desk's own identical query.
      supabase.from("work_cards").select("conversation_id").eq("business_id", businessId).eq("status", "completed"),
    ]);

  const completedCountByConversation = new Map<string, number>();
  for (const row of completedWorkCardConversations ?? []) {
    if (!row.conversation_id) continue;
    completedCountByConversation.set(row.conversation_id, (completedCountByConversation.get(row.conversation_id) ?? 0) + 1);
  }
  const noteworthyStrengthFor = (conversationId: string | null) => {
    if (!conversationId) return undefined;
    const strength = relationshipStrengthFor(completedCountByConversation.get(conversationId) ?? 0);
    return isNoteworthyRelationship(strength) ? strength : undefined;
  };

  const conversationById = new Map(
    (conversations ?? []).map((c) => {
      const state = toConversationState(c.ai_state);
      return [
        c.id,
        {
          name: c.customer_name || c.customer_phone,
          isEmergency: state.goal.type === "handle_emergency" && state.goal.status !== "completed" && state.goal.status !== "abandoned",
        },
      ];
    })
  );

  const waitingConversationItems: AttentionWaitingConversation[] = (conversations ?? [])
    .filter((c) => groupForStatus(c.status) === "waiting" && c.last_message_at)
    .map((c) => {
      const entry = conversationById.get(c.id)!;
      return {
        kind: "waiting_conversation" as const,
        conversationId: c.id,
        name: entry.name,
        reason: c.last_message_preview || "New enquiry",
        minutes: minutesSince(c.last_message_at as string),
        isEmergency: entry.isEmergency,
        relationshipStrength: noteworthyStrengthFor(c.id),
      };
    })
    .sort((a, b) => b.minutes - a.minutes);

  const draftWorkCardItems: AttentionDraftWorkCard[] = (draftWorkCards ?? []).map((j) => ({
    kind: "draft_work_card" as const,
    workCardId: j.id,
    conversationId: j.conversation_id,
    issue: j.issue,
    customerName: j.customer_name,
    minutes: minutesSince(j.created_at),
    relationshipStrength: noteworthyStrengthFor(j.conversation_id),
  }));

  const pendingReplyItems = groupPendingRepliesByConversation(
    (pendingReplyDrafts ?? []).map((d) => ({
      draftId: d.id,
      conversationId: d.conversation_id,
      customerName: conversationById.get(d.conversation_id)?.name ?? "A customer",
      minutes: minutesSince(d.created_at),
      requiresEscalation: d.requires_escalation,
      relationshipStrength: noteworthyStrengthFor(d.conversation_id),
    }))
  );

  // No interruption-budget cap here — this page's entire job is to be
  // the honest, complete list Front Desk's own capped queue points to.
  const approvalItems = buildAttentionQueue({
    waitingConversations: waitingConversationItems,
    draftWorkCards: draftWorkCardItems,
    pendingReplies: pendingReplyItems,
    limit: Number.MAX_SAFE_INTEGER,
  });

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Approvals</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Everything only you can unblock — waiting customers, draft Work Cards, and AI-drafted replies awaiting your OK.
        </p>
      </div>

      {approvalItems.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="You're all caught up."
          description="Nothing is waiting on you right now — check back if something new comes in."
        />
      ) : (
        <AttentionQueue items={approvalItems} title="Pending approvals" />
      )}
    </div>
  );
}
