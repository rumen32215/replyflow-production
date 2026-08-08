import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { RAW_NOTES_FIELD_KEY, SECTION } from "@/lib/job-docs/fields";

export const runtime = "nodejs";

/**
 * Creates a new Job Record from the intake form (ReplyFlow 2.0, Phase
 * 2). A server route rather than a direct client-side insert — unlike
 * job_docs itself (owner-writable, see 0025_job_docs.sql), the raw
 * notes need to land in job_doc_fields, which is SELECT-only for
 * `authenticated`. Doing both writes here, after one explicit
 * ownership check, keeps job_docs and its first field created
 * together rather than splitting this into two round trips with two
 * different security models.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: {
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    jobAddress?: string;
    jobDate?: string;
    rawNotes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const customerName = (body.customerName ?? "").trim();
  const rawNotes = (body.rawNotes ?? "").trim();
  if (!rawNotes) {
    return NextResponse.json({ error: "Raw job notes are required." }, { status: 400 });
  }

  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  if (!business) return NextResponse.json({ error: "No business found for this account." }, { status: 404 });

  const service = createServiceClient();
  const jobAddress = (body.jobAddress ?? "").trim() || null;
  const title = customerName ? (jobAddress ? `${customerName} — ${jobAddress}` : customerName) : "New job record";

  try {
    const { data: jobDoc, error: insertError } = await service
      .from("job_docs")
      .insert({
        business_id: business.id,
        created_by: user.id,
        title,
        customer_name: customerName,
        customer_phone: (body.customerPhone ?? "").trim() || null,
        customer_email: (body.customerEmail ?? "").trim() || null,
        job_address: jobAddress,
        job_date: body.jobDate ? new Date(body.jobDate).toISOString() : null,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    if (!jobDoc) throw new Error("Insert returned no row");

    const { error: fieldError } = await service.from("job_doc_fields").insert({
      job_doc_id: jobDoc.id,
      business_id: business.id,
      section_label: SECTION.intake,
      sort_order: 0,
      field_key: RAW_NOTES_FIELD_KEY,
      field_value: rawNotes,
      provenance: "user_fact",
      confidence: "high",
      updated_by: "engineer",
    });
    if (fieldError) throw fieldError;

    return NextResponse.json({ id: jobDoc.id });
  } catch (err) {
    console.error("[job-docs] create failed:", err);
    await recordErrorEvent({
      severity: "error",
      source: "job-docs.create_failed",
      businessId: business.id,
      message: "Creating a new Job Record failed.",
      error: err,
    });
    return NextResponse.json({ error: "Something went wrong creating this job record — please try again." }, { status: 500 });
  }
}
