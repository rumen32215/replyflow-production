"use client";

import dynamic from "next/dynamic";
import { Loader2, Download } from "lucide-react";
import { ReportDocument } from "@/lib/job-docs/report-document";
import type { ReportDocumentModel } from "@/lib/job-docs/report-document-model";
import { formatDate } from "@/lib/work-card-format";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * ReplyFlow 2.0, Phase 2D — the customer-facing report preview.
 *
 * @react-pdf/renderer's PDFViewer renders the actual PDF document to a
 * blob and displays it inline in an iframe — this is the real PDF
 * engine's own output, not a second, hand-built HTML approximation of
 * it, which is exactly what keeps preview and the future PDF endpoint
 * in lockstep (both will render the identical
 * lib/job-docs/report-document.tsx Document).
 *
 * Only PDFViewer itself is dynamically imported with ssr: false — it's
 * the one export in this library that touches real DOM/Blob/iframe
 * APIs and has known incompatibilities with Next's server-render pass.
 * ReportDocument is imported normally (statically) here: it's built
 * only from @react-pdf/renderer's isomorphic core (Document/Page/View/
 * Text/Image), the exact same primitives a future server-side
 * renderToBuffer call would use in Node with no DOM at all, so it's
 * safe under SSR — and PDFViewer's own reconciler needs its child to
 * literally be a <Document> element at render time, which a second
 * layer of dynamic-import indirection here would risk breaking.
 */
const PDFViewer = dynamic(() => import("@react-pdf/renderer").then((mod) => mod.PDFViewer), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[80vh] items-center justify-center text-[13px] text-muted-foreground">
      Preparing the report preview…
    </div>
  ),
});

export function ReportPreview({ model }: { model: ReportDocumentModel }) {
  return (
    <PDFViewer style={{ width: "100%", height: "100%", minHeight: "80vh", border: "none" }} showToolbar>
      <ReportDocument model={model} />
    </PDFViewer>
  );
}

/**
 * Production hardening (2026-08-15) — a genuinely responsive on-screen
 * read of the report, for a phone. PDFViewer above renders the real
 * PDF engine's own output — accurate, but a fixed A4 page embedded in
 * an iframe is uncomfortable to actually read on a phone (a live
 * production test found exactly this). Rather than trying to make a
 * fixed-page PDF viewer responsive, this is a second, plain HTML render
 * of the identical ReportDocumentModel — same content, same photos,
 * same section order, just laid out as ordinary flowing cards instead
 * of a printed page. Nothing here decides what's included; every field
 * is read verbatim off the model, exactly like ReportDocument itself.
 *
 * ResponsiveReportPreview and ReportPreview are shown together (see the
 * preview page's own md:hidden / hidden md:block split) — a phone gets
 * this one, a wider screen gets the real PDF preview. Neither replaces
 * Download PDF, which always renders the actual file either way.
 */
