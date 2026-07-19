import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RelationshipOverview } from "@/components/dashboard/customers/relationship-overview";
import { RelationshipTimeline } from "@/components/dashboard/customers/relationship-timeline";
import { AIInsightsPanel } from "@/components/dashboard/customers/ai-insights-panel";
import { statusLabel, groupForStatus } from "@/lib/conversations";
import { minutesSince } from "@/lib/dashboard-signals";
import {
  relationshipStrengthFor,
  computeProfileConfidence,
  buildRelationshipTimeline,
  buildRelationshipSummary,
  buildSuggestedActions,
  type CustomerJob,
} from "@/lib/customer-memory-signals";
import { getBrainContext } from "@/lib/brain";
import { parseKnowledge } from "@/lib/knowledge";
import { parseAvailability } from "@/lib/availability";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Customer — ReplyFlow" };

/**
 * The relationship workspace for one customer (Feature 12). Every
 * fact rendered here — the summary, the timeline, the strength label,
 * the suggestions — traces back to a real `conversations`/`jobs` row
 * already fetched below. Nothing is inferred from message content or
 * predicted from a service interval this data doesn't contain.
 */
export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, business_id, customer_name, customer_phone, status, last_message_at, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!conversation) notFound();

  const [{ data: jobRows }, { data: business }, { data: config }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_title, status, scheduled_for, completed_at, notes, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("businesses")
      .select("business_description, services, service_areas, business_knowledge, availability, opening_time, closing_time")
      .eq("id", conversation.business_id)
      .maybeSingle(),
    supabase
      .from("ai_configurations")
      .select("system_prompt, business_rules, escalation_rules, faqs")
      .eq("business_id", conversation.business_id)
      .maybeSingle(),
  ]);

  const jobs: CustomerJob[] = (jobRows ?? []).map((j) => ({
    id: j.id,
    jobTitle: j.job_title,
    status: j.status,
    scheduledFor: j.scheduled_for,
    completedAt: j.completed_at,
    notes: j.notes,
    createdAt: j.created_at,
  }));

  const name = conversation.customer_name || conversation.customer_phone;
  const completedJobCount = jobs.filter((j) => j.status === "completed").length;
  const mostRecentJob = [...jobs].filter((j) => j.status === "completed").sort(
    (a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime()
  )[0] ?? null;
  const draftJob = jobs.find((j) => j.status === "draft") ?? null;
  const upcomingJob = jobs.find(
    (j) => j.status === "booked" && j.scheduledFor && new Date(j.scheduledFor) >= new Date()
  ) ?? null;

  const isWaiting = groupForStatus(conversation.status) === "waiting" && Boolean(conversation.last_message_at);
  const waitingMinutes = isWaiting ? minutesSince(conversation.last_message_at as string) : null;

  const mostRecentActivityAt = [conversation.last_message_at, mostRecentJob?.completedAt, conversation.created_at]
    .filter((d): d is string => Boolean(d))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const monthsSinceLastActivity = mostRecentActivityAt
    ? Math.floor((Date.now() - new Date(mostRecentActivityAt).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : null;

  const strength = relationshipStrengthFor(completedJobCount);
  const confidence = computeProfileConfidence({
    hasName: Boolean(conversation.customer_name),
    jobCount: jobs.length,
    hasAnyNotes: jobs.some((j) => j.notes?.trim()),
  });

  const summary = buildRelationshipSummary({
    name,
    conversationStartedAt: conversation.created_at,
    completedJobCount,
    mostRecentJob,
    waitingMinutes,
  });

  const timeline = buildRelationshipTimeline({ conversationStartedAt: conversation.created_at, jobs });

  const suggestedActions = buildSuggestedActions({
    conversationId: conversation.id,
    name,
    waitingMinutes,
    draftJob: draftJob ? { id: draftJob.id, jobTitle: draftJob.jobTitle } : null,
    upcomingJob: upcomingJob ? { jobTitle: upcomingJob.jobTitle, scheduledFor: upcomingJob.scheduledFor as string } : null,
    monthsSinceLastActivity,
    completedJobCount,
  });

  // The business's own real Shared Brain — reused exactly as Front
  // Desk and Mission Control already consume it (Sprint 6), not a new
  // capability. Only its receptionist-domain gap is relevant to "how
  // well can I serve this customer," so that's the only part shown.
  const availability = parseAvailability(business?.availability, business?.opening_time, business?.closing_time);
  const brain = getBrainContext({
    businessId: conversation.business_id,
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
  const receptionistGap = brain.gaps.find((g) => g.domain === "receptionist") ?? null;
  const businessContextNote = receptionistGap
    ? `I still don't know ${receptionistGap.label} — that could affect how confidently I handle requests from ${name}.`
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-5 py-3.5">
        <Link
          href="/dashboard/customers"
          aria-label="Back to all customers"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
        >
          <ChevronLeft className="h-[18px] w-[18px]" />
        </Link>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-primary">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold">{name}</p>
          <p className="truncate text-[12px] text-muted-foreground">{conversation.customer_phone}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            groupForStatus(conversation.status) === "waiting" && "border-attention/25 bg-attention/10 text-attention",
            groupForStatus(conversation.status) === "active" && "border-primary/20 bg-accent text-primary",
            groupForStatus(conversation.status) === "booked" && "border-success/25 bg-success/10 text-success",
            groupForStatus(conversation.status) === "done" && "border-border bg-muted text-muted-foreground"
          )}
        >
          {statusLabel(conversation.status)}
        </span>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-5 p-5 lg:grid-cols-[1fr_320px] lg:p-6">
        <div className="space-y-5">
          <RelationshipOverview summary={summary} completedJobCount={completedJobCount} jobs={jobs} />
          <RelationshipTimeline events={timeline} />
        </div>
        <AIInsightsPanel
          strength={strength}
          confidenceLabel={confidence.label}
          businessContextNote={businessContextNote}
          suggestedActions={suggestedActions}
        />
      </div>
    </div>
  );
}
