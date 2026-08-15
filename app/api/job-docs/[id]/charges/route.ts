import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { invalidateReportApproval } from "@/lib/job-docs/approval";

export const runtime = "nodejs";

/**
 * Saves the owner's own entered charge (0038) — labour and/or
 * materials, GBP, always owner-entered. There is no AI code path
 * anywhere that writes these two columns; this route is the only write
 * path that exists for them. Same auth -> ownership -> service-role-
 * write shape as every other job-docs route.
 *
 * A field omitted from the request body is left unchanged; a field
 * sent as null explicitly clears it — lets the client clear one amount
 * without having to resend the other.
 */
function parseAmount(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100) / 100;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { labour?: unknown; materials?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const labour = parseAmount(body.labour);
  const materials = parseAmount(body.materials);
  const updates: Record<string, number | null> = {};
  if (labour !== undefined) updates.charge_labour = labour;
  if (materials !== undefined) updates.charge_materials = materials;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid amount provided" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: jobDoc } = await service.from("job_docs").select("id, business_id").eq("id", params.id).maybeSingle();
  if (!jobDoc) return NextResponse.json({ error: "Job record not found" }, { status: 404 });

  const { data: business } = await service.from("businesses").select("id, owner_id").eq("id", jobDoc.business_id).maybeSingle();
  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await service.from("job_docs").update(updates).eq("id", jobDoc.id);
  if (error) {
    console.error("[job-docs] charges save failed:", error);
    await recordErrorEvent({
      severity: "error",
      source: "job-docs.charges_save_failed",
      businessId: business.id,
      message: "Saving the job report's charges failed.",
      error,
      context: { jobDocId: jobDoc.id },
    });
    return NextResponse.json({ error: "Couldn't save that — please try again." }, { status: 500 });
  }

  // Approval integrity (Stage 3) — a changed charge is changed report
  // content, same as any other field edit. Non-fatal, same discipline
  // as every other route in this file.
  try {
    await invalidateReportApproval(service, jobDoc.id);
  } catch (err) {
    console.error("[job-docs] approval invalidation failed after charges edit:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "job-docs.approval_invalidation_failed",
      businessId: business.id,
      message: "The job report's charges were edited but clearing an existing approval failed.",
      error: err,
      context: { jobDocId: jobDoc.id },
    });
  }

  return NextResponse.json({ ok: true });
}
