import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { formatDate } from "@/lib/work-card-format";
import { pickPhotoLayout, type ReportDocumentModel } from "./report-document-model";

/**
 * ReplyFlow 2.0, Phase 2D — the presentation layer for the customer-
 * facing Job Report:
 *
 *   ReportDocumentModel (already-selected, already-ordered, already-
 *   paginated) → ReportDocument (this file) → PDFViewer preview /
 *   future PDF endpoint
 *
 * A thin renderer, not a second content-selection layer: every field
 * and photo shown here is read directly off the model with no
 * filtering, sorting, or eligibility decision of its own. If a field
 * is null or an array is empty, that section is simply omitted — this
 * file never falls back to raw_notes, invents placeholder text, or
 * shows an internal warning/error state.
 *
 * Colors trace to the ReplyFlow brand palette (app/globals.css) —
 * Dark #0F172A, Grey #64748B, Border #E5E7EB, Primary Blue #2563EB —
 * used sparingly (a label color, one thin accent rule), deliberately
 * not the app's own dashboard chrome: this document is meant to read
 * as being from the tradesperson's business, not from ReplyFlow.
 * Helvetica (react-pdf's built-in default) is used rather than
 * registering the app's Inter webfont — one fewer remote font-loading
 * dependency at render time, a deliberately small, production-safe
 * choice for a first version of this document.
 *
 * Isomorphic on purpose: no "use client", no browser-only API. Usable
 * both from a client-side PDFViewer (this stage's preview) and later
 * from a server-side renderToBuffer/renderToStream call (a future
 * PDF-download stage) without any change to this file.
 */

const COLORS = {
  dark: "#0F172A",
  grey: "#64748B",
  border: "#E5E7EB",
  primary: "#2563EB",
  white: "#FFFFFF",
  // Production hardening (2026-08-14) — status colours, same success/
  // attention pairing used elsewhere in the app (app/globals.css), so
  // "In Progress" vs "Completed" reads consistently everywhere.
  success: "#16A34A",
  attention: "#B45309",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    color: COLORS.dark,
  },
  runningHeader: {
    position: "absolute",
    top: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLORS.grey,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 6,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: COLORS.grey,
  },
  headerBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  businessName: {
    fontSize: 14,
    fontWeight: 700,
    color: COLORS.dark,
  },
  businessMeta: {
    fontSize: 9,
    color: COLORS.grey,
    marginTop: 2,
  },
  titleRule: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 1,
    color: COLORS.dark,
    marginBottom: 10,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailItem: {
    width: "50%",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 8,
    color: COLORS.grey,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 10.5,
    color: COLORS.dark,
  },
  statusValueCompleted: {
    fontSize: 10.5,
    fontWeight: 700,
    color: COLORS.success,
  },
  statusValueInProgress: {
    fontSize: 10.5,
    fontWeight: 700,
    color: COLORS.attention,
  },
  notCompletedNotice: {
    fontSize: 10.5,
    lineHeight: 1.5,
    color: COLORS.grey,
    fontStyle: "italic",
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.75,
    marginBottom: 6,
  },
  sectionText: {
    fontSize: 10.5,
    lineHeight: 1.5,
    color: COLORS.dark,
  },
  observationRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  observationBullet: {
    width: 12,
    fontSize: 10.5,
    color: COLORS.primary,
  },
  observationText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 1.5,
    color: COLORS.dark,
  },
  // 7d visual polish (production test, 2026-08-16) — a heavier border
  // and a tinted total row read as a real invoice-style table rather
  // than plain list rows, the standard, professional shape for this
  // kind of block. Presentation only; selectCharges's own logic (owner-
  // entered only, computed total) is unchanged.
  chargesTable: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    overflow: "hidden",
  },
  chargeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  chargeRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: "#EFF6FF",
  },
  chargeLabel: {
    fontSize: 10.5,
    color: COLORS.dark,
  },
  chargeLabelTotal: {
    fontSize: 10.5,
    fontWeight: 700,
    color: COLORS.dark,
  },
  chargeAmount: {
    fontSize: 10.5,
    color: COLORS.dark,
  },
  chargeAmountTotal: {
    fontSize: 10.5,
    fontWeight: 700,
    color: COLORS.dark,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  photoItem: {
    marginBottom: 14,
  },
  photoImage: {
    width: "100%",
    objectFit: "cover",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoCaption: {
    fontSize: 8.5,
    color: COLORS.grey,
    marginTop: 4,
  },
  // Visual hierarchy (production test, 2026-08-16) — Charges and Photos
  // are supporting material, not a continuation of the Job Summary ->
  // Findings -> Work Completed -> Outcome narrative flow above. A
  // slightly heavier rule (vs. the thin section dividers implied by
  // spacing alone) marks that shift without introducing a new color or
  // a second design language.
  supportingDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 4,
    marginBottom: 18,
  },
  supportingLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: COLORS.grey,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 14,
  },
});

