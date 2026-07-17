import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  HomeGreeting,
  RightNowCard,
  NeedsYou,
  UpNext,
  TodaysProgress,
  ReadyStatus,
  SetupProgress,
  type NeedsYouItem,
  type RightNowJob,
} from "@/components/dashboard/home/home-experience";
import { FastLane, ConnectWhatsAppBanner } from "@/components/dashboard/home/fast-lane";
import { SettleCard } from "@/components/shared/motion";
import { minutesSince, buildPresenceLine } from "@/lib/dashboard-signals";
import { parseAvailability, standingForDate, describeStanding } from "@/lib/availability";
import { parseKnowledge, understandingScore } from "@/lib/knowledge";

export const metadata: Metadata = { title: "Front Desk — ReplyFlow" };

/**
 * Front Desk (ReplyFlow V3) — the moment the app is opened, she's
 * there: one honest line about right now, and a fast lane so nothing
 * routine or urgent ever waits on a conversation with her. The page
 * still grows with the business (Dashboard States V1): a brand-new
 * business sees the getting-started checklist; a working business
 * sees Right Now / Needs You / Up Next / Today's Progress beneath the
 * fast lane. Cards with nothing useful to say simply don't render —
 * never empty widgets.
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
      "id, business_name, whatsapp_connected, availability, opening_time, closing_time, business_description, services, service_areas, business_knowledge"
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
      .from("jobs")
      .select("id, customer_name, job_title, status, scheduled_for, notes")
      .eq("business_id", businessId)
      .in("status", ["booked", "in_progress", "completed"])
      .gte("scheduled_for", startOfToday.toISOString())
      .lt("scheduled_for", endOfToday.toISOString())
      .order("scheduled_for", { ascending: true }),
    supabase
      .from("jobs")
      .select("id, customer_name, job_title, scheduled_for, notes")
      .eq("business_id", businessId)
      .eq("status", "booked")
      .gte("scheduled_for", endOfToday.toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(1),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "completed"),
    supabase
      .from("ai_configurations")
      .select("tone_notes, system_prompt, business_rules, escalation_rules, faqs")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  const needsYou: NeedsYouItem[] = (waitingConversations ?? [])
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
        jobTitle: currentSource.job_title,
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
        jobTitle: upNextSource.job_title,
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

  // State 1 (Dashboard States V1): a brand-new business never meets an
  // empty dashboard — it meets its next step.
  const isNewBusiness = !whatsappConnected || (conversationCount ?? 0) === 0 || (completedEver ?? 0) === 0;
  const showChecklist = isNewBusiness && needsYou.length === 0 && jobsToday.length === 0;

  // How ready is she, overall — Business Knowledge's existing
  // understanding score, averaged with whether she's actually been
  // taught how to speak (tone notes, behaviours, rules, escalation).
  // Purely a progress narrative: it never disables or hides the real
  // Connect WhatsApp step below, which stays fully usable regardless.
  const knowledgeScore = understandingScore({
    businessDescription: business.business_description,
    services: business.services ?? [],
    serviceAreas: business.service_areas ?? [],
    knowledge: parseKnowledge(business.business_knowledge),
    faqCount: Array.isArray(config?.faqs) ? (config.faqs as unknown[]).length : 0,
  });
  const taughtSignals = [
    Boolean(config?.tone_notes?.trim()),
    Boolean(config?.system_prompt?.trim()),
    Boolean(config?.business_rules?.trim()),
    Boolean(config?.escalation_rules?.trim()),
  ];
  const receptionistPercent = Math.round(
    (taughtSignals.filter(Boolean).length / taughtSignals.length) * 100
  );
  const setupPercent = Math.round((knowledgeScore.percent + receptionistPercent) / 2);
  const showSetupProgress = !whatsappConnected && !showChecklist && setupPercent >= 40;

  const availability = parseAvailability(business.availability, business.opening_time, business.closing_time);
  const todayStanding = describeStanding(standingForDate(availability, now));
  const diaryLine =
    todayStanding === "Closed" || todayStanding === "Fully booked"
      ? todayStanding === "Closed"
        ? "Closed today — enjoy the day off."
        : "Fully booked today."
      : `Open ${todayStanding} today.`;

  const oldestWaiting = needsYou[0] ?? null;
  const presenceLine = buildPresenceLine({
    isNewBusiness: showChecklist,
    waitingCount: needsYou.length,
    waitingCustomer: oldestWaiting ? { name: oldestWaiting.name, minutes: oldestWaiting.minutes } : null,
    jobsBookedToday: jobsToday.length,
  });
  // Nothing specific to report — safe to gently rotate through calm,
  // reassuring variants instead of one static line (never when there's
  // a real fact to state, like someone waiting or a job booked).
  const rotateCalm = !oldestWaiting && jobsToday.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SettleCard className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <HomeGreeting
          name={business.business_name}
          supportLine={presenceLine}
          rotateCalm={rotateCalm}
          whatsappConnected={whatsappConnected}
          topGap={knowledgeScore.missing[0] ?? null}
        />
        <div className="my-4 h-px bg-border/70" />
        <FastLane
          businessId={businessId}
          waitingCount={needsYou.length}
          diaryLine={diaryLine}
          initialAvailability={availability}
        />
      </SettleCard>

      {showSetupProgress && <SetupProgress percent={setupPercent} />}
      {!whatsappConnected && <ConnectWhatsAppBanner />}

      {showChecklist ? (
        <ReadyStatus state={{ whatsappConnected }} />
      ) : (
        <>
          <RightNowCard job={rightNow} allCaughtUp={needsYou.length === 0} />
          <NeedsYou items={needsYou} />
          <UpNext job={upNext} />
          <TodaysProgress completed={completedToday} waiting={needsYou.length} remaining={remainingToday} />
        </>
      )}
    </div>
  );
}
