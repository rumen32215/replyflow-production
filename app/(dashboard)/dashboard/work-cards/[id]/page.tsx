import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CUSTOMER_MEDIA_BUCKET } from "@/lib/reply-engine/media-storage";
import { WorkCardDetail, type WorkCardPhoto } from "@/components/dashboard/work-cards/work-card-detail";
import { groupForStatus, type ConversationGroup } from "@/lib/conversations";
import { toConversationState } from "@/lib/reply-engine/understanding/state";
import { computeJobReadiness, simplifiedWorkCardStatus } from "@/lib/work-card-state";
import { buildCommunicationGuidance } from "@/lib/customer-memory-signals";

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
 * ReplyFlow V2 (2026-08-11) — Photos section restored: `conversation_
 * photos` (0024_customer_photos.sql) exists and is real, populated
 * output the receptionist already gathers; the comment this replaced
 * predates that table and was simply never updated. Same signed-URL
 * pattern the conversation detail page already uses (private bucket,
 * RLS-scoped ownership already proven by the work_cards select below,
 * service-role signed URL generated only after that).
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

  const [{ data: conversation }, { data: siblingCards }, { data: conversationPhotos }] = await Promise.all([
    workCard.conversation_id
      ? supabase
          .from("conversations")
          .select("id, customer_phone, status, ai_state, communication_preference")
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
    // ReplyFlow V2 — the same already-analysed photo output the
    // conversation detail page reads, surfaced here too so the owner
    // never has to leave the Work Card to see what was already found.
    workCard.conversation_id
      ? supabase
          .from("conversation_photos")
          .select("message_id, storage_path, visible_summary, possible_summary, unknown_note, analysis_confidence, created_at")
          .eq("conversation_id", workCard.conversation_id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  // Signed URLs, generated server-side with the service role — same
  // reasoning as the conversation detail page: the customer-media
  // bucket is private with no policy granted to `authenticated`, so
  // this only happens after the RLS-scoped work_cards select above
  // has already proven this signed-in owner owns this job.
  const photos = conversationPhotos ?? [];
  const photoSignedUrlById = new Map<string, string>();
  if (photos.length > 0) {
    const service = createServiceClient();
    const signedResults = await Promise.all(
      photos.map((p) => service.storage.from(CUSTOMER_MEDIA_BUCKET).createSignedUrl(p.storage_path, 3600))
    );
    photos.forEach((p, i) => {
      const url = signedResults[i]?.data?.signedUrl;
      if (url) photoSignedUrlById.set(p.message_id, url);
    });
  }
  const workCardPhotos: WorkCardPhoto[] = photos.map((p) => ({
    id: p.message_id,
    url: photoSignedUrlById.get(p.message_id) ?? null,
    visibleSummary: p.visible_summary,
    possibleSummary: p.possible_summary,
    unknownNote: p.unknown_note,
    confidence: p.analysis_confidence as "low" | "medium" | "high",
  }));

  const conversationState = conversation ? toConversationState(conversation.ai_state) : null;
  const isEmergency = Boolean(
    conversationState &&
      conversationState.goal.type === "handle_emergency" &&
      conversationState.goal.status !== "completed" &&
      conversationState.goal.status !== "abandoned"
  );
  const conversationGroup: ConversationGroup | null = conversation ? groupForStatus(conversation.status) : null;

  // ReplyFlow V2 — the plain five-stage lifecycle (§ simplifiedWorkCardStatus),
  // computed from the same real readiness check Front Desk's Ready to
  // Quote uses — never a second, disagreeing notion of "ready."
  const readiness = computeJobReadiness({
    issue: workCard.issue,
    address: workCard.address,
    conversationState,
    hasAnalysedPhoto: workCardPhotos.length > 0,
  });
  const simplifiedStatus = simplifiedWorkCardStatus(workCard.status, readiness);

  const completedSiblingCount = (siblingCards ?? []).filter((c) => c.status === "completed").length;

  // "Surface, don't build" — the exact same, already-built function the
  // conversation view uses (lib/customer-memory-signals.ts), reused
  // unchanged: this page has its own direct `tel:` call link with the
  // identical blind spot the conversation view had before it.
  const communicationGuidance = buildCommunicationGuidance(
    workCard.customer_name,
    conversation?.communication_preference ?? null
  );

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
      communicationGuidance={communicationGuidance}
      photos={workCardPhotos}
      simplifiedStatus={simplifiedStatus}
    />
  );
}