function RunningHeader({ businessName, jobTitle }: { businessName: string; jobTitle: string }) {
  return (
    <View style={styles.runningHeader} fixed>
      <Text>{businessName}</Text>
      <Text>Job Report — {jobTitle}</Text>
    </View>
  );
}

function Footer() {
  return (
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
    />
  );
}

export function ReportDocument({ model }: { model: ReportDocumentModel }) {
  const { header, jobDetails } = model;
  const jobDate = formatDate(jobDetails.jobDate);
  // issueReported deliberately does not count toward hasTextContent —
  // it's no longer rendered as its own section (see below), so counting
  // it here would wrongly suppress the "no content yet" placeholder for
  // a report that has nothing else.
  const hasTextContent = Boolean(model.jobSummary || model.workPerformed || model.nextSteps || model.observations.length > 0 || model.charges);

  return (
    <Document title={`Job Report — ${jobDetails.title}`}>
      <Page size="A4" style={styles.page} wrap>
        <RunningHeader businessName={header.businessName} jobTitle={jobDetails.title} />

        <View style={styles.headerBlock}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image is a PDF primitive, not an HTML img; it has no alt prop */}
          {header.logoUrl && <Image src={header.logoUrl} style={styles.logo} />}
          <View>
            <Text style={styles.businessName}>{header.businessName}</Text>
            <Text style={styles.businessMeta}>
              {[header.trade, header.businessPhone].filter(Boolean).join(" · ") || " "}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>JOB REPORT</Text>
        <View style={styles.titleRule} />

        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Job</Text>
            <Text style={styles.detailValue}>{jobDetails.title}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{jobDate ?? "Not given"}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Customer</Text>
            <Text style={styles.detailValue}>{jobDetails.customerName || "Not given"}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={styles.detailValue}>{jobDetails.jobAddress || "Not given"}</Text>
          </View>
          {/* Production hardening (2026-08-14) — the real, live Work
           * Card status. Always shown once there's a linked Work Card
           * to read it from (model.isJobCompleted itself defaults to
           * false with no linked card, but the STATUS row only claims
           * something when there's a real card behind it — see
           * report-content.ts). */}
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={model.isJobCompleted ? styles.statusValueCompleted : styles.statusValueInProgress}>
              {model.isJobCompleted ? "COMPLETED" : "IN PROGRESS"}
            </Text>
          </View>
        </View>

        {/* "Issue Reported" (model.issueReported, the raw work_cards.issue)
         * is deliberately not its own section here anymore — it used to
         * sit directly above Job Summary restating the same problem in a
         * second voice, which was the single largest driver of the report
         * reading like an AI Q&A form rather than one coherent document
         * (structural fix, production test 2026-08-16). The field itself
         * is untouched in the data model — generate-draft.ts still reads
         * it as grounding input — only this render site changed;
         * job_summary is now told it's the sole customer-facing statement
         * of the problem (see generate-draft.ts's system prompt). */}

        {model.jobSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Job Summary</Text>
            <Text style={styles.sectionText}>{model.jobSummary.text}</Text>
          </View>
        )}

        {model.observations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Findings</Text>
            {model.observations.map((observation, i) => (
              <View key={i} style={styles.observationRow}>
                <Text style={styles.observationBullet}>•</Text>
                <Text style={styles.observationText}>{observation.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Production hardening (2026-08-14) — grounded strictly in the
         * live Work Card status (model.isJobCompleted), never in
         * whether AI-generated text happens to exist. Only a genuinely
         * completed job shows real "what was done" content; every other
         * state shows the same deterministic, non-AI notice — this
         * section can never claim finished work on a job that isn't. */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Work Completed</Text>
          {model.isJobCompleted && model.workPerformed ? (
            <Text style={styles.sectionText}>{model.workPerformed.text}</Text>
          ) : (
            <Text style={styles.notCompletedNotice}>Not yet completed — this job is still in progress.</Text>
          )}
        </View>

        {model.nextSteps && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Outcome / Next Steps</Text>
            <Text style={styles.sectionText}>{model.nextSteps.text}</Text>
          </View>
        )}

        {/* Visual hierarchy (production test, 2026-08-16) — Charges and
         * Photos are supporting material behind the narrative flow
         * above, not a continuation of it; a divider marks the shift
         * once, only when there's actually something supporting to show. */}
        {(model.charges || model.hasPhotos) && (
          <>
            <View style={styles.supportingDivider} />
            <Text style={styles.supportingLabel}>Supporting information</Text>
          </>
        )}

        {/* 0038 — always the owner's own entered figures, never AI. Omitted
         * entirely (not a "£0.00" row) whenever neither amount was entered —
         * see selectCharges in lib/job-docs/report-content.ts. */}
        {model.charges && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Charges</Text>
            <View style={styles.chargesTable}>
              {model.charges.labour != null && (
                <View style={styles.chargeRow}>
                  <Text style={styles.chargeLabel}>Labour / Work</Text>
                  <Text style={styles.chargeAmount}>£{model.charges.labour.toFixed(2)}</Text>
                </View>
              )}
              {model.charges.materials != null && (
                <View style={styles.chargeRow}>
                  <Text style={styles.chargeLabel}>Materials</Text>
                  <Text style={styles.chargeAmount}>£{model.charges.materials.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.chargeRowTotal}>
                <Text style={styles.chargeLabelTotal}>Total</Text>
                <Text style={styles.chargeAmountTotal}>£{model.charges.total!.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* PDF photo reflow (production test, 2026-08-16) — photos now
         * render inline, inside this same wrapping Page, instead of
         * always starting a fresh Page regardless of how much room was
         * left. react-pdf's own `wrap` overflow (already relied on for
         * this same Page, and for RunningHeader/Footer's `fixed` prop)
         * pushes any overflow onto additional pages by actual content
         * volume; `wrap={false}` on each item only stops a single
         * image+caption being split mid-page. pickPhotoLayout sizes each
         * photo by how many there are — a lone photo reads large, a big
         * set reads as a denser grid — rather than every photo reserving
         * the same fixed footprint regardless of count. */}
        {model.hasPhotos && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Photos</Text>
            <View style={styles.photoGrid}>
              {(() => {
                const allPhotos = model.photoPages.flat();
                const layout = pickPhotoLayout(allPhotos.length);
                return allPhotos.map((photo) => (
                  <View key={photo.id} wrap={false} style={[styles.photoItem, { width: layout.widthPercent }]}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image is a PDF primitive, not an HTML img; it has no alt prop */}
                    {photo.url && <Image src={photo.url} style={[styles.photoImage, { height: layout.heightPt }]} />}
                    {photo.caption && <Text style={styles.photoCaption}>{photo.caption}</Text>}
                  </View>
                ));
              })()}
            </View>
          </View>
        )}

        {!hasTextContent && !model.hasPhotos && (
          <View style={styles.section}>
            <Text style={styles.sectionText}>This job report doesn&apos;t have any content ready yet.</Text>
          </View>
        )}

        <Footer />
      </Page>
    </Document>
  );
}
