import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";
import { approveReport, freezeWorkCardReportSnapshot, hasApprovableContent, AWAITING_APPROVAL_STATUS, APPROVED_STATUS } from "@/lib/job-docs/approval";
import { buildReportSource } from "@/lib/job-docs/report-source";
import { fetchJobPhotos } from "@/lib/job-docs/job-evidence";
import type { JobDocFieldRow } from "@/lib/job-docs/fields";

export const runtime = "nodejs";

/**
 * Plumber Reset — Phase 3 step 6 (Job/Report transition). Reuses
 * buildReportSource() as the single source of truth for what the
 * report actually contains — the exact same function the report
 * preview page calls, never a second content-selection path.
 * job_doc_fields and the Job's full merged photo evidence
 * (lib/job-docs/job-evidence.ts) are re-fetched fresh here rather than
 * trusting anything the client sends, so approval always reflects the
 * report's true, current state at the moment of the click.
 *
 * On success, the exact same ReportSource just approved is frozen onto
 * work_cards.report_snapshot (lib/job-docs/approval.ts's
 * freezeWorkCardReportSnapshot) — the Job's own, canonical approval
 * record. job_docs.status still flips too, for any code that hasn't
 * moved off it yet; work_cards is the new source of truth going
 * forward, never a second one alongside it.
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
    .select("id, business_id, title, status, work_card_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!jobDoc) return NextResponse.json({ error: "Job record not found" }, { status: 404 });

  const { data: business } = await service
    .from("businesses")
    .select("id, owner_id, business_name, phone, logo_url, trade")
    .eq("id", jobDoc.business_id)
    .maybeSingle();
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
    // The Job is the single source of truth (Phase 3 step 6) — approval
    // judges the report against the same live Work Card data the
    // report preview itself renders from, never a stale assumption.
    const { data: workCard } = jobDoc.work_card_id
      ? await service
          .from("work_cards")
          .select("customer_name, address, issue, status, scheduled_for, completed_at, episode_id")
          .eq("id", jobDoc.work_card_id)
          .maybeSingle()
      : { data: null };

    const { data: fields } = await service
      .from("job_doc_fields")
      .select("id, job_doc_id, section_label, sort_order, field_key, field_value, provenance, confidence, updated_by")
      .eq("job_doc_id", jobDoc.id);

    const photos = await fetchJobPhotos(service, { jobDocId: jobDoc.id, episodeId: workCard?.episode_id ?? null });

    const source = buildReportSource({
      jobDocId: jobDoc.id,
      jobDocTitle: jobDoc.title,
      business: { businessName: business.business_name, phone: business.phone, logoUrl: business.logo_url, trade: business.trade },
      workCard: workCard
        ? {
            customerName: workCard.customer_name,
            address: workCard.address,
            issue: workCard.issue,
            status: workCard.status,
            scheduledFor: workCard.scheduled_for,
            completedAt: workCard.completed_at,
          }
        : null,
      fields: (fields ?? []) as JobDocFieldRow[],
      photos,
    });

    if (!hasApprovableContent(source.content)) {
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

    // The Job's own, canonical approval record — an immutable snapshot
    // of exactly what was just approved (Phase 3 step 6). Only ever
    // written here, right after approveReport() itself succeeds, using
    // the exact same source that passed hasApprovableContent above.
    if (jobDoc.work_card_id) {
      await freezeWorkCardReportSnapshot(service, {
        workCardId: jobDoc.work_card_id,
        snapshot: source,
        approvedByUserId: user.id,
        approvedAt: result.approvedAt ?? new Date().toISOString(),
      });
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
