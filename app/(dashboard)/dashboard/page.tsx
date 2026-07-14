import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BeforeYouArrived, buildOvernightLines } from "@/components/dashboard/before-you-arrived";
import { TodaysFocus, pickFocus } from "@/components/dashboard/todays-focus";
import { MorningBrief } from "@/components/dashboard/morning-brief";
import { JumpIn } from "@/components/dashboard/jump-in";
import { WaitingForYou, type WaitingCustomer } from "@/components/dashboard/waiting-for-you";
import { GoodNews } from "@/components/dashboard/good-news";
import { minutesSince, buildMorningBrief, estimateMinutesSaved } from "@/lib/dashboard-signals";

export const metadata: Metadata = { title: "Dashboard — ReplyFlow" };

const WAITING_THRESHOLD_MINUTES = 15;

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, business_name, whatsapp_connected")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/welcome");

  const businessId = business.id;
  const whatsappConnected = business.whatsapp_connected ?? false;

  const { data: aiConfig } = await supabase
    .from("ai_configurations")
    .select("system_prompt")
    .eq("business_id", businessId)
    .maybeSingle();
  const aiConfigured = Boolean(aiConfig?.system_prompt && aiConfig.system_prompt.trim().length > 0);

  // "Overnight" = since 6am today, server time. A fixed window rather
  // than "since last visit" — simpler, not gameable by refreshing, and
  // matches how a person actually thinks about "overnight."
  const overnightStart = new Date();
  overnightStart.setHours(6, 0, 0, 0);
  const overnightStartIso = overnightStart.toISOString();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayIso = startOfToday.toISOString();

  const [
    { count: newEnquiriesOvernight },
    { count: photosOvernight },
    { count: quotesAcceptedOvernight },
    { count: jobsBookedOvernight },
    { data: openConversations },
    { data: pendingBookingJobs },
    { count: enquiriesToday },
    { data: wonJobsToday },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", overnightStartIso),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .neq("message_type", "text")
      .gte("created_at", overnightStartIso),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "quote_accepted")
      .gte("updated_at", overnightStartIso),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "booked")
      .gte("updated_at", overnightStartIso),
    // Open conversations, oldest first — today's "customer's turn"
    // heuristic is simply status = 'open'. There's no message-sending
    // feature yet, so every conversation with a reply is still
    // functionally waiting on a human; once sending exists, this
    // should switch to checking the latest message's direction instead.
    supabase
      .from("conversations")
      .select("id, customer_name, customer_phone, last_message_preview, last_message_at")
      .eq("business_id", businessId)
      .eq("status", "open")
      .order("last_message_at", { ascending: true }),
    supabase
      .from("jobs")
      .select("id, customer_name, job_title")
      .eq("business_id", businessId)
      .eq("status", "quote_accepted")
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", startOfTodayIso),
    supabase
      .from("jobs")
      .select("estimated_value")
      .eq("business_id", businessId)
      .in("status", ["quote_accepted", "booked", "completed"])
      .gte("updated_at", startOfTodayIso),
  ]);

  const waitingCustomers: WaitingCustomer[] = (openConversations ?? [])
    .filter((c) => c.last_message_at) // a conversation with no message yet isn't meaningfully "waiting"
    .map((c) => ({
      conversationId: c.id,
      name: c.customer_name || c.customer_phone,
      reason: c.last_message_preview || "New enquiry",
      minutes: minutesSince(c.last_message_at as string),
    }));

  const oldestWaiting = waitingCustomers[0]
    ? { name: waitingCustomers[0].name, minutes: waitingCustomers[0].minutes, conversationId: waitingCustomers[0].conversationId }
    : null;

  const pendingBookingJob = pendingBookingJobs?.[0]
    ? { name: pendingBookingJobs[0].customer_name, jobTitle: pendingBookingJobs[0].job_title }
    : null;

  const focus = pickFocus({
    whatsappConnected,
    aiConfigured,
    oldestWaiting,
    pendingBooking: pendingBookingJob,
    waitingThresholdMinutes: WAITING_THRESHOLD_MINUTES,
  });

  const overnightLines = buildOvernightLines({
    newEnquiries: newEnquiriesOvernight ?? 0,
    photos: photosOvernight ?? 0,
    quotesAccepted: quotesAcceptedOvernight ?? 0,
    jobsBooked: jobsBookedOvernight ?? 0,
    needsReply: waitingCustomers.length,
  });

  const briefText = buildMorningBrief({
    enquiriesToday: enquiriesToday ?? 0,
    jobsBookedToday: jobsBookedOvernight ?? 0,
    waitingCustomer: oldestWaiting ? { name: oldestWaiting.name, minutes: oldestWaiting.minutes } : null,
  });

  const potentialWorkWon = (wonJobsToday ?? []).reduce((sum, job) => sum + (job.estimated_value ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight">Good morning, {business.business_name} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-GB", { weekday: "long" })} •{" "}
          {new Date().toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}
        </p>
      </div>

      <BeforeYouArrived lines={overnightLines} />
      <TodaysFocus focus={focus} />
      <MorningBrief text={briefText} />
      <JumpIn />
      <WaitingForYou customers={waitingCustomers} />
      <GoodNews
        enquiriesToday={enquiriesToday ?? 0}
        potentialWorkWon={potentialWorkWon}
        estimatedMinutesSaved={estimateMinutesSaved(enquiriesToday ?? 0)}
      />
    </div>
  );
}
