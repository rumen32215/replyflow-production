import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { formatDate } from "@/lib/work-card-format";
import type { ReportDocumentModel } from "./report-document-model";

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
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  photoItem: {
    width: "47%",
    marginBottom: 14,
  },
  photoImage: {
    width: "100%",
    height: 150,
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
  const hasTextContent = Boolean(model.jobSummary || model.workPerformed || model.observations.length > 0);

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
        </View>

        {model.jobSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Job Summary</Text>
            <Text style={styles.sectionText}>{model.jobSummary.text}</Text>
          </View>
        )}

        {model.workPerformed && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Work Performed</Text>
            <Text style={styles.sectionText}>{model.workPerformed.text}</Text>
          </View>
        )}

        {model.observations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Observations</Text>
            {model.observations.map((observation, i) => (
              <View key={i} style={styles.observationRow}>
                <Text style={styles.observationBullet}>•</Text>
                <Text style={styles.observationText}>{observation.text}</Text>
              </View>
            ))}
          </View>
        )}

        {!hasTextContent && !model.hasPhotos && (
          <View style={styles.section}>
            <Text style={styles.sectionText}>This job report doesn&apos;t have any content ready yet.</Text>
          </View>
        )}

        <Footer />
      </Page>

      {model.photoPages.map((pagePhotos, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page} wrap>
          <RunningHeader businessName={header.businessName} jobTitle={jobDetails.title} />
          {pageIndex === 0 && (
            <Text style={styles.sectionLabel}>Photo Record</Text>
          )}
          <View style={styles.photoGrid}>
            {pagePhotos.map((photo) => (
              <View key={photo.id} style={styles.photoItem}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image is a PDF primitive, not an HTML img; it has no alt prop */}
                {photo.url && <Image src={photo.url} style={styles.photoImage} />}
                {photo.caption && <Text style={styles.photoCaption}>{photo.caption}</Text>}
              </View>
            ))}
          </View>
          <Footer />
        </Page>
      ))}
    </Document>
  );
}
