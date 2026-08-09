import type { Metadata } from "next";
import sharp from "sharp";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { selectReportContent, type ReportContentPhotoRow } from "@/lib/job-docs/report-content";
import { buildReportDocumentModel } from "@/lib/job-docs/report-document-model";
import { JOB_DOC_MEDIA_BUCKET, downloadJobDocPhoto } from "@/lib/job-docs/photo-storage";
import { recordErrorEvent } from "@/lib/error-events";
import type { JobDocFieldRow } from "@/lib/job-docs/fields";
import { ReportPreview } from "@/components/dashboard/job-records/report-preview";
import { ReportApproval, type ReportApprovalSummary } from "@/components/dashboard/job-records/report-approval";

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
    const { bytes } = await downloadJobDocPhoto(service, storagePath);
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
 * ReplyFlow 2.0, Phase 2D — the customer-facing report preview route.
 *
 * Data access mirrors app/(dashboard)/dashboard/job-records/[id]/page.tsx
 * exactly, not a new pattern: every read goes through createClient()
 * (the RLS-scoped client, not the service role), so a job record that
 * doesn't belong to the signed-in owner's business is invisible at the
 * query level, not merely hidden in the UI — a user can never preview
 * another owner's report by changing the URL's id, the same guarantee
 * every other job-records page already gives. The service role is
 * only ever used afterward, to generate signed URLs (JPEG/PNG) or to
 * download-and-transcode (WebP only) into the private job-doc-media
 * bucket, same trust boundary as the existing detail page.
 *
 * All content decisions happen in selectReportContent() (Stage 4) and
 * buildReportDocumentModel() (this stage) — this page only fetches and
 * hands off already-scoped rows, never filters or reorders anything
 * itself.
 */
export default async function JobReportPreviewPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: jobDoc } = await supabase
    .from("job_docs")
    .select("id, business_id, title, customer_name, job_address, job_date, status, approved_by, approved_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!jobDoc) notFound();

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name, phone, logo_url, trade")
    .eq("id", jobDoc.business_id)
    .maybeSingle();
  if (!business) notFound();

  const { data: fields } = await supabase
    .from("job_doc_fields")
    .select("id, job_doc_id, section_label, sort_order, field_key, field_value, provenance, confidence, updated_by")
    .eq("job_doc_id", jobDoc.id);

  const { data: photoRows } = await supabase
    .from("job_doc_photos")
    .select(
      "id, storage_path, caption, phase, sort_order, visible_summary, possible_summary, unknown_note, analysis_confidence, analyzed_at, created_at, included_in_report"
    )
    .eq("job_doc_id", jobDoc.id);

  const allFields = (fields ?? []) as JobDocFieldRow[];
  const allPhotos = (photoRows ?? []) as ReportContentPhotoRow[];

  // Photo sources (Stage 5, hardened) — resolved once here so
  // lib/job-docs/report-document-model.ts's buildReportDocumentModel
  // stays pure (no storage I/O of its own). JPEG/PNG keep the exact
  // same lightweight signed-URL pattern the existing detail page
  // already uses; WebP (which react-pdf cannot decode) is transcoded
  // to a JPEG data URI instead — see resolveWebpPhotoAsJpegDataUri.
  const service = createServiceClient();
  const photoUrls = new Map<string, string | null>(
    await Promise.all(
      allPhotos.map(async (p): Promise<[string, string | null]> => {
        if (isWebpPhoto(p.storage_path)) {
          const dataUri = await resolveWebpPhotoAsJpegDataUri(service, jobDoc.business_id, p.id, p.storage_path);
          return [p.id, dataUri];
        }
        const { data } = await service.storage.from(JOB_DOC_MEDIA_BUCKET).createSignedUrl(p.storage_path, 3600);
        return [p.id, data?.signedUrl ?? null];
      })
    )
  );

  const content = selectReportContent({ jobDocId: jobDoc.id, fields: allFields, photos: allPhotos });

  // Approval summary (Stage 6) — built entirely from the same content
  // just selected above; never a second fetch or a second content
  // decision, per the same single-source-of-truth rule the preview
  // itself already follows.
  const approvalSummary: ReportApprovalSummary = {
    hasJobSummary: Boolean(content.jobSummary),
    hasWorkPerformed: Boolean(content.workPerformed),
    observationCount: content.observations.length,
    photoCount: content.photos.length,
  };

  const model = buildReportDocumentModel({
    jobDocId: jobDoc.id,
    business: { businessName: business.business_name, phone: business.phone, logoUrl: business.logo_url, trade: business.trade },
    jobDoc: {
      title: jobDoc.title,
      customerName: jobDoc.customer_name,
      jobAddress: jobDoc.job_address,
      jobDate: jobDoc.job_date,
    },
    content,
    photoUrls,
  });

  return (
    <div className="mx-auto flex h-full max-w-[900px] flex-col space-y-4">
      <div>
        <Link
          href={`/dashboard/job-records/${jobDoc.id}`}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Job Record
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Report Preview</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          This is exactly what the customer-facing Job Report will show — the same layout the final PDF will use.
        </p>
      </div>

      <ReportApproval jobDocId={jobDoc.id} status={jobDoc.status} approvedAt={jobDoc.approved_at} summary={approvalSummary} />

      <div className="min-h-[80vh] flex-1 overflow-hidden rounded-2xl border border-border bg-card">
        <ReportPreview model={model} />
      </div>
    </div>
  );
}
