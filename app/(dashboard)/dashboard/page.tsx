import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  GreetingCard,
  TodaysPriorityCard,
  SetupJourney,
  type JourneyStep,
} from "@/components/dashboard/home/home-experience";
import { AttentionQueue } from "@/components/dashboard/home/attention-queue";
import { ConnectionAlert } from "@/components/dashboard/home/connection-alert";
import { TodaysWork, type TodaysWorkItem } from "@/components/dashboard/home/todays-work";
import { WaitingForCustomer, type WaitingForCustomerItem } from "@/components/dashboard/home/waiting-for-customer";
import { RecentlyCompleted, type RecentlyCompletedItem } from "@/components/dashboard/home/recently-completed";
import { ReceptionistActivity } from "@/components/dashboard/home/receptionist-activity";
import { QuickActions } from "@/components/dashboard/home/quick-actions";
import { Recommendations } from "@/components/dashboard/home/recommendations";
import { minutesSince, buildPresenceLine } from "@/lib/dashboard-signals";
import {
  buildAttentionQueue,
  buildReceptionistActivity,
  groupPendingRepliesByConversation,
  describeConnectionHealth,
  type AttentionWaitingConversation,
  type AttentionDraftWorkCard,
} from "@/lib/front-desk-signals";
import { parseAvailability } from "@/lib/availability";
import { parseKnowledge } from "@/lib/knowledge";
import { getBrainContext, selectTodaysPriority } from "@/lib/brain";
import { groupForStatus, type ConversationGroup } from "@/lib/conversations";
import { TEST_CONVERSATION_PHONE } from "@/lib/test-conversation";
import { toConversationState } from "@/lib/reply-engine/understanding/state";

export const metadata: Metadata = { title: "Front Desk — ReplyFlow" };

/**
 * Front Desk (Owner Experience 01 — "Mission Control (Front Desk)")
 * — the owner's one real front desk, replacing what used to be two
 * separate pages (this calm summary at /dashboard, and a broader
 * operational board at /dashboard/mission-control). Keeping both was
 * real duplication — roughly three of four top-line numbers were each
 * computed twice, independently, and a new owner had no way to know
 * which page to actually check first. This is the one page now:
 * ordered by urgency (Needs Your Attention -> Today's Work -> Waiting
 * For Customer -> Recently Completed -> Receptionist Activity), not by
 * which table the data came from. Nothing here is invented — every
 * section reads real rows already fetched below, and any section with
 * nothing true to say doesn't render.
 */
