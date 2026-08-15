import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

/**
 * Plumber Reset Phase 3 step 6 — the unified photo/evidence read. Every
 * test here maps directly to a requirement from the brief: photos
 * belong to the correct Job, photos never leak between Jobs/customers,
 * and a WhatsApp-originated photo flows in without any manual copy
 * step. Exercised against a minimal in-memory fake of the Supabase
 * query builder — the same convention used throughout Phase 3.
 */

type Row = Record<string, unknown>;

class FakeQuery implements PromiseLike<{ data: unknown; error: null }> {
  private filters: Array<[string, unknown]> = [];

  constructor(private table: Row[]) {}

  select(_cols?: string) {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }

  private selected() {
    return this.table.filter((r) => this.filters.every(([col, val]) => r[col] === val));
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.selected(), error: null }).then(onfulfilled, onrejected);
  }
}

interface FakeTables {
  job_doc_photos: Row[];
  conversation_photos: Row[];
  messages: Row[];
  [key: string]: Row[];
}

class FakeSupabase {
  tables: FakeTables = { job_doc_photos: [], conversation_photos: [], messages: [] };
  from(name: string) {
    if (!this.tables[name]) this.tables[name] = [];
    return new FakeQuery(this.tables[name]);
  }
}

mock.module("server-only", { namedExports: {} });

let fetchJobPhotos: (typeof import("./job-evidence"))["fetchJobPhotos"];
before(async () => {
  ({ fetchJobPhotos } = await import("./job-evidence"));
});

test("no jobDocId and no episodeId returns nothing, never an error", async () => {
  const supabase = new FakeSupabase();
  const photos = await fetchJobPhotos(supabase as any, { jobDocId: null, episodeId: null });
  assert.deepEqual(photos, []);
});

test("a manually-uploaded job_doc_photos row is included, scoped to its own job_doc_id", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.job_doc_photos.push({
    id: "p1",
    job_doc_id: "doc-1",
    storage_path: "b/doc-1/p1.jpg",
    caption: "Before",
    phase: "before",
    sort_order: 0,
    visible_summary: "A leaking pipe",
    possible_summary: "",
    unknown_note: "",
    analysis_confidence: "medium",
    analyzed_at: "2026-08-10T09:00:00.000Z",
    created_at: "2026-08-10T09:00:00.000Z",
    included_in_report: true,
  });
  const photos = await fetchJobPhotos(supabase as any, { jobDocId: "doc-1", episodeId: null });
  assert.equal(photos.length, 1);
  assert.equal(photos[0]!.id, "p1");
});

test("a WhatsApp-analysed photo flows in from conversation_photos with no manual copy step", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.conversation_photos.push({
    id: "cp1",
    episode_id: "ep-1",
    message_id: "msg-1",
    storage_path: "customer-media/ep-1/msg-1.jpg",
    visible_summary: "Water pooling under the sink",
    possible_summary: "May be a loose pipe connection",
    unknown_note: "",
    analysis_confidence: "medium",
    created_at: "2026-08-10T09:05:00.000Z",
  });
  const photos = await fetchJobPhotos(supabase as any, { jobDocId: null, episodeId: "ep-1" });
  assert.equal(photos.length, 1);
  assert.equal(photos[0]!.visible_summary, "Water pooling under the sink");
  assert.ok(photos[0]!.analyzed_at, "a conversation_photos row's mere existence means it's already analysed");
});

test("a WhatsApp photo the owner has excluded from the report carries included_in_report: false through, not deleted or hidden here", async () => {
  // Real production bug (2026-08-15): a WhatsApp photo had no way to be
  // excluded from the report at all — this is the column (0037) and
  // plumbing that closes that gap. fetchJobPhotos itself stays
  // unfiltered (the owner-facing photo list and the report's own
  // selectPhotos() are the two places that decide what to do with the
  // flag), so this only asserts the value flows through correctly.
  const supabase = new FakeSupabase();
  supabase.tables.conversation_photos.push({
    id: "cp1",
    episode_id: "ep-1",
    message_id: "msg-1",
    storage_path: "customer-media/ep-1/msg-1.jpg",
    visible_summary: "An unrelated screenshot",
    possible_summary: "",
    unknown_note: "",
    analysis_confidence: "low",
    created_at: "2026-08-10T09:05:00.000Z",
    included_in_report: false,
  });
  const photos = await fetchJobPhotos(supabase as any, { jobDocId: null, episodeId: "ep-1" });
  assert.equal(photos.length, 1);
  assert.equal(photos[0]!.included_in_report, false);
});

test("a conversation_photos row with no included_in_report selected (an older caller) defaults to true, never a silent exclusion", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.conversation_photos.push({
    id: "cp1",
    episode_id: "ep-1",
    message_id: "msg-1",
    storage_path: "a.jpg",
    visible_summary: "A real job photo",
    possible_summary: "",
    unknown_note: "",
    analysis_confidence: "low",
    created_at: "2026-08-10T09:05:00.000Z",
    // included_in_report deliberately omitted
  });
  const photos = await fetchJobPhotos(supabase as any, { jobDocId: null, episodeId: "ep-1" });
  assert.equal(photos[0]!.included_in_report, true);
});

