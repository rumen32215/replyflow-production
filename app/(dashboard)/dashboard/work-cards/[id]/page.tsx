import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CUSTOMER_MEDIA_BUCKET } from "@/lib/reply-engine/media-storage";
import { JOB_DOC_MEDIA_BUCKET } from "@/lib/job-docs/photo-storage";
import { fetchJobPhotos } from "@/lib/job-docs/job-evidence";
import { WorkCardDetail, type WorkCardPhoto, type WorkCardBooking } from "@/components/dashboard/work-cards/work-card-detail";
import { groupForStatus, type ConversationGroup } from "@/lib/conversations";
import { toConversationState } from "@/lib/reply-engine/understanding/state";
import { computeJobReadiness, simplifiedWorkCardStatus } from "@/lib/work-card-state";
import { buildCommunicationGuidance } from "@/lib/customer-memory-signals";

export const metadata: Metadata = { title: "Job — ReplyFlow" };

/**
 * The Job workspace — one screen, everything about one job (Plumber
 * Reset Phase 3 step 7). "Work Card" and "Job Record" no longer exist
 * as separate things a plumber has to reason about; this page absorbs
 * both. The test this page is built against: could a technician who
 * has never touched ReplyFlow walk out the door with only this screen
 * open and do the job competently?
 *
 * Photos are the Job's full, unified evidence (lib/job-docs/job-
 * evidence.ts) — WhatsApp photos and anything manually uploaded onto
 * the linked report, together, exactly what P3.8's data layer already
 * guarantees is scoped correctly (never another job's photos, never a
 * different customer's). Booking is the Job's real, real-conflict-
 * checked appointment (lib/booking/engine.ts) when one exists — a
 * proposed slot and a confirmed one are never shown the same way.
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
      "id, business_id, conversation_id, episode_id, customer_name, issue, status, estimated_value, scheduled_for, completed_at, notes, created_at, address, address_confirmed, collected_details, conversation_summary, approved_at, next_booking_id, report_status"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!workCard) notFound();

  const [{ data: conversation }, { data: episode }, { data: siblingCards }, { data: linkedJobDoc }, { data: bookingRow }] = await Promise.all([
    workCard.conversation_id
      ? supabase
          .from("conversations")
          .select("id, customer_phone, status, communication_preference")
          .eq("id", workCard.conversation_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // ReplyFlow V4 — this job's own Conversation State, not the
    // conversation's (Phase 3 stopped writing conversations.ai_state;
    // it's frozen pre-migration and would show a different job's
    // stale state here otherwise).
    workCard.episode_id
      ? supabase.from("conversation_episodes").select("ai_state").eq("id", workCard.episode_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Relationship context — other Jobs from the same conversation
    // thread, the same scoping `RelationshipOverview` already uses on
    // the Customer page. Deliberately conversation-wide, not
    // episode-wide — this is the customer's whole job history.
    workCard.conversation_id
      ? supabase
          .from("work_cards")
          .select("id, status")
          .eq("conversation_id", workCard.conversation_id)
          .neq("id", workCard.id)
      : Promise.resolve({ data: [] }),
    // The linked report (job_docs, Phase 3 step 6 — a thin envelope for
    // job_doc_fields/photos, never a second source of truth). At most
    // one, by the unique index on job_docs.work_card_id.
    supabase.from("job_docs").select("id, status").eq("work_card_id", workCard.id).maybeSingle(),
    // Plumber Reset Phase 3 step 7 — the Job's real, deterministically-
    // checked booking (lib/booking/engine.ts), when one exists. A
    // proposed slot and a confirmed one are never shown the same way
    // (see the Booking section in WorkCardDetail below).
    workCard.next_booking_id
      ? supabase.from("bookings").select("scheduled_start, scheduled_end, status").eq("id", workCard.next_booking_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Plumber Reset Phase 3 step 6/7 — the Job's full, unified evidence:
  // WhatsApp photos and anything manually uploaded onto the linked
  // report, together (lib/job-docs/job-evidence.ts). Scoped to this
  // Job's own episode/report id only — never another job's, never a
  // different customer's. Needs the service role: job_doc_photos is
  // write-service-role-only and both private buckets are signed below.
  const service = createServiceClient();
  const evidencePhotos = await fetchJobPhotos(service, { jobDocId: linkedJobDoc?.id ?? null, episodeId: workCard.episode_id });

  // Signed URLs, generated server-side with the service role — same
  // reasoning as the conversation detail page: the customer-media
  // bucket is private with no policy granted to `authenticated`, so
  // this only happens after the RLS-scoped work_cards select above
  // has already proven this signed-in owner owns this job.
  // Signed URLs, generated server-side with the service role — resolved
  // from whichever private bucket each photo's own source actually
  // lives in (WhatsApp photos: customer-media; manually-uploaded
  // report photos: job-doc-media). A pending (not-yet-analysed) photo
  // still gets a real URL — the image itself already exists even
  // before analysis has finished.
  const signedResults = await Promise.all(
    evidencePhotos.map((p) => {
      const bucket = p.source === "job_doc" ? JOB_DOC_MEDIA_BUCKET : CUSTOMER_MEDIA_BUCKET;
      return p.storage_path ? service.storage.from(bucket).createSignedUrl(p.storage_path, 3600) : Promise.resolve({ data: null });
    })
  );
  const workCardPhotos: WorkCardPhoto[] = evidencePhotos.map((p, i) => ({
    id: p.id,
    url: signedResults[i]?.data?.signedUrl ?? null,
    visibleSummary: p.visible_summary,
    possibleSummary: p.possible_summary,
    unknownNote: p.unknown_note,
    confidence: p.analysis_confidence,
    // Honest analysis state (Phase 3 step 6/7) — a photo that's still
    // being analysed (or whose analysis failed) is shown as such,
    // never silently omitted until a refresh happens to catch it.
    analyzed: Boolean(p.analyzed_at),
  }));

  const conversationState = episode ? toConversationState(episode.ai_state) : null;
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
    hasAnalysedPhoto: workCardPhotos.some((p) => p.analyzed),
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

  const booking: WorkCardBooking | null = bookingRow
    ? { start: bookingRow.scheduled_start, end: bookingRow.scheduled_end, status: bookingRow.status }
    : null;

  return (
    <WorkCardDetail
      // Plumber Reset Phase 3 step 7 — the same real bug already found
      // and fixed once on the report editor (reports/[id]/page.tsx):
      // this is a Client Component with its own internal useState(card)
      // seeded from the `workCard` prop. Without a key tied to the
      // Job's own id, navigating directly from one Job to another can
      // reuse the same component instance and leave the previous Job's
      // customer/photos/booking on screen until something else forces
      // a re-render. A genuine remount per Job makes that structurally
      // impossible, not just unlikely.
      key={workCard.id}
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
      linkedJobDocId={linkedJobDoc?.id ?? null}
      linkedJobDocStatus={linkedJobDoc?.status ?? null}
      booking={booking}
      reportStatus={workCard.report_status}
    />
  );
}