export function ResponsiveReportPreview({ model }: { model: ReportDocumentModel }) {
  const jobDate = formatDate(model.jobDetails.jobDate);
  // issueReported deliberately does not count toward hasTextContent —
  // it's no longer rendered as its own section (see below), matching
  // ReportDocument's identical change.
  const hasTextContent = Boolean(model.jobSummary || model.workPerformed || model.nextSteps || model.observations.length > 0 || model.charges);
  const allPhotos = model.photoPages.flat();

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        {model.header.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a signed, business-specific logo URL, not an optimizable static asset
          <img src={model.header.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold">{model.header.businessName}</p>
          <p className="truncate text-[12px] text-muted-foreground">
            {[model.header.trade, model.header.businessPhone].filter(Boolean).join(" · ") || " "}
          </p>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Job Report</p>
        <h2 className="mt-0.5 text-[17px] font-bold">{model.jobDetails.title}</h2>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-border pb-4 text-[13px]">
        <div>
          <dt className="text-[11px] text-muted-foreground">Date</dt>
          <dd className="font-medium">{jobDate ?? "Not given"}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Customer</dt>
          <dd className="font-medium">{model.jobDetails.customerName || "Not given"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[11px] text-muted-foreground">Address</dt>
          <dd className="font-medium">{model.jobDetails.jobAddress || "Not given"}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Status</dt>
          <dd className={cn("font-bold", model.isJobCompleted ? "text-success" : "text-attention")}>
            {model.isJobCompleted ? "COMPLETED" : "IN PROGRESS"}
          </dd>
        </div>
      </dl>

      {/* "Issue Reported" is deliberately not its own section here
       * anymore — see ReportDocument's identical change for the reason
       * (it duplicated Job Summary, stated in a second voice). The field
       * stays in the model untouched; only this render site changed. */}

      {model.jobSummary && (
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-primary">Job Summary</h3>
          <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed">{model.jobSummary.text}</p>
        </section>
      )}

      {model.observations.length > 0 && (
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-primary">Findings</h3>
          <ul className="mt-1.5 space-y-1">
            {model.observations.map((observation, i) => (
              <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed">
                <span className="text-primary">•</span>
                <span>{observation.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-primary">Work Completed</h3>
        {model.isJobCompleted && model.workPerformed ? (
          <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed">{model.workPerformed.text}</p>
        ) : (
          <p className="mt-1.5 text-[13.5px] italic text-muted-foreground">Not yet completed — this job is still in progress.</p>
        )}
      </section>

      {model.nextSteps && (
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-primary">Outcome / Next Steps</h3>
          <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed">{model.nextSteps.text}</p>
        </section>
      )}

      {/* Visual hierarchy (production test, 2026-08-16) — matches
       * ReportDocument's identical divider: Charges and Photos are
       * supporting material, not a continuation of the narrative flow
       * above, shown once only when there's actually something to show. */}
      {(model.charges || allPhotos.length > 0) && (
        <div className="border-t border-border pt-4">
          <p className="mb-3.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Supporting information</p>
        </div>
      )}

      {model.charges && (
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-primary">Charges</h3>
          {/* 7d visual polish (production test, 2026-08-16) — a heavier
           * border and a tinted total row, matching the PDF's identical
           * treatment, so this reads as a real invoice-style table
           * rather than plain list rows. */}
          <div className="mt-1.5 divide-y divide-border overflow-hidden rounded-lg border-[1.5px] border-border text-[13.5px]">
            {model.charges.labour != null && (
              <div className="flex justify-between px-3 py-2">
                <span>Labour / Work</span>
                <span className="tabular-nums">£{model.charges.labour.toFixed(2)}</span>
              </div>
            )}
            {model.charges.materials != null && (
              <div className="flex justify-between px-3 py-2">
                <span>Materials</span>
                <span className="tabular-nums">£{model.charges.materials.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between bg-accent px-3 py-2.5 font-bold">
              <span>Total</span>
              <span className="tabular-nums">£{model.charges.total!.toFixed(2)}</span>
            </div>
          </div>
        </section>
      )}

      {!hasTextContent && !model.hasPhotos && (
        <p className="text-[13.5px] text-muted-foreground">This job report doesn&apos;t have any content ready yet.</p>
      )}

      {allPhotos.length > 0 && (
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-primary">Photos</h3>
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            {allPhotos.map((photo) => (
              <div key={photo.id}>
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a per-photo signed URL, not an optimizable static asset
                  <img src={photo.url} alt={photo.caption ?? ""} className="aspect-square w-full rounded-lg border border-border object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-border bg-muted text-[11px] text-muted-foreground">
                    Photo unavailable
                  </div>
                )}
                {photo.caption && <p className="mt-1 truncate text-[11px] text-muted-foreground">{photo.caption}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Production hardening (2026-08-14) — the real "get the actual PDF"
 * action, missing entirely before this. PDFDownloadLink is the same
 * @react-pdf/renderer library PDFViewer above already uses, rendering
 * the exact same <ReportDocument model={model} /> — never a second,
 * possibly-diverging representation of the report. Deliberately its
 * own dynamic import (same ssr:false reasoning as PDFViewer above):
 * PDFDownloadLink also touches Blob/URL APIs unavailable during SSR.
 *
 * This is a real <a download> the browser handles natively — including
 * on iOS Safari, where PDFViewer's iframe toolbar is not reliable —
 * rather than depending on the embedded PDF viewer's own chrome.
 */
const PDFDownloadLink = dynamic(() => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink), {
  ssr: false,
  loading: () => (
    <span className={cn(buttonVariants({ variant: "success" }), "w-auto opacity-60")}>
      <Loader2 className="h-4 w-4 animate-spin" />
      Preparing PDF…
    </span>
  ),
});

export function ReportDownloadButton({
  model,
  fileName,
  variant = "success",
}: {
  model: ReportDocumentModel;
  fileName: string;
  variant?: "success" | "outline";
}) {
  return (
    <PDFDownloadLink document={<ReportDocument model={model} />} fileName={fileName} className={cn(buttonVariants({ variant }), "w-auto")}>
      {({ loading }: { loading: boolean }) => (
        <>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {loading ? "Preparing PDF…" : "Download PDF"}
        </>
      )}
    </PDFDownloadLink>
  );
}