test("photos never leak between episodes — a different job's WhatsApp photos are excluded", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.conversation_photos.push(
    { id: "cp1", episode_id: "ep-this-job", message_id: "msg-1", storage_path: "a.jpg", visible_summary: "This job's photo", possible_summary: "", unknown_note: "", analysis_confidence: "low", created_at: "2026-08-10T09:00:00.000Z" },
    { id: "cp2", episode_id: "ep-other-job", message_id: "msg-2", storage_path: "b.jpg", visible_summary: "A different job entirely", possible_summary: "", unknown_note: "", analysis_confidence: "low", created_at: "2026-08-10T09:00:00.000Z" }
  );
  const photos = await fetchJobPhotos(supabase as any, { jobDocId: null, episodeId: "ep-this-job" });
  assert.equal(photos.length, 1);
  assert.equal(photos[0]!.visible_summary, "This job's photo");
});

test("photos never leak between job_docs — a different Job Record's manual uploads are excluded", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.job_doc_photos.push(
    { id: "p1", job_doc_id: "doc-this", storage_path: "a.jpg", caption: null, phase: "other", sort_order: 0, visible_summary: "", possible_summary: "", unknown_note: "", analysis_confidence: "low", analyzed_at: null, created_at: "2026-08-10T09:00:00.000Z", included_in_report: true },
    { id: "p2", job_doc_id: "doc-other", storage_path: "b.jpg", caption: null, phase: "other", sort_order: 0, visible_summary: "", possible_summary: "", unknown_note: "", analysis_confidence: "low", analyzed_at: null, created_at: "2026-08-10T09:00:00.000Z", included_in_report: true }
  );
  const photos = await fetchJobPhotos(supabase as any, { jobDocId: "doc-this", episodeId: null });
  assert.equal(photos.length, 1);
  assert.equal(photos[0]!.id, "p1");
});

test("an image message still awaiting/without analysis is represented honestly as unanalysed evidence, not invisible", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.messages.push({ id: "msg-pending", episode_id: "ep-1", message_type: "image", storage_path: "customer-media/ep-1/msg-pending.jpg", created_at: "2026-08-10T09:10:00.000Z" });
  const photos = await fetchJobPhotos(supabase as any, { jobDocId: null, episodeId: "ep-1" });
  assert.equal(photos.length, 1);
  assert.equal(photos[0]!.analyzed_at, null);
  assert.equal(photos[0]!.visible_summary, "");
});

test("an image message that already has a matching conversation_photos row is not duplicated as pending", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.messages.push({ id: "msg-1", episode_id: "ep-1", message_type: "image", storage_path: "a.jpg", created_at: "2026-08-10T09:00:00.000Z" });
  supabase.tables.conversation_photos.push({ id: "cp1", episode_id: "ep-1", message_id: "msg-1", storage_path: "a.jpg", visible_summary: "Analysed already", possible_summary: "", unknown_note: "", analysis_confidence: "low", created_at: "2026-08-10T09:00:00.000Z" });
  const photos = await fetchJobPhotos(supabase as any, { jobDocId: null, episodeId: "ep-1" });
  assert.equal(photos.length, 1, "the same photo must appear exactly once, not twice");
  assert.equal(photos[0]!.visible_summary, "Analysed already");
});

test("a non-image message with a storage_path (e.g. a document) is never treated as pending photo evidence", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.messages.push({ id: "msg-doc", episode_id: "ep-1", message_type: "document", storage_path: "a.pdf", created_at: "2026-08-10T09:00:00.000Z" });
  const photos = await fetchJobPhotos(supabase as any, { jobDocId: null, episodeId: "ep-1" });
  assert.equal(photos.length, 0);
});

test("manual uploads and WhatsApp photos for the same Job are unioned together", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.job_doc_photos.push({ id: "p1", job_doc_id: "doc-1", storage_path: "a.jpg", caption: "Manual", phase: "after", sort_order: 0, visible_summary: "", possible_summary: "", unknown_note: "", analysis_confidence: "low", analyzed_at: "2026-08-10T09:00:00.000Z", created_at: "2026-08-10T09:00:00.000Z", included_in_report: true });
  supabase.tables.conversation_photos.push({ id: "cp1", episode_id: "ep-1", message_id: "msg-1", storage_path: "b.jpg", visible_summary: "WhatsApp photo", possible_summary: "", unknown_note: "", analysis_confidence: "low", created_at: "2026-08-10T09:05:00.000Z" });
  const photos = await fetchJobPhotos(supabase as any, { jobDocId: "doc-1", episodeId: "ep-1" });
  assert.equal(photos.length, 2);
  assert.ok(photos.some((p) => p.caption === "Manual"));
  assert.ok(photos.some((p) => p.visible_summary === "WhatsApp photo"));
});
