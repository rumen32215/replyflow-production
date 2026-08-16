import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReportDocumentModel, paginatePhotos, pickPhotoLayout, PHOTOS_PER_PAGE } from "./report-document-model";
import type { JobReportContent, ReportContentPhoto } from "./report-content";

function emptyContent(overrides: Partial<JobReportContent> = {}): JobReportContent {
  return {
    jobDocId: "job-1",
    isJobCompleted: false,
    issueReported: null,
    jobSummary: null,
    workPerformed: null,
    nextSteps: null,
    observations: [],
    photos: [],
    charges: null,
    ...overrides,
  };
}

function photo(overrides: Partial<ReportContentPhoto> = {}): ReportContentPhoto {
  return {
    id: "photo-id",
    storagePath: "business-1/job-1/photo-id.jpg",
    caption: "Before repair",
    phase: "before",
    visibleSummary: "",
    possibleSummary: "",
    unknownNote: "",
    confidence: "medium",
    analyzed: true,
    ...overrides,
  };
}

const BUSINESS = { businessName: "Acme Plumbing", phone: "07700 900123", logoUrl: "https://example.com/logo.png", trade: "plumbing" };
const JOB_DOC = { title: "Radiator repair", customerName: "Jane Smith", jobAddress: "1 High Street", jobDate: "2026-08-01T09:00:00.000Z" };
const NO_PHOTO_URLS: ReadonlyMap<string, string | null> = new Map();

test("customer/job data (header + job details) is carried through unchanged", () => {
  const model = buildReportDocumentModel({ jobDocId: "job-1", business: BUSINESS, jobDoc: JOB_DOC, content: emptyContent(), photoUrls: NO_PHOTO_URLS });
  assert.deepEqual(model.header, {
    businessName: "Acme Plumbing",
    businessPhone: "07700 900123",
    logoUrl: "https://example.com/logo.png",
    trade: "plumbing",
  });
  assert.deepEqual(model.jobDetails, {
    title: "Radiator repair",
    customerName: "Jane Smith",
    jobAddress: "1 High Street",
    jobDate: "2026-08-01T09:00:00.000Z",
  });
});

test("selected report content (job summary, work performed, observations) passes through verbatim", () => {
  const content = emptyContent({
    jobSummary: { text: "Repaired a leaking valve.", provenance: "ai_structured" },
    workPerformed: { text: "Replaced the valve.", provenance: "user_fact" },
    observations: [{ text: "No further leaks found.", provenance: "ai_structured" }],
  });
  const model = buildReportDocumentModel({ jobDocId: "job-1", business: BUSINESS, jobDoc: JOB_DOC, content, photoUrls: NO_PHOTO_URLS });
  assert.deepEqual(model.jobSummary, { text: "Repaired a leaking valve.", provenance: "ai_structured" });
  assert.deepEqual(model.workPerformed, { text: "Replaced the valve.", provenance: "user_fact" });
  assert.deepEqual(model.observations, [{ text: "No further leaks found.", provenance: "ai_structured" }]);
});

test("isJobCompleted, issueReported, and nextSteps pass through verbatim (production hardening, 2026-08-14)", () => {
  const content = emptyContent({
    isJobCompleted: true,
    issueReported: "Leaking toilet.",
    nextSteps: { text: "Follow-up in 6 months.", provenance: "ai_structured" },
  });
  const model = buildReportDocumentModel({ jobDocId: "job-1", business: BUSINESS, jobDoc: JOB_DOC, content, photoUrls: NO_PHOTO_URLS });
  assert.equal(model.isJobCompleted, true);
  assert.equal(model.issueReported, "Leaking toilet.");
  assert.deepEqual(model.nextSteps, { text: "Follow-up in 6 months.", provenance: "ai_structured" });
});

test("content already excluded upstream (null fields) stays excluded — the model never invents a fallback", () => {
  const model = buildReportDocumentModel({ jobDocId: "job-1", business: BUSINESS, jobDoc: JOB_DOC, content: emptyContent(), photoUrls: NO_PHOTO_URLS });
  assert.equal(model.jobSummary, null);
  assert.equal(model.workPerformed, null);
  assert.deepEqual(model.observations, []);
});

test("empty sections (no fields, no photos) behave cleanly: no photo pages, hasPhotos false", () => {
  const model = buildReportDocumentModel({ jobDocId: "job-1", business: BUSINESS, jobDoc: JOB_DOC, content: emptyContent(), photoUrls: NO_PHOTO_URLS });
  assert.deepEqual(model.photoPages, []);
  assert.equal(model.hasPhotos, false);
});

test("photos already selected/ordered by selectReportContent are carried through into pagination unchanged", () => {
  const photos = [photo({ id: "p1", phase: "before" }), photo({ id: "p2", phase: "during" }), photo({ id: "p3", phase: "after" })];
  const model = buildReportDocumentModel({ jobDocId: "job-1", business: BUSINESS, jobDoc: JOB_DOC, content: emptyContent({ photos }), photoUrls: NO_PHOTO_URLS });
  assert.equal(model.hasPhotos, true);
  assert.deepEqual(
    model.photoPages.flat().map((p) => p.id),
    ["p1", "p2", "p3"]
  );
});

test("paginatePhotos: zero photos produces zero pages, not one empty page", () => {
  assert.deepEqual(paginatePhotos([]), []);
});

test("paginatePhotos: a photo count under one page's capacity produces exactly one page", () => {
  const photos = Array.from({ length: PHOTOS_PER_PAGE - 1 }, (_, i) => `photo-${i}`);
  const pages = paginatePhotos(photos);
  assert.equal(pages.length, 1);
  assert.equal(pages[0]?.length, PHOTOS_PER_PAGE - 1);
});

