import type { Metadata } from "next";
import sharp from "sharp";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildReportSource, type ReportSource } from "@/lib/job-docs/report-source";
import { parseReportSnapshot } from "@/lib/job-docs/report-snapshot";
import { fetchJobPhotos } from "@/lib/job-docs/job-evidence";
import { buildReportDocumentModel } from "@/lib/job-docs/report-document-model";
import { JOB_DOC_MEDIA_BUCKET, downloadJobDocPhoto } from "@/lib/job-docs/photo-storage";
import { CUSTOMER_MEDIA_BUCKET, downloadCustomerMedia } from "@/lib/reply-engine/media-storage";
import { recordErrorEvent } from "@/lib/error-events";
import type { JobDocFieldRow } from "@/lib/job-docs/fields";
import type { ReportContentPhoto } from "@/lib/job-docs/report-content";
import { ReportPreview, ResponsiveReportPreview } from "@/components/dashboard/reports/report-preview";
import { ReportApproval, type ReportApprovalSummary } from "@/components/dashboard/reports/report-approval";

export const metadata: Metadata = { title: "Report Preview — ReplyFlow" };

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * @react-pdf/renderer's Image component only decodes JPEG/PNG/SVG — it
 * sniffs the fetched bytes themselves (never the URL string), and
 * neither its browser nor Node build has any WebP decoder at all
 * (confirmed by inspecting both @react-pdf/image builds directly).
 * lib/job-docs/photo-compression.ts legitimately allows WebP uploads
 * and preserves the format, so real stored job photos can genuinely be
 * WebP — those fail with "Not valid image extension" no matter how
 * the signed URL is shaped; it was never a query-string parsing issue.
 *
 * storage_path's own extension is the authoritative signal (assigned
 * from the real, validated upload mime type at write time — see
 * EXTENSION_BY_MIME in lib/job-docs/photo-storage.ts), so no new
 * column or content-sniffing is needed here.
 */
function isWebpPhoto(storagePath: string): boolean {
  return storagePath.toLowerCase().endsWith(".webp");
}

const PDF_PHOTO_JPEG_QUALITY = 85;

/**
 * Production hardening — a report photo's storagePath can live in
 * either private bucket depending on where the photo actually came
 * from (job-doc-media for a manual upload, customer-media for a
 * WhatsApp photo — lib/job-docs/job-evidence.ts's own JobEvidenceSource
 * discriminator), but neither ReportContentPhoto nor a frozen, already-
 * approved report_snapshot carries that source forward — an approved
 * snapshot must go on rendering correctly forever, long after the live
 * evidence that produced it could tell you which bucket to use. Trying
 * job-doc-media first, then customer-media, is a deterministic, side-
 * effect-free two-bucket lookup that works identically for a live draft
 * and a historical frozen snapshot, with no schema change and no risk
 * to already-approved reports. This was the actual root cause of photos
 * silently missing from the PDF: every photo in a real production test
 * was WhatsApp-sourced, so the old job-doc-media-only lookup found
 * nothing for either of them.
 */
async function signEitherBucket(service: ServiceClient, storagePath: string): Promise<string | null> {
  const jobDocResult = await service.storage.from(JOB_DOC_MEDIA_BUCKET).createSignedUrl(storagePath, 3600);
  if (jobDocResult.data?.signedUrl) return jobDocResult.data.signedUrl;
  const conversationResult = await service.storage.from(CUSTOMER_MEDIA_BUCKET).createSignedUrl(storagePath, 3600);
  return conversationResult.data?.signedUrl ?? null;
}

/** Same two-bucket fallback as signEitherBucket, for the WebP download
 * path — see that function's doc comment for the full reasoning. */
async function downloadFromEitherBucket(service: ServiceClient, storagePath: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  try {
    return await downloadJobDocPhoto(service, storagePath);
  } catch {
    return await downloadCustomerMedia(service, storagePath);
  }
}

/**
 * For the one format react-pdf can't decode, downloads the already-
 * private bytes server-side (the same service-role storage access
 * already used to sign every other photo — no new trust boundary) and
 * re-encodes to JPEG in memory with sharp (already a project
 * dependency, used identically at upload time), returned as a data URI
 * react-pdf already has a working, existing code path for
 * (resolveBase64Image). No new storage writes, no public bucket, no
 * change to the signed-URL model for JPEG/PNG photos — they never
 * reach this function at all.
 *
 * Never throws: a transcode failure is logged and the photo is simply
 * omitted from the report (report-document.tsx already renders a
 * photo's caption without an image when url is null), the same
 * degrade-honestly discipline every other job-docs failure path uses.
 */
