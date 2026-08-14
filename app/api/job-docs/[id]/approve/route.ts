import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { selectReportContent, type ReportContentPhotoRow } from "@/lib/job-docs/report-content";
import { approveReport, hasApprovableContent, AWAITING_APPROVAL_STATUS, APPROVED_STATUS } from "@/lib/job-docs/approval";
import type { JobDocFieldRow } from "@/lib/job-docs/fields";

export const runtime = "nodejs";

/**
 * ReplyFlow 2.0, Phase 2E — the owner's approval action.
 *
 * Reuses selectReportContent() (Stage 4) as the single source of truth
 * for what the report actually contains — the exact same function
 * app/(dashboard)/dashboard/job-records/[id]/report/page.tsx already
 * calls, never a second content-selection path. job_doc_fields and
 * job_doc_photos are re-fetched fresh here rather than trusting
 * anything the client sends, so approval always reflects the report's
 * true, current state at the moment of the click — never a stale
 * snapshot from whenever the owner first opened the preview.
 *
 * Same auth -> ownership -> service-role-write shape every other
 * job-docs route already uses.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const service = createServiceClient();

  const { data: jobDoc } = await service
    .from("job_docs")
    .select("id, business_id, status, work_card_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!jobDoc) return NextResponse.json({ error: "Job record not found" }, { status: 404 });

  const { data: business } = await service.from("businesses").select("id, owner_id").eq("id", jobDoc.business_id).maybeSingle();
  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (jobDoc.status === APPROVED_STATUS) {
    return NextResponse.json({ error: "This report has already been approved." }, { status: 409 });
  }
  if (jobDoc.status !== AWAITING_APPROVAL_STATUS) {
    return NextResponse.json({ error: "Generate a draft and review it before approving this report." }, { status: 400 });
  }

  try {
    // Production hardening (2026-08-14) — the real, live Work Card
    // status, same live-fetch as everywhere else; approval must judge
    // the report against the same status the customer-facing document
    // itself will show, never a stale assumption.
    let isJobCompleted = false;
    let issueReported: string | null = null;
    if (jobDoc.work_card_id) {
      const { data: workCard } = await service.from("work_cards").select("status, issue").eq("id", jobDoc.work_card_id).maybeSingle();
      isJobCompleted = workCard?.status === "completed";
      issueReported = workCard?.issue ?? null;
    }

    const { data: fields } = await service
      .from("job_doc_fields")
      .select("id, job_doc_id, section_label, sort_order, field_key, field_value, provenance, confidence, updated_by")
      .eq("job_doc_id", jobDoc.id);

    const { data: photoRows } = await service
      .from("job_doc_photos")
      .select(
        "id, storage_path, caption, phase, sort_order, visible_summary, possible_summary, unknown_note, analysis_confidence, analyzed_at, created_at, included_in_report"
      )
      .eq("job_doc_id", jobDoc.id);

    const content = selectReportContent({
      jobDocId: jobDoc.id,
      fields: (fields ?? []) as JobDocFieldRow[],
      photos: (photoRows ?? []) as ReportContentPhotoRow[],
      isJobCompleted,
      issueReported,
    });

    if (!hasApprovableContent(content)) {
      return NextResponse.json({ error: "This report doesn't have any content ready to approve yet." }, { status: 400 });
    }

    const result = await approveReport(service, jobDoc.id, user.id);
    if (!result.approved) {
      // The atomic conditional UPDATE (status = 'review') is the real
      // guard here — losing it means the report's content changed or
      // was approved by another request between the status check above
      // and now. A correct rejection, not a bug.
      return NextResponse.json(
        { error: "This report's content changed just now — please review it again before approving." },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, approvedAt: result.approvedAt, approvedBy: user.id });
  } catch (err) {
    console.error("[job-docs] report approval failed:", err);
    await recordErrorEvent({
      severity: "error",
      source: "job-docs.report_approval_failed",
      businessId: business.id,
      message: "Approving a job report failed.",
      error: err,
      context: { jobDocId: jobDoc.id },
    });
    return NextResponse.json({ error: "Couldn't approve this report — please try again." }, { status: 500 });
  }
}