export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id, business_name, logo_url, whatsapp_connected, availability, opening_time, closing_time, business_description, services, service_areas, business_knowledge, handover_confirmed_at"
    )
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/welcome");

  const businessId = business.id;
  // Test Conversations ("Try to break me") writes real reply_drafts
  // rows via the real pipeline (lib/test-conversation.ts) — those
  // aren't reachable through the conversations list already filtered
  // above (reply_drafts is queried by business_id directly, not
  // joined), so its conversation id is looked up once here and
  // excluded from both reply_drafts queries below.
  const { data: testConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_phone", TEST_CONVERSATION_PHONE)
    .maybeSingle();
  const testConversationId = testConversation?.id ?? null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const now = new Date();

  const [
    { data: conversations },
    { count: conversationCount },
    { data: draftWorkCards },
    { data: todaysWorkCards },
    { data: futureBookedWorkCards },
    { data: recentCompletedWorkCards },
    { count: completedEver },
    { data: recentCreatedWorkCards },
    { data: recentBookedWorkCards },
    { data: pendingReplyDrafts },
    { data: recentEscalations },
    { data: config },
    { data: whatsappConnection },
    { count: realTestExchangeCount },
  ] = await Promise.all([
    // Real, already-live conversation state for every recent
    // conversation — the one fetch every section below reads from for
    // "is this waiting, and is it actually an emergency" (Conversation
    // State's real goal type, never inferred from message text).
    // Test Conversations ("Try to break me") never appears on Front
    // Desk alongside real customer activity — lib/test-conversation.ts.
    supabase
      .from("conversations")
      .select("id, customer_name, customer_phone, last_message_preview, last_message_at, status, ai_state")
      .eq("business_id", businessId)
      .neq("customer_phone", TEST_CONVERSATION_PHONE)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .neq("customer_phone", TEST_CONVERSATION_PHONE),
    supabase
      .from("work_cards")
      .select("id, conversation_id, customer_name, issue, created_at")
      .eq("business_id", businessId)
      .eq("status", "draft")
      .order("created_at", { ascending: true }),
    supabase
      .from("work_cards")
      .select("id, conversation_id, customer_name, issue, status, scheduled_for, address_confirmed")
      .eq("business_id", businessId)
      .gte("scheduled_for", startOfToday.toISOString())
      .lt("scheduled_for", endOfToday.toISOString())
      .order("scheduled_for", { ascending: true }),
    supabase
      .from("work_cards")
      .select("id, conversation_id, customer_name, issue, scheduled_for")
      .eq("business_id", businessId)
      .eq("status", "booked")
      .gte("scheduled_for", endOfToday.toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(8),
    supabase
      .from("work_cards")
      .select("id, customer_name, issue, completed_at")
      .eq("business_id", businessId)
      .not("completed_at", "is", null)
      .gte("completed_at", sevenDaysAgo.toISOString())
      .order("completed_at", { ascending: false })
      .limit(6),
    supabase.from("work_cards").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "completed"),
    supabase
      .from("work_cards")
      .select("id, customer_name, issue, created_at")
      .eq("business_id", businessId)
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("work_cards")
      .select("id, customer_name, issue, approved_at, scheduled_for")
      .eq("business_id", businessId)
      .not("approved_at", "is", null)
      .gte("approved_at", sevenDaysAgo.toISOString())
      .order("approved_at", { ascending: false })
      .limit(5),
    (() => {
      let q = supabase
        .from("reply_drafts")
        .select("id, conversation_id, requires_escalation, created_at")
        .eq("business_id", businessId)
        .eq("status", "pending");
      if (testConversationId) q = q.neq("conversation_id", testConversationId);
      return q.order("created_at", { ascending: true });
    })(),
    (() => {
      let q = supabase
        .from("reply_drafts")
        .select("id, escalation_reason, created_at")
        .eq("business_id", businessId)
        .eq("requires_escalation", true)
        .not("escalation_reason", "is", null)
        .gte("created_at", sevenDaysAgo.toISOString());
      if (testConversationId) q = q.neq("conversation_id", testConversationId);
      return q.order("created_at", { ascending: false }).limit(5);
    })(),
    supabase
      .from("ai_configurations")
      .select("tone_notes, system_prompt, business_rules, escalation_rules, faqs")
      .eq("business_id", businessId)
      .maybeSingle(),
    // Real connection health (checklist 3.2) — token_expires_at is
    // written at connect time and was never read anywhere afterward
    // until now; businesses.whatsapp_connected is a one-time flag that
    // never reflects a token going bad later.
    supabase
      .from("whatsapp_connections")
      .select("token_expires_at")
      .eq("business_id", businessId)
      .maybeSingle(),
    // V1 First-Run redesign — the new "Test your receptionist" journey
    // step and the WhatsApp Proof-Before-Ask gate both need the same
    // real signal: has at least one genuine reply ever been generated
    // against the reserved test conversation (never written for the
    // honest "not ready" fallback, only for a real, generated reply).
    testConversationId
      ? supabase.from("reply_drafts").select("id", { count: "exact", head: true }).eq("conversation_id", testConversationId)
      : Promise.resolve({ count: 0 }),
  ]);

  // One map, built once, every section below reads from it — a
  // conversation's group (waiting/active/booked/done) and whether its
  // real goal is an emergency, keyed by id.
  const conversationById = new Map(
    (conversations ?? []).map((c) => {
      const state = toConversationState(c.ai_state);
      return [
        c.id,
        {
          name: c.customer_name || c.customer_phone,
          status: c.status,
          group: groupForStatus(c.status) as ConversationGroup,
          isEmergency: state.goal.type === "handle_emergency" && state.goal.status !== "completed" && state.goal.status !== "abandoned",
          lastMessageAt: c.last_message_at as string | null,
          lastMessagePreview: c.last_message_preview as string | null,
        },
      ];
    })
  );

  /* ------------------------------ Attention queue ------------------------------ */

  // `conversations` is fetched newest-first (needed for the activity
  // feed and the emergency/group lookup map) — re-sorted here so
  // "oldest waiting" below is actually the longest wait, not whichever
  // waiting conversation happens to be most recent.
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
  }));

  const pendingReplyItems = groupPendingRepliesByConversation(
    (pendingReplyDrafts ?? []).map((d) => ({
      draftId: d.id,
      conversationId: d.conversation_id,
      customerName: conversationById.get(d.conversation_id)?.name ?? "A customer",
      minutes: minutesSince(d.created_at),
      requiresEscalation: d.requires_escalation,
    }))
  );

  const attentionQueue = buildAttentionQueue({
    waitingConversations: waitingConversationItems,
    draftWorkCards: draftWorkCardItems,
    pendingReplies: pendingReplyItems,
  });

  /* -------------------------------- Today's work -------------------------------- */

  const todaysWorkItems: TodaysWorkItem[] = (todaysWorkCards ?? []).map((j) => {
    const entry = j.conversation_id ? conversationById.get(j.conversation_id) : undefined;
    return {
      id: j.id,
      conversationId: j.conversation_id,
      customerName: j.customer_name,
      issue: j.issue,
      scheduledFor: j.scheduled_for,
      status: j.status,
      addressConfirmed: j.address_confirmed,
      conversationGroup: entry?.group ?? null,
      isEmergency: entry?.isEmergency ?? false,
    };
  });

  /* ---------------------------- Waiting for customer ----------------------------- */

  const waitingForCustomerItems: WaitingForCustomerItem[] = (futureBookedWorkCards ?? [])
    .filter((j): j is typeof j & { scheduled_for: string } => Boolean(j.scheduled_for))
    .map((j) => ({
      id: j.id,
      conversationId: j.conversation_id,
      customerName: j.customer_name,
      issue: j.issue,
      scheduledFor: j.scheduled_for,
    }));

  /* ------------------------------ Recently completed ------------------------------ */

  const recentlyCompletedItems: RecentlyCompletedItem[] = (recentCompletedWorkCards ?? []).map((j) => ({
    id: j.id,
    customerName: j.customer_name,
    issue: j.issue,
    completedAt: j.completed_at as string,
  }));

  /* ------------------------------ Receptionist activity ---------------------------- */

  const receptionistActivity = buildReceptionistActivity({
    startedWorkCards: (recentCreatedWorkCards ?? []).map((j) => ({
      id: j.id,
      issue: j.issue,
      customerName: j.customer_name,
      createdAt: j.created_at,
    })),
    bookedWorkCards: (recentBookedWorkCards ?? []).map((j) => ({
      id: j.id,
      issue: j.issue,
      customerName: j.customer_name,
      approvedAt: j.approved_at as string,
      scheduledFor: j.scheduled_for,
    })),
    completedWorkCards: recentlyCompletedItems.map((j) => ({
      id: j.id,
      issue: j.issue,
      customerName: j.customerName,
      completedAt: j.completedAt,
    })),
    newConversations: (conversations ?? [])
      .filter((c) => c.last_message_at && new Date(c.last_message_at) >= sevenDaysAgo && c.status === "new")
      .slice(0, 5)
      .map((c) => ({ id: c.id, name: c.customer_name || c.customer_phone, startedAt: c.last_message_at as string })),
    escalations: (recentEscalations ?? []).map((e) => ({
      id: e.id,
      reason: e.escalation_reason as string,
      occurredAt: e.created_at,
    })),
  });

  /* ------------------------------------------------------------------------------- */

  const whatsappConnected = business.whatsapp_connected ?? false;
  const connectionHealth = describeConnectionHealth({
    connected: whatsappConnected,
    tokenExpiresAt: whatsappConnection?.token_expires_at ?? null,
    now,
  });
  const noActivityYet = (conversationCount ?? 0) === 0 && (completedEver ?? 0) === 0;
  const availability = parseAvailability(business.availability, business.opening_time, business.closing_time);

  const oldestWaiting = waitingConversationItems[0] ?? null;
  const jobsBookedToday = todaysWorkItems.filter((j) => j.status === "booked" || j.status === "in_progress" || j.status === "completed").length;
  const completedToday = todaysWorkItems.filter((j) => j.status === "completed").length;

  const presenceLine = buildPresenceLine({
    isNewBusiness: noActivityYet,
    waitingCount: waitingConversationItems.length,
    waitingCustomer: oldestWaiting ? { name: oldestWaiting.name, minutes: oldestWaiting.minutes } : null,
    jobsBookedToday,
  });
  const rotateCalm = !oldestWaiting && jobsBookedToday === 0;

  // The one shared reasoning model every screen reads from.
  const brain = getBrainContext({
    businessId,
    knowledge: {
      businessDescription: business.business_description,
      services: business.services ?? [],
      serviceAreas: business.service_areas ?? [],
      knowledge: parseKnowledge(business.business_knowledge),
      faqCount: Array.isArray(config?.faqs) ? (config.faqs as unknown[]).length : 0,
    },
    receptionist: {
      behavioursTaught: Boolean(config?.system_prompt?.trim()),
      rulesTaught: Boolean(config?.business_rules?.trim()),
      escalationTaught: Boolean(config?.escalation_rules?.trim()),
    },
    diary: { rules: availability.rules },
    activity: {
      whatsappConnected,
      waitingCount: waitingConversationItems.length,
      oldestWaitingName: oldestWaiting?.name ?? null,
      oldestWaitingMinutes: oldestWaiting?.minutes ?? null,
      completedToday,
      bookedToday: jobsBookedToday,
    },
  });

  // V1 First-Run redesign (DOCS/SPECS/ReplyFlow-V1-First-Run-Proposal.md):
  // Meet now happens right after the one-minute setup — first, not
  // last-but-one — with Teach (the merged Business+Receptionist
  // surface) and Test following it, always before WhatsApp, never after.
  const hasRealTestExchange = Boolean(realTestExchangeCount && realTestExchangeCount > 0);
  const journeySteps: JourneyStep[] = [
    { id: "meet", label: "Meet your receptionist", done: Boolean(business.handover_confirmed_at), href: "/dashboard/receptionist/meet" },
    {
      id: "teach",
      label: "Teach your receptionist",
      done: brain.percentFor("knowledge") >= 100 && brain.percentFor("receptionist") >= 100,
      href: "/dashboard/receptionist",
    },
    { id: "test", label: "Test your receptionist", done: hasRealTestExchange, href: "/dashboard/receptionist/try" },
    { id: "whatsapp", label: "Connect WhatsApp", done: whatsappConnected, href: "/dashboard/whatsapp" },
  ];
  // A step's own `done` is always the honest, real signal — never
  // fabricated. Completion gating is separate: a real, already-
  // connected WhatsApp number is the strongest possible proof this
  // business already finished onboarding under whatever rules applied
  // at the time — it must never be retroactively re-locked behind a
  // step introduced afterwards (this exact bug: SHABZ, live and
  // connected since before "test" existed as a tracked step, had its
  // real Test Conversations activity reset at some point, which would
  // otherwise wrongly show the setup checklist to a mature, fully
  // operational business). `noActivityYet` still covers the narrower
  // case of a business with real conversations but no WhatsApp
  // connection on record.
  const journeyComplete = whatsappConnected || journeySteps.every((s) => s.done || (s.id === "meet" && !noActivityYet));

  const currentJob = todaysWorkItems.find((j) => j.status === "in_progress");
  const nextJob = todaysWorkItems.find((j) => j.status === "booked" && j.scheduledFor && new Date(j.scheduledFor) >= now);
  const todaysPriority = selectTodaysPriority({
    waitingCustomer: oldestWaiting ? { name: oldestWaiting.name, minutes: oldestWaiting.minutes, conversationId: oldestWaiting.conversationId } : null,
    waitingCount: waitingConversationItems.length,
    currentJob: currentJob ? { title: currentJob.issue, customerName: currentJob.customerName } : null,
    nextJob: nextJob ? { title: nextJob.issue, customerName: nextJob.customerName, scheduledFor: nextJob.scheduledFor } : null,
    jobsBookedToday,
  });

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {journeyComplete ? (
        <div className="space-y-3">
          <GreetingCard
            name={business.business_name}
            logoUrl={business.logo_url}
            supportLine={presenceLine}
            rotateCalm={rotateCalm}
            whatsappConnected={whatsappConnected}
            topGaps={brain.gaps.slice(0, 2).map((g) => g.label)}
            justBecameReady
          />
          <TodaysPriorityCard priority={todaysPriority} />
        </div>
      ) : (
        <SetupJourney name={business.business_name} steps={journeySteps} />
      )}

      <ConnectionAlert health={connectionHealth} />

      {journeyComplete && (
        <div className="space-y-6">
          <AttentionQueue items={attentionQueue} />
          <TodaysWork items={todaysWorkItems} />
          <WaitingForCustomer items={waitingForCustomerItems} />
          <RecentlyCompleted items={recentlyCompletedItems} />
          <Recommendations gaps={brain.gaps} />
          <ReceptionistActivity events={receptionistActivity} />
        </div>
      )}

      <div className="pt-2">
        <QuickActions businessId={businessId} initialAvailability={availability} />
      </div>
    </div>
  );
}
