import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  GreetingCard,
  TodaysPriorityCard,
  AISummaryCard,
  UrgentItems,
  TodaysDiary,
  SetupJourney,
  type JourneyStep,
  type UrgentItem,
  type RightNowJob,
} from "@/components/dashboard/home/home-experience";
import { QuickActions } from "@/components/dashboard/home/quick-actions";
import { Recommendations } from "@/components/dashboard/home/recommendations";
import { BusinessHealth } from "@/components/dashboard/home/business-health";
import { RecentLearning } from "@/components/dashboard/home/whats-on-my-mind";
import { minutesSince, buildPresenceLine, buildDailySummaryBullets } from "@/lib/dashboard-signals";
import { parseAvailability } from "@/lib/availability";
import { parseKnowledge } from "@/lib/knowledge";
import { getBrainContext, selectTodaysPriority } from "@/lib/brain";

export const metadata: Metadata = { title: "Front Desk — ReplyFlow" };

/**
 * Front Desk (Sprint 3 rebuild) — the canonical hierarchy from Feature
 * 01: Greeting -> Today's Priority -> AI Summary -> Urgent Items ->
 * Today's Diary -> Recommendations -> Business Health -> Recent
 * Learning -> Quick Actions. A brand-new business sees the
 * getting-started state instead of the steady-state sections — it
 * meets its next step, never an empty dashboard. Every section reads
 * from data already fetched here; nothing is invented, and any
 * section with nothing true to say simply doesn't render.
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
      "id, business_name, logo_url, whatsapp_connected, availability, opening_time, closing_time, business_description, services, service_areas, business_knowledge"
    )
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/welcome");

  const businessId = business.id;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const now = new Date();

  const [
    { data: waitingConversations },
    { count: conversationCount },
    { data: todaysJobs },
    { data: nextUpcomingJobs },
    { count: completedEver },
    { data: config },
  ] = await Promise.all([
    // Waiting for Owner — the highest-priority state in the product.
    // 'open' is the legacy status and reads as "waiting" until real
    // receptionist replies exist.
    supabase
      .from("conversations")
      .select("id, customer_name, customer_phone, last_message_preview, last_message_at, status")
      .eq("business_id", businessId)
      .in("status", ["waiting_owner", "open", "new"])
      .order("last_message_at", { ascending: true })
      .limit(5),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("work_cards")
      .select("id, customer_name, issue, status, scheduled_for, notes")
      .eq("business_id", businessId)
      .in("status", ["booked", "in_progress", "completed"])
      .gte("scheduled_for", startOfToday.toISOString())
      .lt("scheduled_for", endOfToday.toISOString())
      .order("scheduled_for", { ascending: true }),
    supabase
      .from("work_cards")
      .select("id, customer_name, issue, scheduled_for, notes")
      .eq("business_id", businessId)
      .eq("status", "booked")
      .gte("scheduled_for", endOfToday.toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(1),
    supabase
      .from("work_cards")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "completed"),
    supabase
      .from("ai_configurations")
      .select("tone_notes, system_prompt, business_rules, escalation_rules, faqs")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  const needsYou: UrgentItem[] = (waitingConversations ?? [])
    .filter((c) => c.last_message_at)
    .map((c) => ({
      conversationId: c.id,
      name: c.customer_name || c.customer_phone,
      reason: c.last_message_preview || "New enquiry",
      minutes: minutesSince(c.last_message_at as string),
    }));

  const jobsToday = todaysJobs ?? [];
  const inProgress = jobsToday.find((j) => j.status === "in_progress");
  const nextTodayBooked = jobsToday.find(
    (j) => j.status === "booked" && j.scheduled_for && new Date(j.scheduled_for) >= now
  );
  const currentSource = inProgress ?? nextTodayBooked ?? null;

  const rightNow: RightNowJob | null = currentSource
    ? {
        id: currentSource.id,
        customerName: currentSource.customer_name,
        jobTitle: currentSource.issue,
        scheduledFor: currentSource.scheduled_for,
        notes: currentSource.notes,
        isCurrent: Boolean(inProgress),
      }
    : null;

  // Up Next = the next meaningful commitment after Right Now — never
  // the full diary (Home Experience V2).
  const upNextSource =
    jobsToday.find(
      (j) =>
        j.status === "booked" &&
        j.scheduled_for &&
        new Date(j.scheduled_for) >= now &&
        j.id !== currentSource?.id
    ) ?? nextUpcomingJobs?.[0] ?? null;

  const upNext: RightNowJob | null = upNextSource
    ? {
        id: upNextSource.id,
        customerName: upNextSource.customer_name,
        jobTitle: upNextSource.issue,
        scheduledFor: upNextSource.scheduled_for,
        notes: upNextSource.notes ?? null,
        isCurrent: false,
      }
    : null;

  const completedToday = jobsToday.filter((j) => j.status === "completed").length;
  const remainingToday = jobsToday.filter(
    (j) => j.status !== "completed" && j.scheduled_for && new Date(j.scheduled_for) >= now
  ).length;

  const whatsappConnected = business.whatsapp_connected ?? false;
  const noActivityYet = (conversationCount ?? 0) === 0 && (completedEver ?? 0) === 0;

  const availability = parseAvailability(business.availability, business.opening_time, business.closing_time);

  const oldestWaiting = needsYou[0] ?? null;
  const presenceLine = buildPresenceLine({
    isNewBusiness: noActivityYet,
    waitingCount: needsYou.length,
    waitingCustomer: oldestWaiting ? { name: oldestWaiting.name, minutes: oldestWaiting.minutes } : null,
    jobsBookedToday: jobsToday.length,
  });
  // Nothing specific to report — safe to gently rotate through calm,
  // reassuring variants instead of one static line (never when there's
  // a real fact to state, like someone waiting or a job booked).
  const rotateCalm = !oldestWaiting && jobsToday.length === 0;

  // The one shared reasoning model every screen reads from — replaces
  // what used to be three independently-computed "how ready is she"
  // signals (Business Knowledge's own score, an ad hoc receptionist
  // percent, and a 50/50 average of the two). Front Desk is the one
  // page with real activity data to hand, so it's the only caller
  // that populates `activity` — that's what lets `thoughts.watching`/
  // `thoughts.handled` reflect what's actually happening right now,
  // not just what's been taught. Sprint 6: now reached through the
  // Shared Brain contract (lib/brain) instead of calling buildBrain()
  // directly — same reasoning, same result shape, one public entry
  // point shared with Mission Control.
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
      waitingCount: needsYou.length,
      oldestWaitingName: oldestWaiting?.name ?? null,
      oldestWaitingMinutes: oldestWaiting?.minutes ?? null,
      completedToday,
      bookedToday: jobsToday.length,
    },
  });
  // Sprint 8.8 — the setup journey. Three real, already-computed
  // signals (never a fabricated "readiness score"): Business Profile
  // and Receptionist are each "done" the same way the rest of the
  // product already defines complete (100% of that Shared Brain
  // domain); WhatsApp is done the same way it's always been checked.
  // Business Profile before Receptionist before WhatsApp is a
  // suggested reading order, not an enforced gate — every step link
  // works regardless of order, and completion is entirely signal-driven.
  const journeySteps: JourneyStep[] = [
    { id: "business", label: "Business Profile", done: brain.percentFor("knowledge") >= 100, href: "/dashboard/business" },
    { id: "receptionist", label: "Receptionist", done: brain.percentFor("receptionist") >= 100, href: "/dashboard/receptionist" },
    { id: "whatsapp", label: "Connect WhatsApp", done: whatsappConnected, href: "/dashboard/whatsapp" },
  ];
  const journeyComplete = journeySteps.every((s) => s.done);

  // Section 2 — exactly one priority, chosen by a fixed, honest
  // precedence over the same real facts above (see selectTodaysPriority).
  const currentJobForPriority = rightNow?.isCurrent
    ? { title: rightNow.jobTitle, customerName: rightNow.customerName }
    : null;
  const nextJobForPriority =
    rightNow && !rightNow.isCurrent
      ? { title: rightNow.jobTitle, customerName: rightNow.customerName, scheduledFor: rightNow.scheduledFor }
      : upNext
        ? { title: upNext.jobTitle, customerName: upNext.customerName, scheduledFor: upNext.scheduledFor }
        : null;
  const todaysPriority = selectTodaysPriority({
    waitingCustomer: oldestWaiting
      ? { name: oldestWaiting.name, minutes: oldestWaiting.minutes, conversationId: oldestWaiting.conversationId }
      : null,
    waitingCount: needsYou.length,
    currentJob: currentJobForPriority,
    nextJob: nextJobForPriority,
    jobsBookedToday: jobsToday.length,
  });

  // Section 3 — up to four real facts, never filler.
  const summaryBullets = buildDailySummaryBullets({
    waitingCount: needsYou.length,
    completedToday,
    bookedToday: jobsToday.length,
    topGapLabel: brain.gaps[0]?.label ?? null,
  });

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Sprint 8.8 — Front Desk is now a guide, not a static dashboard:
       * until the three setup steps are all real, it shows the journey
       * instead of pretending there's a normal operational day to
       * summarise. Sprint 7.6's "Greeting and Priority sit close
       * together" arrival beat still holds once the journey is done. */}
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

      {journeyComplete && (
        <div className="space-y-6">
          <AISummaryCard bullets={summaryBullets} />
          <UrgentItems items={needsYou} />
          <TodaysDiary
            rightNow={rightNow}
            allCaughtUp={needsYou.length === 0}
            upNext={upNext}
            completed={completedToday}
            waiting={needsYou.length}
            remaining={remainingToday}
          />
          <Recommendations gaps={brain.gaps} />
          <BusinessHealth jobsToday={jobsToday.length} completedToday={completedToday} waitingCount={needsYou.length} />
          <RecentLearning observations={brain.observations} />
        </div>
      )}

      {/* A deliberate extra beat of air before the closing action zone. */}
      <div className="pt-2">
        <QuickActions businessId={businessId} initialAvailability={availability} />
      </div>
    </div>
  );
}
