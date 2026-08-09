import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReportDocumentModel, paginatePhotos, PHOTOS_PER_PAGE } from "./report-document-model";
import type { JobReportContent, ReportContentPhoto } from "./report-content";

function emptyContent(overrides: Partial<JobReportContent> = {}): JobReportContent {
  return {
    jobDocId: "job-1",
    jobSummary: null,
    workPerformed: null,
    observations: [],
    photos: [],
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
