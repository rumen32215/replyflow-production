"use client";

import dynamic from "next/dynamic";
import { ReportDocument } from "@/lib/job-docs/report-document";
import type { ReportDocumentModel } from "@/lib/job-docs/report-document-model";

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
