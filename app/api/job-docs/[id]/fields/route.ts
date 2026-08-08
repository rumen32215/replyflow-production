import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";

export const runtime = "nodejs";

/**
 * Saves the tradesperson's edits to a job report draft (ReplyFlow 2.0,
 * Phase 2). Same ownership-check-then-service-role-write shape as the
 * draft route — job_doc_fields has no direct client write path.
 *
 * Once a human explicitly edits and saves a field, it stops being
 * AI output and becomes a real, owner-verified fact — provenance
 * moves to "user_fact" and updated_by to "engineer" (this schema's
 * only non-AI value), never left reading as AI-authored content the
 * owner never actually reviewed.
 *
 * Only ever touches field_keys that already exist on this job_doc —
 * never creates a new field_key from an arbitrary client payload.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { fields?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const edits = body.fields ?? {};
  if (Object.keys(edits).length === 0) {
    return NextResponse.json({ error: "No edits provided" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: jobDoc } = await service.from("job_docs").select("id, business_id").eq("id", params.id).maybeSingle();
  if (!jobDoc) return NextResponse.json({ error: "Job record not found" }, { status: 404 });

  const { data: business } = await service.from("businesses").select("id, owner_id").eq("id", jobDoc.business_id).maybeSingle();
  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: existingFields } = await service
    .from("job_doc_fields")
    .select("field_key")
    .eq("job_doc_id", jobDoc.id);
  const existingKeys = new Set((existingFields ?? []).map((f) => f.field_key));

  const updates = Object.entries(edits).filter(([key]) => existingKeys.has(key));
  if (updates.length === 0) {
    return NextResponse.json({ error: "None of the submitted fields exist on this job record." }, { status: 400 });
  }

  try {
    for (const [fieldKey, value] of updates) {
      const text = value.trim();
      const { error } = await service
        .from("job_doc_fields")
        .update({
          field_value: text || null,
          provenance: text ? "user_fact" : "missing",
          confidence: text ? "high" : "none",
          updated_by: "engineer",
        })
        .eq("job_doc_id", jobDoc.id)
        .eq("field_key", fieldKey);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[job-docs] field save failed:", err);
    await recordErrorEvent({
      severity: "error",
      source: "job-docs.field_save_failed",
      businessId: business.id,
      message: "Saving edited job report fields failed.",
      error: err,
      context: { jobDocId: jobDoc.id },
    });
    return NextResponse.json({ error: "Couldn't save your edits — please try again." }, { status: 500 });
  }
}
