import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { buildJobDocSeedFromWorkCard } from "@/lib/job-docs/from-work-card";
import { RAW_NOTES_FIELD_KEY, SECTION } from "@/lib/job-docs/fields";
import { CUSTOMER_MEDIA_BUCKET, downloadCustomerMedia } from "@/lib/reply-engine/media-storage";
import { storeJobDocPhoto } from "@/lib/job-docs/photo-storage";

export const runtime = "nodejs";

/**
 * ReplyFlow V4 — the Work Card → Job Record link
 * (0030_link_job_docs_to_work_cards.sql). Create-or-fetch: a completed
 * Work Card gets exactly one linked Job Record. Everything the
 * conversation already gathered — customer, address, issue, collected
 * details, analysed photos — flows in here so the owner never retypes
 * it; this is the one thing that closes the V4 audit's central gap.
 *
 * A server route (like app/api/job-docs/route.ts) for the same reason:
 * job_doc_fields is SELECT-only for `authenticated`, and copying a
 * customer's photo between two private storage buckets needs the
 * service role on both ends.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();

  const { data: workCard } = await service
    .from("work_cards")
    .select(
      "id, business_id, conversation_id, customer_name, issue, address, collected_details, conversation_summary, notes, scheduled_for, completed_at"
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!workCard) return NextResponse.json({ error: "Work Card not found" }, { status: 404 });

  const { data: business } = await service.from("businesses").select("id, owner_id").eq("id", workCard.business_id).maybeSingle();
  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // One Job Record per Work Card (job_docs_work_card_id_key, 0030) —
  // if it already exists, this is just a fetch, never a second one.
  const { data: existing } = await service.from("job_docs").select("id").eq("work_card_id", workCard.id).maybeSingle();
  if (existing) return NextResponse.json({ id: existing.id, created: false });

  const { data: conversation } = workCard.conversation_id
    ? await service.from("conversations").select("customer_phone").eq("id", workCard.conversation_id).maybeSingle()
    : { data: null };

  const seed = buildJobDocSeedFromWorkCard({
    customerName: workCard.customer_name,
    issue: workCard.issue,
    address: workCard.address,
    conversationSummary: workCard.conversation_summary,
    collectedDetails: workCard.collected_details,
    notes: workCard.notes,
    scheduledFor: workCard.scheduled_for,
    completedAt: workCard.completed_at,
  });

  let jobDocId: string;
  try {
    const { data: jobDoc, error: insertError } = await service
      .from("job_docs")
      .insert({
        business_id: business.id,
        created_by: user.id,
        conversation_id: workCard.conversation_id,
        work_card_id: workCard.id,
        title: seed.title,
        customer_name: seed.customerName,
        customer_phone: conversation?.customer_phone ?? null,
        job_address: seed.jobAddress,
        job_date: seed.jobDate,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    if (!jobDoc) throw new Error("Insert returned no row");
    jobDocId = jobDoc.id;

    const { error: fieldError } = await service.from("job_doc_fields").insert({
      job_doc_id: jobDocId,
      business_id: business.id,
      section_label: SECTION.intake,
      sort_order: 0,
      field_key: RAW_NOTES_FIELD_KEY,
      field_value: seed.rawNotes,
      // Not user_fact — nobody typed this directly into the intake form
      // — but not a guess either: it's real conversation_summary/
      // collected_details/notes already grounded in the Work Card.
      provenance: "ai_structured",
      confidence: "medium",
      updated_by: "ai",
    });
    if (fieldError) throw fieldError;
  } catch (err) {
    console.error("[work-cards] job-doc create failed:", err);
    await recordErrorEvent({
      severity: "error",
      source: "work-cards.job_doc_create_failed",
      businessId: business.id,
      message: "Generating a Job Record from a Work Card failed.",
      error: err,
      context: { workCardId: workCard.id },
    });
    return NextResponse.json({ error: "Something went wrong generating this report — please try again." }, { status: 500 });
  }

  // Photos — best-effort, per photo: a customer's already-analysed
  // WhatsApp photo is copied into job-doc-media so it shows up on the
  // report without a re-upload. One failed photo must never fail the
  // whole report; it's just not there to include yet.
  if (workCard.conversation_id) {
    const { data: photos } = await service
      .from("conversation_photos")
      .select("message_id, storage_path, visible_summary, possible_summary, unknown_note, analysis_confidence")
      .eq("conversation_id", workCard.conversation_id)
      .order("created_at", { ascending: true });

    for (const photo of photos ?? []) {
      try {
        const { bytes, mimeType } = await downloadCustomerMedia(service, photo.storage_path);
        const photoId = randomUUID();
        const storagePath = await storeJobDocPhoto(service, { businessId: business.id, jobDocId, photoId, bytes, mimeType });
        await service.from("job_doc_photos").insert({
          id: photoId,
          job_doc_id: jobDocId,
          business_id: business.id,
          storage_path: storagePath,
          phase: "other",
          sort_order: 0,
          visible_summary: photo.visible_summary,
          possible_summary: photo.possible_summary,
          unknown_note: photo.unknown_note,
          analysis_confidence: photo.analysis_confidence,
          analyzed_at: new Date().toISOString(),
          included_in_report: true,
        });
      } catch (err) {
        await recordErrorEvent({
          severity: "warning",
          source: "work-cards.job_doc_photo_copy_failed",
          businessId: business.id,
          message: "Couldn't copy an already-analysed WhatsApp photo onto a generated Job Record.",
          error: err,
          context: { workCardId: workCard.id, jobDocId, messageId: photo.message_id },
        });
      }
    }
  }

  return NextResponse.json({ id: jobDocId, created: true });
}

/** Fetch-only: lets the Work Card page check for an existing linked
 * Job Record without creating one (e.g. to show "View report" instead
 * of "Generate report"). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = session; // RLS-scoped — no service role needed for a plain read.
  const { data: jobDoc } = await supabase.from("job_docs").select("id").eq("work_card_id", params.id).maybeSingle();

  return NextResponse.json({ id: jobDoc?.id ?? null });
}
