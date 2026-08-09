import type { createServiceClient } from "@/lib/supabase/service";
import type { JobReportContent } from "./report-content";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * ReplyFlow 2.0, Phase 2B — approval integrity.
 *
 * The rule: once a job report is approved, any change to its actual
 * customer-facing content voids that approval. An owner must never be
 * able to hand a job report over (or a future stage present it) as
 * "approved" once what it actually says or shows has changed
 * underneath that approval — that's the entire point of an approval
 * existing at all.
 *
 * 'review' is the correct landing state, not 'draft': real content
 * still exists and is exactly what needs the owner's attention again —
 * the same meaning 'review' already carries the moment a fresh draft
 * is generated (app/api/job-docs/[id]/draft/route.ts).
 *
 * Every mutation route that can change what the Job Report actually
 * says or shows calls invalidateReportApproval() — see each call
 * site's own comment for why that particular mutation qualifies, and
 * lib/job-docs/fields.ts's isReportContentFieldKey() for the same
 * judgment applied to individual field edits.
 */

export const AWAITING_APPROVAL_STATUS = "review" as const;
export const APPROVED_STATUS = "approved" as const;

export interface ApprovalInvalidationUpdate {
  status: typeof AWAITING_APPROVAL_STATUS;
  approved_by: null;
  approved_at: null;
}

/** The exact write every invalidation performs — status and both
 * approval fields always change together, never independently, so an
 * approval can never be left in a half-cleared state. */
export const APPROVAL_INVALIDATION_UPDATE: ApprovalInvalidationUpdate = {
  status: AWAITING_APPROVAL_STATUS,
  approved_by: null,
  approved_at: null,
};

/**
 * Pure rule, unit-tested without a database (same discipline as
 * lib/job-docs/draft-lock.ts's isDraftLockFree): a mutation against a
 * job_doc that isn't currently 'approved' must never itself invent a
 * status change. Draft and review stay exactly as they were; only an
 * approved report is ever something to invalidate.
 */
export function needsApprovalInvalidation(currentStatus: string): boolean {
  return currentStatus === APPROVED_STATUS;
}

/**
 * The centralized write every report-content mutation route calls.
 * Deliberately takes only a jobDocId — never reads the current status
 * first — so there's no read-then-write race: the WHERE clause itself
 * is the check, a single atomic conditional UPDATE, the same BUG-14
 * pattern app/api/job-docs/[id]/draft/route.ts's acquireDraftLock
 * already uses for the same reason. If the row wasn't 'approved' at
 * the moment this runs, zero rows match and this is a correct no-op,
 * not an error — needsApprovalInvalidation above states that same rule
 * in a form that doesn't need a database to test.
 */
export async function invalidateReportApproval(service: ServiceClient, jobDocId: string): Promise<void> {
  const { error } = await service
    .from("job_docs")
    .update(APPROVAL_INVALIDATION_UPDATE)
    .eq("id", jobDocId)
    .eq("status", APPROVED_STATUS);
  if (error) throw error;
}

/**
 * ReplyFlow 2.0, Phase 2E — Stage 6 approval.
 *
 * A report is approvable only once it genuinely has something in it —
 * reuses JobReportContent (Stage 4's selectReportContent() output)
 * directly rather than a second, parallel notion of "is this report
 * ready." Deliberately not exported from report-content.ts itself:
 * Stage 4 was explicitly not to be modified for this, and "is there
 * enough here to approve" is an approval-domain question, not a
 * content-selection one — the same separation Stage 4's own header
 * comment already draws between selection and everything downstream.
 */
export function hasApprovableContent(
  content: Pick<JobReportContent, "jobSummary" | "workPerformed" | "observations" | "photos">
): boolean {
  return Boolean(content.jobSummary || content.workPerformed || content.observations.length > 0 || content.photos.length > 0);
}

export interface ApproveReportResult {
  /** False means the row genuinely wasn't 'review' at the moment this
   * ran (already approved, still draft, or a race with another
   * request) — a correct rejection for the caller to report, not an
   * error. */
  approved: boolean;
  approvedAt: string | null;
}

/**
 * The approval write. Same atomic-conditional-UPDATE discipline as
 * invalidateReportApproval and BUG-14's acquireDraftLock — the WHERE
 * clause (status = 'review') is the only check; there is no separate
 * read-then-write step, so a concurrent invalidation or a second
 * approve click can never both succeed. status, approved_by, and
 * approved_at are always written together in one call, the same
 * "never half-written" guarantee APPROVAL_INVALIDATION_UPDATE gives
 * the reverse transition.
 */
export async function approveReport(
  service: ServiceClient,
  jobDocId: string,
  approvedByUserId: string
): Promise<ApproveReportResult> {
  const approvedAt = new Date().toISOString();
  const { data, error } = await service
    .from("job_docs")
    .update({ status: APPROVED_STATUS, approved_by: approvedByUserId, approved_at: approvedAt })
    .eq("id", jobDocId)
    .eq("status", AWAITING_APPROVAL_STATUS)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return { approved: Boolean(data), approvedAt: data ? approvedAt : null };
}
