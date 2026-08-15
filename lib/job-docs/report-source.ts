import { selectReportContent, type ReportContentPhotoRow, type JobReportContent } from "./report-content";
import type { JobDocFieldRow } from "./fields";
import type { ReportDocumentHeader, ReportDocumentJobDetails } from "./report-document-model";

/**
 * Plumber Reset — Phase 3 step 6 (Job/Report transition). The single
 * place that decides what "the customer's name," "the job's address,"
 * and "when this job happened" actually are, for report purposes.
 *
 * Before this, job_docs carried its own customer_name/job_address/
 * job_date columns, seeded once from the Work Card at creation time
 * and never resynced — the exact root cause of "Work Card said one
 * thing, Job Record said another" the live test found. This function
 * never reads those columns at all; it takes the live Work Card (the
 * one canonical Job) as its only source for anything that could drift,
 * and job_docs contributes only its own title (a label, not a fact
 * that can go stale the same way).
 *
 * Pure — every input is already fetched by the caller (the same
 * "no I/O in the decision layer" discipline every other job-docs
 * module already follows), so this is unit-testable without a
 * database and reusable identically by the live report view, the
 * approval-time snapshot freeze, and (via generate-draft's own
 * context) draft generation.
 */

export interface ReportSourceWorkCard {
  customerName: string | null;
  address: string | null;
  issue: string | null;
  status: string;
  scheduledFor: string | null;
  completedAt: string | null;
}

export interface ReportSource {
  header: ReportDocumentHeader;
  jobDetails: ReportDocumentJobDetails;
  content: JobReportContent;
}

export function buildReportSource(input: {
  jobDocId: string;
  jobDocTitle: string;
  business: { businessName: string; phone: string | null; logoUrl: string | null; trade: string | null };
  /** Null only for a job_docs row that predates the Work Card link
   * (0030) or was created through the standalone manual-entry path —
   * every field below degrades to an honest null/false rather than
   * guessing, never a crash. */
  workCard: ReportSourceWorkCard | null;
  fields: JobDocFieldRow[];
  photos: ReportContentPhotoRow[];
}): ReportSource {
  const isJobCompleted = input.workCard?.status === "completed";
  const issueReported = input.workCard?.issue ?? null;

  const content = selectReportContent({
    jobDocId: input.jobDocId,
    fields: input.fields,
    photos: input.photos,
    isJobCompleted,
    issueReported,
  });

  return {
    header: {
      businessName: input.business.businessName,
      businessPhone: input.business.phone,
      logoUrl: input.business.logoUrl,
      trade: input.business.trade,
    },
    jobDetails: {
      title: input.jobDocTitle,
      customerName: input.workCard?.customerName ?? null,
      jobAddress: input.workCard?.address ?? null,
      jobDate: input.workCard ? input.workCard.completedAt ?? input.workCard.scheduledFor : null,
    },
    content,
  };
}