async function resolveWebpPhotoAsJpegDataUri(
  service: ServiceClient,
  businessId: string,
  photoId: string,
  storagePath: string
): Promise<string | null> {
  try {
    const { bytes } = await downloadFromEitherBucket(service, storagePath);
    const jpeg = await sharp(Buffer.from(bytes)).jpeg({ quality: PDF_PHOTO_JPEG_QUALITY }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch (err) {
    console.error("[job-docs] report: WebP-to-JPEG transcode failed for PDF preview:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "job-docs.report_photo_transcode_failed",
      businessId,
      message: "A WebP job record photo could not be converted for the report preview and was omitted.",
      error: err,
      context: { photoId },
    });
    return null;
  }
}

/**
 * Resolves every photo's storagePath to an actual fetchable URL/data
 * URI — the one I/O step buildReportDocumentModel deliberately stays
 * free of. Identical whether `photos` came from a live-computed
 * ReportSource or a frozen work_cards.report_snapshot: a signed URL is
 * never itself part of what got approved (it expires in an hour), so
 * this always runs fresh, every render, against whatever storagePaths
 * the current content — live or frozen — actually lists.
 */
async function resolvePhotoUrls(service: ServiceClient, businessId: string, photos: ReportContentPhoto[]): Promise<Map<string, string | null>> {
  return new Map(
    await Promise.all(
      photos.map(async (p): Promise<[string, string | null]> => {
        if (!p.storagePath) return [p.id, null];
        if (isWebpPhoto(p.storagePath)) {
          const dataUri = await resolveWebpPhotoAsJpegDataUri(service, businessId, p.id, p.storagePath);
          return [p.id, dataUri];
        }
        const url = await signEitherBucket(service, p.storagePath);
        return [p.id, url];
      })
    )
  );
}

/**
 * Plumber Reset — Phase 3 step 6 (Job/Report transition).
 *
 * The Job (work_cards) is the single source of truth. A DRAFT report
 * (work_cards.report_status !== 'approved') is always computed live,
 * fresh, from the Job's current status/fields/evidence — the same
 * buildReportSource() the approval route uses to decide what it's
 * actually approving. An APPROVED report renders from the frozen
 * snapshot instead (parseReportSnapshot) — genuinely immutable: later
 * edits to the Job's fields, photos, or even its customer/address
 * change what the NEXT draft would say, never what was already
 * approved.
 *
 * Data access mirrors app/(dashboard)/dashboard/reports/[id]/page.tsx
 * exactly, not a new pattern: every read goes through createClient()
 * (the RLS-scoped client, not the service role), so a job record that
 * doesn't belong to the signed-in owner's business is invisible at the
 * query level, not merely hidden in the UI. The service role is only
 * ever used afterward, to resolve photo URLs.
 */
export default async function JobReportPreviewPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: jobDoc } = await supabase
    .from("job_docs")
    .select("id, business_id, title, status, approved_by, approved_at, work_card_id, charge_labour, charge_materials")
    .eq("id", params.id)
    .maybeSingle();
  if (!jobDoc) notFound();

  const { data: workCard } = jobDoc.work_card_id
    ? await supabase
        .from("work_cards")
        .select("customer_name, address, issue, status, scheduled_for, completed_at, episode_id, report_status, report_snapshot")
        .eq("id", jobDoc.work_card_id)
        .maybeSingle()
    : { data: null };

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name, phone, logo_url, trade")
    .eq("id", jobDoc.business_id)
    .maybeSingle();
  if (!business) notFound();

  const service = createServiceClient();

  // The frozen snapshot is only ever trusted when the Job itself still
  // says "approved" — invalidateWorkCardReportSnapshot (Phase 3 step 6)
  // already clears report_status the moment any content mutation
  // happens, so this check alone is enough; a stale snapshot can never
  // be rendered as if it were current.
  const frozen = workCard?.report_status === "approved" ? parseReportSnapshot(workCard.report_snapshot) : null;

  let source: ReportSource;
  if (frozen) {
    source = frozen;
  } else {
    const { data: fields } = await supabase
      .from("job_doc_fields")
      .select("id, job_doc_id, section_label, sort_order, field_key, field_value, provenance, confidence, updated_by")
      .eq("job_doc_id", jobDoc.id);

    const photos = await fetchJobPhotos(service, { jobDocId: jobDoc.id, episodeId: workCard?.episode_id ?? null });

    source = buildReportSource({
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
      charges: { labour: jobDoc.charge_labour, materials: jobDoc.charge_materials },
    });
  }

  const photoUrls = await resolvePhotoUrls(service, jobDoc.business_id, source.content.photos);

  // Approval summary (Stage 6) — built entirely from the same content
  // just selected above; never a second fetch or a second content
  // decision, per the same single-source-of-truth rule the preview
  // itself already follows.
  const approvalSummary: ReportApprovalSummary = {
    hasJobSummary: Boolean(source.content.jobSummary),
    hasWorkPerformed: Boolean(source.content.workPerformed),
    observationCount: source.content.observations.length,
    photoCount: source.content.photos.length,
    isJobCompleted: source.content.isJobCompleted,
  };

  const model = buildReportDocumentModel({
    jobDocId: jobDoc.id,
    business: { businessName: source.header.businessName, phone: source.header.businessPhone, logoUrl: source.header.logoUrl, trade: source.header.trade },
    jobDoc: source.jobDetails,
    content: source.content,
    photoUrls,
  });

  return (
    <div className="mx-auto flex h-full max-w-[900px] flex-col space-y-4">
      <div>
        <Link
          href={`/dashboard/reports/${jobDoc.id}`}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Report
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Report Preview</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {frozen
            ? "This is the approved report exactly as it was approved — later changes to the Job never alter it."
            : "This is exactly what the customer-facing Job Report will show — the same layout the final PDF will use."}
        </p>
      </div>

      <ReportApproval
        jobDocId={jobDoc.id}
        status={jobDoc.status}
        approvedAt={jobDoc.approved_at}
        summary={approvalSummary}
        model={model}
        fileName={`${jobDoc.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "job-report"}.pdf`}
      />

      {/* Production hardening (2026-08-15) — a real production test
       * found the embedded, fixed-A4 PDF preview genuinely uncomfortable
       * to read on a phone. Same underlying model either way, just two
       * presentations: a phone gets a plain, flowing HTML read; a
       * wider screen keeps the exact PDF-engine preview. Download PDF
       * above always produces the real file regardless of which one is
       * showing. */}
      <div className="md:hidden">
        <ResponsiveReportPreview model={model} />
      </div>
      <div className="hidden min-h-[80vh] flex-1 overflow-hidden rounded-2xl border border-border bg-card md:block">
        <ReportPreview model={model} />
      </div>
    </div>
  );
}
