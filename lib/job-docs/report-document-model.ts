import type { JobReportContent, ReportContentField, ReportContentPhoto } from "./report-content";

/**
 * ReplyFlow 2.0, Phase 2D — the pure, deterministic view model behind
 * the customer-facing Job Report document:
 *
 *   Job Record → selectReportContent() → buildReportDocumentModel()
 *   → ReportDocument (JSX) → PDFViewer preview / future PDF endpoint
 *
 * This module deliberately contains zero content-eligibility decisions
 * of its own — jobSummary/workPerformed/observations/photos are taken
 * verbatim from the already-selected JobReportContent (Stage 4), never
 * re-filtered, re-ordered, or re-validated here. Its only two jobs are
 * (1) merging in the business/job header facts selectReportContent()
 * deliberately doesn't own (per Stage 4's own scoping decision — see
 * lib/job-docs/report-content.ts's header comment), and (2) grouping
 * photos into pages for print-sensible pagination.
 *
 * Kept a plain, framework-free function — no React, no @react-pdf —
 * for the same reason lib/job-docs/draft-lock.ts and
 * lib/job-docs/approval.ts keep their own decision logic pure: it's
 * unit-testable without a DOM, a database, or a PDF renderer. The
 * actual JSX (lib/job-docs/report-document.tsx) is a thin renderer
 * over this already-computed model, not a second place decisions get
 * made.
 */

export interface ReportDocumentHeader {
  businessName: string;
  businessPhone: string | null;
  logoUrl: string | null;
  /** e.g. "plumbing" — an optional light subtitle, never required. */
  trade: string | null;
}

export interface ReportDocumentJobDetails {
  title: string;
  customerName: string | null;
  jobAddress: string | null;
  /** ISO timestamp or null — formatting for display is a render-time
   * concern (see lib/work-card-format.ts's existing Europe/London
   * convention), deliberately not decided in this pure model. */
  jobDate: string | null;
}

/**
 * A report-content photo with its storagePath resolved to an actual
 * fetchable URL. Resolving a signed URL for the private job-doc-media
 * bucket is real I/O (see lib/job-docs/photo-storage.ts) — this stays
 * out of this pure module by design, the same way selectReportContent()
 * itself never touches storage; the caller resolves URLs up front
 * (mirroring exactly how app/(dashboard)/dashboard/reports/[id]/page.tsx
 * already does for the owner-facing photo section) and passes them in
 * via photoUrls below. url is null when a signed URL genuinely
 * couldn't be produced — the document renders the photo's caption
 * without an image in that case rather than throwing.
 */
export interface ReportDocumentPhoto extends ReportContentPhoto {
  url: string | null;
}

export interface ReportDocumentModel {
  jobDocId: string;
  header: ReportDocumentHeader;
  jobDetails: ReportDocumentJobDetails;
  /** Production hardening (2026-08-14) — verbatim from Stage 4
   * (selectReportContent). The document renderer's own STATUS line and
   * its Work Completed section both read from this, never infer it. */
  isJobCompleted: boolean;
  issueReported: string | null;
  jobSummary: ReportContentField | null;
  workPerformed: ReportContentField | null;
  nextSteps: ReportContentField | null;
  observations: ReportContentField[];
  /** Already paginated — see paginatePhotos. Empty array (not a
   * single empty page) when there are no eligible photos. */
  photoPages: ReportDocumentPhoto[][];
  hasPhotos: boolean;
}

/** A clean, readable density for one A4 report page (3 rows of 2). */
export const PHOTOS_PER_PAGE = 6;

/**
 * Deterministic page-chunking, not react-pdf's own automatic flow —
 * a real, verifiable pagination decision this module owns and can be
 * unit-tested directly, rather than trusting unmeasured render-time
 * layout. Preserves the given order exactly (Stage 4's own phase-then-
 * chronological ordering) — this never reorders, only groups.
 */
export function paginatePhotos<T>(photos: T[], perPage: number = PHOTOS_PER_PAGE): T[][] {
  if (photos.length === 0) return [];
  const pages: T[][] = [];
  for (let i = 0; i < photos.length; i += perPage) {
    pages.push(photos.slice(i, i + perPage));
  }
  return pages;
}

export function buildReportDocumentModel(input: {
  jobDocId: string;
  business: {
    businessName: string;
    phone: string | null;
    logoUrl: string | null;
    trade: string | null;
  };
  jobDoc: {
    title: string;
    customerName: string | null;
    jobAddress: string | null;
    jobDate: string | null;
  };
  content: JobReportContent;
  /** photo id -> already-resolved signed URL (or null if resolution
   * failed for that one photo). A photo present in content.photos but
   * missing from this map is treated as url: null, never an error. */
  photoUrls: ReadonlyMap<string, string | null>;
}): ReportDocumentModel {
  const photosWithUrls: ReportDocumentPhoto[] = input.content.photos.map((photo) => ({
    ...photo,
    url: input.photoUrls.get(photo.id) ?? null,
  }));

  return {
    jobDocId: input.jobDocId,
    header: {
      businessName: input.business.businessName,
      businessPhone: input.business.phone,
      logoUrl: input.business.logoUrl,
      trade: input.business.trade,
    },
    jobDetails: {
      title: input.jobDoc.title,
      customerName: input.jobDoc.customerName,
      jobAddress: input.jobDoc.jobAddress,
      jobDate: input.jobDoc.jobDate,
    },
    // Verbatim from Stage 4 — never re-filtered, re-ordered, or
    // re-validated here.
    isJobCompleted: input.content.isJobCompleted,
    issueReported: input.content.issueReported,
    jobSummary: input.content.jobSummary,
    workPerformed: input.content.workPerformed,
    nextSteps: input.content.nextSteps,
    observations: input.content.observations,
    photoPages: paginatePhotos(photosWithUrls),
    hasPhotos: photosWithUrls.length > 0,
  };
}
