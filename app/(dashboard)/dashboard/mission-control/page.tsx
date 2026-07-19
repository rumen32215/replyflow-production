import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Sparkles } from "lucide-react";
import { OperationalOverview, isOperationallyEmpty, type OperationalOverviewMetrics } from "@/components/dashboard/mission-control/operational-overview";
import { UrgentWork, type UrgentItem } from "@/components/dashboard/mission-control/urgent-work";
import { ActiveConversations, type ActiveConversationItem } from "@/components/dashboard/mission-control/active-conversations";
import { TodaysJobs, type TodaysJobItem } from "@/components/dashboard/mission-control/todays-jobs";
import { WaitingCustomers } from "@/components/dashboard/mission-control/waiting-customers";
import { RecentActivity } from "@/components/dashboard/mission-control/recent-activity";
import { MissionControlBusinessHealth, type MissionControlHealthMetrics } from "@/components/dashboard/mission-control/business-health";
import { Recommendations } from "@/components/dashboard/home/recommendations";
import { SettleCard } from "@/components/shared/motion";
import { minutesSince } from "@/lib/dashboard-signals";
import { computeWaitStats, buildRecentActivity, type WaitStats, type ActivityEvent } from "@/lib/mission-control-signals";
import { groupForStatus } from "@/lib/conversations";
import { parseAvailability } from "@/lib/availability";
import { parseKnowledge } from "@/lib/knowledge";
import { getBrainContext, type BrainTopic as Topic } from "@/lib/brain";

export const metadata: Metadata = { title: "Mission Control — ReplyFlow" };

/**
 * Mission Control (Sprint 5) — the operational command centre. Answers
 * four questions: what needs attention, what's happening right now,
 * what's at risk, what should I do next. Every section reads from data
 * that already exists (conversations, jobs, the existing Brain's real
 * gaps) — nothing here is fabricated, no confidence value is invented,
 * and any section without a real fact to show renders honestly around
 * that (or not at all).
 *
 * Two sections are reused directly rather than rebuilt: `BusinessHealth`
 * and `Recommendations` already exist from Front Desk (Sprint 3) and
 * are equally honest, real-data-only components here — reuse before
 * building.
 */

/**
 * Domain-grouped result shape — deliberately structured close to what
 * a future `getBrainContext()` call could plausibly return (contributions
 * grouped by concern, never one flat bag of fields), so that when
 * Mission Control becomes the Shared Brain's second real caller
 * (Sprint 4A's recommended implementation order), only this function's
 * *internals* change — not the section components below, and not this
 * shape. lib/brain is intentionally NOT imported here yet (Sprint 5
 * constraint) — this is the seam it will slot into later, not a wiring
 * of it now.
 */
interface MissionControlData {
  operational: OperationalOverviewMetrics;
  urgent: UrgentItem[];
  activeConversations: ActiveConversationItem[];
  todaysJobs: TodaysJobItem[];
  waitStats: WaitStats;
  businessHealth: MissionControlHealthMetrics;
  recentActivity: ActivityEvent[];
  recommendations: Topic[];
}

