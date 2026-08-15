import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { buildJobDocSeedFromWorkCard } from "@/lib/job-docs/from-work-card";
import { RAW_NOTES_FIELD_KEY, SECTION } from "@/lib/job-docs/fields";

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
      "id, business_id, conversation_id, episode_id, customer_name, issue, address, collected_details, conversation_summary, notes, scheduled_for, completed_at"
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
    // Plumber Reset Phase 3 step 10 — job_docs.customer_name/job_address/
    // job_date are deliberately left unwritten (DB defaults apply: ''
    // and null). Nothing reads them back — buildReportSource() (lib/
    // job-docs/report-source.ts) sources all three fresh from the live
    // Work Card every time — so populating them here would only recreate
    // the exact stale-second-source-of-truth bug Phase 1's audit found
    // in job_docs.job_date, for zero behavioural benefit.
    const { data: jobDoc, error: insertError } = await service
      .from("job_docs")
      .insert({
        business_id: business.id,
        created_by: user.id,
        conversation_id: workCard.conversation_id,
        work_card_id: workCard.id,
        title: seed.title,
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

  // Photos — Plumber Reset Phase 3 step 6: no copy step here anymore.
  // A customer's WhatsApp photos are read live, straight from
  // conversation_photos (scoped to this Job's own episode_id), unioned
  // with any manually-uploaded job_doc_photos, every time the report is
  // generated or viewed — see lib/job-docs/job-evidence.ts. This is
  // what closes the exact bug the live test found: a copy-once step
  // meant any photo sent after this route ran was invisible on the
  // report until someone thought to re-run it, and a copy could drift
  // from (or duplicate) the original. There is nothing to do here now;
  // the Job's evidence is read fresh wherever it's needed.

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