test("paginatePhotos: a photo count exactly at one page's capacity produces exactly one page", () => {
  const photos = Array.from({ length: PHOTOS_PER_PAGE }, (_, i) => `photo-${i}`);
  const pages = paginatePhotos(photos);
  assert.equal(pages.length, 1);
  assert.equal(pages[0]?.length, PHOTOS_PER_PAGE);
});

test("paginatePhotos: one photo over capacity spills a second page rather than overflowing the first", () => {
  const photos = Array.from({ length: PHOTOS_PER_PAGE + 1 }, (_, i) => `photo-${i}`);
  const pages = paginatePhotos(photos);
  assert.equal(pages.length, 2);
  assert.equal(pages[0]?.length, PHOTOS_PER_PAGE);
  assert.equal(pages[1]?.length, 1);
});

test("paginatePhotos: a larger set splits into full pages in original order, never reordered", () => {
  const photos = Array.from({ length: PHOTOS_PER_PAGE * 2 + 3 }, (_, i) => `photo-${i}`);
  const pages = paginatePhotos(photos);
  assert.equal(pages.length, 3);
  assert.equal(pages[0]?.length, PHOTOS_PER_PAGE);
  assert.equal(pages[1]?.length, PHOTOS_PER_PAGE);
  assert.equal(pages[2]?.length, 3);
  assert.deepEqual(pages.flat(), photos);
});

test("missing optional header/job-detail facts (no logo, no phone, no address) are passed through as null, never invented", () => {
  const model = buildReportDocumentModel({
    jobDocId: "job-1",
    business: { businessName: "Acme Plumbing", phone: null, logoUrl: null, trade: null },
    jobDoc: { title: "Radiator repair", customerName: null, jobAddress: null, jobDate: null },
    content: emptyContent(),
    photoUrls: NO_PHOTO_URLS,
  });
  assert.equal(model.header.logoUrl, null);
  assert.equal(model.header.businessPhone, null);
  assert.equal(model.jobDetails.jobAddress, null);
  assert.equal(model.jobDetails.customerName, null);
});

test("a photo's storagePath is resolved to its signed URL via the photoUrls lookup", () => {
  const photos = [photo({ id: "p1" })];
  const model = buildReportDocumentModel({
    jobDocId: "job-1",
    business: BUSINESS,
    jobDoc: JOB_DOC,
    content: emptyContent({ photos }),
    photoUrls: new Map([["p1", "https://signed.example.com/p1.jpg"]]),
  });
  assert.equal(model.photoPages[0]?.[0]?.url, "https://signed.example.com/p1.jpg");
});

test("a photo missing from the photoUrls lookup resolves to url: null, not an error", () => {
  const photos = [photo({ id: "p1" })];
  const model = buildReportDocumentModel({
    jobDocId: "job-1",
    business: BUSINESS,
    jobDoc: JOB_DOC,
    content: emptyContent({ photos }),
    photoUrls: NO_PHOTO_URLS,
  });
  assert.equal(model.photoPages[0]?.[0]?.url, null);
});

test("charges (0038) is carried through from content to the document model verbatim", () => {
  const model = buildReportDocumentModel({
    jobDocId: "job-1",
    business: BUSINESS,
    jobDoc: JOB_DOC,
    content: emptyContent({ charges: { labour: 80, materials: 20, total: 100 } }),
    photoUrls: NO_PHOTO_URLS,
  });
  assert.deepEqual(model.charges, { labour: 80, materials: 20, total: 100 });
});

test("charges is null on the model when the job has none, not an empty object", () => {
  const model = buildReportDocumentModel({
    jobDocId: "job-1",
    business: BUSINESS,
    jobDoc: JOB_DOC,
    content: emptyContent(),
    photoUrls: NO_PHOTO_URLS,
  });
  assert.equal(model.charges, null);
});

/* -------- pickPhotoLayout (PDF reflow, production test, 2026-08-16) -------- */

test("pickPhotoLayout: 0 photos falls back to the same single-column treatment as 1 (never rendered, but must not throw or misbehave)", () => {
  assert.deepEqual(pickPhotoLayout(0), { columns: 1, widthPercent: "100%", heightPt: 320 });
});

test("pickPhotoLayout: 1 photo gets a large, single-column treatment", () => {
  assert.deepEqual(pickPhotoLayout(1), { columns: 1, widthPercent: "100%", heightPt: 320 });
});

test("pickPhotoLayout: 2 photos share two columns", () => {
  const layout = pickPhotoLayout(2);
  assert.equal(layout.columns, 2);
});

test("pickPhotoLayout: 4 photos still uses two columns (a 2x2 grid), not three", () => {
  const layout = pickPhotoLayout(4);
  assert.equal(layout.columns, 2);
});

test("pickPhotoLayout: 5 photos switches to three, denser columns", () => {
  const layout = pickPhotoLayout(5);
  assert.equal(layout.columns, 3);
});

test("pickPhotoLayout: a lone photo is sized larger (taller) than a dense multi-photo grid", () => {
  const solo = pickPhotoLayout(1);
  const dense = pickPhotoLayout(6);
  assert.ok(solo.heightPt > dense.heightPt, "a single photo should get more visual space than one of many");
});

test("pickPhotoLayout: widthPercent values are valid CSS percentages for every bucket", () => {
  for (const count of [0, 1, 2, 3, 4, 5, 6, 10]) {
    assert.match(pickPhotoLayout(count).widthPercent, /^\d+(\.\d+)?%$/);
  }
});