async function getMissionControlData(supabase: SupabaseClient, businessId: string, now: Date): Promise<MissionControlData> {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    { data: conversations },
    { data: jobsToday },
    { data: recentCompletedJobs },
    { data: recentCreatedJobs },
    { data: draftJobs },
    { data: business },
    { data: config },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, customer_name, customer_phone, last_message_preview, last_message_at, status")
      .eq("business_id", businessId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from("jobs")
      .select("id, customer_name, job_title, status, scheduled_for")
      .eq("business_id", businessId)
      .gte("scheduled_for", startOfToday.toISOString())
      .lt("scheduled_for", endOfToday.toISOString())
      .order("scheduled_for", { ascending: true }),
    supabase
      .from("jobs")
      .select("id, customer_name, job_title, completed_at")
      .eq("business_id", businessId)
      .not("completed_at", "is", null)
      .gte("completed_at", sevenDaysAgo.toISOString())
      .order("completed_at", { ascending: false })
      .limit(5),
    supabase
      .from("jobs")
      .select("id, customer_name, job_title, created_at")
      .eq("business_id", businessId)
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("jobs")
      .select("id, customer_name, job_title, conversation_id")
      .eq("business_id", businessId)
      .eq("status", "draft"),
    supabase
      .from("businesses")
      .select("business_description, services, service_areas, business_knowledge, availability, opening_time, closing_time")
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("ai_configurations")
      .select("system_prompt, business_rules, escalation_rules, faqs")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  const allConversations = conversations ?? [];
  const waitingConversations = allConversations.filter((c) => groupForStatus(c.status) === "waiting" && c.last_message_at);
  const inProgressConversations = allConversations.filter((c) => groupForStatus(c.status) !== "done");

  const waitingCustomers = waitingConversations
    .map((c) => ({
      conversationId: c.id,
      name: c.customer_name || c.customer_phone,
      minutes: minutesSince(c.last_message_at as string),
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const drafts = draftJobs ?? [];

  const urgent: UrgentItem[] = [
    ...waitingCustomers.slice(0, 5).map(
      (w): UrgentItem => ({
        kind: "waiting_conversation",
        conversationId: w.conversationId,
        name: w.name,
        reason: "New enquiry",
        minutes: w.minutes,
      })
    ),
    ...drafts.map(
      (j): UrgentItem => ({
        kind: "draft_job",
        jobId: j.id,
        conversationId: j.conversation_id,
        jobTitle: j.job_title,
        customerName: j.customer_name,
      })
    ),
  ].slice(0, 5);

  const activeConversations: ActiveConversationItem[] = inProgressConversations.slice(0, 12).map((c) => ({
    id: c.id,
    name: c.customer_name || c.customer_phone,
    status: c.status,
    lastMessagePreview: c.last_message_preview,
  }));

  const todaysJobs: TodaysJobItem[] = (jobsToday ?? []).map((j) => ({
    id: j.id,
    customerName: j.customer_name,
    jobTitle: j.job_title,
    status: j.status,
    scheduledFor: j.scheduled_for,
  }));

  const completedToday = todaysJobs.filter((j) => j.status === "completed").length;

  const operational: OperationalOverviewMetrics = {
    waitingCount: waitingCustomers.length,
    jobsToday: todaysJobs.length,
    completedToday,
    openConversations: inProgressConversations.length,
  };

  const waitStats = computeWaitStats(waitingCustomers);

  // Deliberately distinct from `operational` above — where work
  // currently sits, not a repeat of the same three counts under a
  // different heading (see business-health.tsx's comment).
  const businessHealth: MissionControlHealthMetrics = {
    awaitingApproval: drafts.length,
    beingHandled: inProgressConversations.filter((c) => groupForStatus(c.status) === "active").length,
    bookedIn: inProgressConversations.filter((c) => groupForStatus(c.status) === "booked").length,
  };

  const recentActivity = buildRecentActivity({
    completedJobs: (recentCompletedJobs ?? []).map((j) => ({
      id: j.id,
      jobTitle: j.job_title,
      customerName: j.customer_name,
      completedAt: j.completed_at as string,
    })),
    createdJobs: (recentCreatedJobs ?? []).map((j) => ({
      id: j.id,
      jobTitle: j.job_title,
      customerName: j.customer_name,
      createdAt: j.created_at,
    })),
    newConversations: allConversations
      .filter((c) => new Date(c.last_message_at ?? 0) >= sevenDaysAgo)
      .slice(0, 5)
      .map((c) => ({ id: c.id, name: c.customer_name || c.customer_phone, createdAt: c.last_message_at as string })),
  });

  // Same shared reasoning model Front Desk reads from — real gaps,
  // not a second, independently-invented recommendation engine.
  // Sprint 6: reached through the Shared Brain contract (lib/brain),
  // same as Front Desk — this is the second real caller Sprint 4A's
  // migration order was waiting for.
  const availability = parseAvailability(business?.availability, business?.opening_time, business?.closing_time);
  const brain = getBrainContext({
    businessId,
    knowledge: {
      businessDescription: business?.business_description ?? null,
      services: business?.services ?? [],
      serviceAreas: business?.service_areas ?? [],
      knowledge: parseKnowledge(business?.business_knowledge),
      faqCount: Array.isArray(config?.faqs) ? (config.faqs as unknown[]).length : 0,
    },
    receptionist: {
      behavioursTaught: Boolean(config?.system_prompt?.trim()),
      rulesTaught: Boolean(config?.business_rules?.trim()),
      escalationTaught: Boolean(config?.escalation_rules?.trim()),
    },
    diary: { rules: availability.rules },
  });

  return {
    operational,
    urgent,
    activeConversations,
    todaysJobs,
    waitStats,
    businessHealth,
    recentActivity,
    recommendations: brain.gaps,
  };
}

/**
 * Sprint 7.6: Active Conversations and Today's Jobs used to each render
 * their own "nothing here yet" empty state independently, so a quiet
 * (but not entirely empty — e.g. some Recent Activity, or someone
 * waiting) day could show two near-identical reassurance boxes stacked
 * back to back. When both are genuinely empty at once, one honest
 * sentence replaces both. `showAlreadyCovered` is true only when
 * Operational Overview's own top-of-page reassurance already said this
 * — in that case neither section repeats it a third time.
 */
function NothingCurrentlyMoving({
  showAlreadyCovered,
  activeConversations,
  todaysJobs,
}: {
  showAlreadyCovered: boolean;
  activeConversations: ActiveConversationItem[];
  todaysJobs: TodaysJobItem[];
}) {
  const bothEmpty = activeConversations.length === 0 && todaysJobs.length === 0;

  if (bothEmpty && showAlreadyCovered) return null;

  if (bothEmpty) {
    return (
      <SettleCard delay={0.09} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[14px] font-semibold leading-snug">Nothing in progress, nothing scheduled today.</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              I&apos;ll show conversations and jobs here the moment either one exists.
            </p>
          </div>
        </div>
      </SettleCard>
    );
  }

  return (
    <>
      <ActiveConversations items={activeConversations} />
      <TodaysJobs items={todaysJobs} />
    </>
  );
}

export default async function MissionControlPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/welcome");
  if (!business.onboarding_completed) redirect("/welcome");

  const data = await getMissionControlData(supabase, business.id, new Date());

  return (
    <div className="mx-auto max-w-[1440px] space-y-7">
      <SettleCard>
        <h1 className="text-[26px] font-extrabold tracking-tight">Mission Control</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </SettleCard>

      <OperationalOverview {...data.operational} />
      <UrgentWork items={data.urgent} />
      <NothingCurrentlyMoving
        showAlreadyCovered={isOperationallyEmpty(data.operational)}
        activeConversations={data.activeConversations}
        todaysJobs={data.todaysJobs}
      />
      <WaitingCustomers stats={data.waitStats} />
      <MissionControlBusinessHealth {...data.businessHealth} />
      <RecentActivity events={data.recentActivity} />
      <Recommendations gaps={data.recommendations} />
    </div>
  );
}
