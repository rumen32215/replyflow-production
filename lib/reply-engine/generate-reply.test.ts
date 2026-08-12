import { test, mock, before } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_CONVERSATION_STATE } from "./understanding/state";

/**
 * Regression coverage for the ReplyFlow V4 fix: three early-return
 * branches in generate-reply.ts (non-text/non-image, image with no
 * mediaId, image whose analysis failed) used to build their
 * attachment-acknowledgment draft without ever superseding an existing
 * pending draft in the same episode — a run of such messages left
 * several "pending" rows stacked up, and the Conversations UI (newest-
 * pending-first) surfaced whichever fallback happened to be last,
 * burying a real draft underneath. This file exercises the real
 * orchestrator (generateReplyForMessage), not a reimplementation of
 * it, against a minimal in-memory fake of the Supabase query builder —
 * every other module it calls (classification, generation, photo
 * intake, episode resolution) is mocked so these tests are pure and
 * fast, but the supersede/insert ordering itself is real production
 * code.
 */

// ---------------------------------------------------------------------
// A minimal fake of the subset of the Supabase query-builder chain
// generate-reply.ts actually uses: .select/.eq/.order/.limit/.maybeSingle
// (reads), .update/.eq/.eq (writes), .upsert(obj, {onConflict}) (writes).
// Both non-maybeSingle reads and writes are directly awaitable.

type Row = Record<string, unknown>;

class FakeQuery implements PromiseLike<{ data: unknown; error: null }> {
  private filters: Array<[string, unknown]> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private mode: "select" | "update" | "upsert" = "select";
  private writeObj: Row | null = null;
  private upsertOnConflict: string | null = null;

  constructor(private table: Row[]) {}

  select(_cols?: string) {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  update(obj: Row) {
    this.mode = "update";
    this.writeObj = obj;
    return this;
  }
  upsert(obj: Row, opts?: { onConflict?: string }) {
    this.mode = "upsert";
    this.writeObj = obj;
    this.upsertOnConflict = opts?.onConflict ?? null;
    return this;
  }

  private matches(row: Row) {
    return this.filters.every(([col, val]) => row[col] === val);
  }

  private selected() {
    let rows = this.table.filter((r) => this.matches(r));
    if (this.orderCol) {
      const col = this.orderCol;
      rows = [...rows].sort((a, b) => {
        const av = a[col] as string;
        const bv = b[col] as string;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return this.orderAsc ? cmp : -cmp;
      });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  async maybeSingle() {
    return { data: this.selected()[0] ?? null, error: null };
  }

  private async execute(): Promise<{ data: unknown; error: null }> {
    if (this.mode === "update") {
      for (const row of this.table) {
        if (this.matches(row)) Object.assign(row, this.writeObj);
      }
      return { data: null, error: null };
    }
    if (this.mode === "upsert") {
      const obj = this.writeObj!;
      const key = this.upsertOnConflict;
      const existing = key ? this.table.find((r) => r[key] === obj[key]) : undefined;
      if (existing) {
        Object.assign(existing, obj);
      } else {
        this.table.push({ id: `generated-${this.table.length}`, ...obj });
      }
      return { data: null, error: null };
    }
    return { data: this.selected(), error: null };
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

interface FakeTables {
  conversations: Row[];
  messages: Row[];
  reply_drafts: Row[];
  ai_configurations: Row[];
  businesses: Row[];
  [key: string]: Row[];
}

class FakeSupabase {
  tables: FakeTables = { conversations: [], messages: [], reply_drafts: [], ai_configurations: [], businesses: [] };
  from(name: string) {
    if (!this.tables[name]) this.tables[name] = [];
    return new FakeQuery(this.tables[name]);
  }
}

// ---------------------------------------------------------------------
// Module mocks — set up once, before generate-reply.ts is dynamically
// imported. `current*` are mutated per-call by each test.

let currentSupabase: FakeSupabase;
let nextEpisode: { id: string; priorState: unknown; isNew: boolean; wasBookedCandidate: boolean };
let nextUnderstanding: unknown;
let nextGeneration: unknown;
let nextPhotoAnalysis: { visible: string; possible: string; unknown: string } | null = null;

// Product Reset Blueprint D.1 — call spies for the two functions whose
// invocation (or non-invocation) IS the behaviour under test: a booked
// episode superseded by an unrelated request must never be abandoned,
// while a genuinely in-progress one still must be (existing behaviour).
let closeEpisodeCalls: Array<{ episodeId: string; status: string }> = [];
let createEpisodeCallCount = 0;
let createdEpisodeId = "unused-new-episode";

// "server-only" throws unconditionally when required outside Next's own
// build pipeline (by design, as a guard) — harmless to no-op here since
// this test never runs in a browser context.
mock.module("server-only", { namedExports: {} });

mock.module("@/lib/supabase/service", {
  namedExports: { createServiceClient: () => currentSupabase },
});
mock.module("@/lib/error-events", {
  namedExports: { recordErrorEvent: async () => {} },
});
mock.module("./episode", {
  namedExports: {
    resolveEpisodeForMessage: async () => nextEpisode,
    closeEpisode: async (_supabase: unknown, episodeId: string, status: string) => {
      closeEpisodeCalls.push({ episodeId, status });
    },
    createEpisode: async () => {
      createEpisodeCallCount += 1;
      return { id: createdEpisodeId };
    },
    updateEpisodeState: async () => {},
  },
});
mock.module("./understanding", {
  namedExports: {
    classifyMessage: async () => nextUnderstanding,
    resolveContextNeeds: () => ({
      businessProfile: false,
      receptionistRules: false,
      diary: false,
      customerMemory: false,
      conversationHistory: false,
      customerJobs: false,
    }),
    EMPTY_CONVERSATION_STATE,
    toConversationState: (raw: unknown) => raw ?? EMPTY_CONVERSATION_STATE,
  },
});
mock.module("./context/assemble", {
  namedExports: { assembleContext: async () => ({}) },
});
mock.module("./prompt/generate", {
  namedExports: { generateReplyDraft: async () => ({ generation: nextGeneration, facts: [] }) },
});
mock.module("./media-intake", {
  namedExports: { handleCustomerPhoto: async () => nextPhotoAnalysis },
});
mock.module("./send", {
  namedExports: { sendReplyToCustomer: async () => ({ ok: true }) },
});

let generateReplyForMessage: (typeof import("./generate-reply"))["generateReplyForMessage"];
before(async () => {
  ({ generateReplyForMessage } = await import("./generate-reply"));
});

// ---------------------------------------------------------------------

function baseUnderstanding(overrides: Record<string, unknown> = {}) {
  return {
    primaryIntent: "BOOKING_REQUEST",
    secondaryIntents: [],
    confidence: "high",
    patternEntities: { phoneNumbers: [], postcodes: [], emails: [], explicitDates: [] },
    meaningEntities: { urgency: "none", impliedJobType: null, sentiment: "neutral" },
    safetyTag: null,
    conversationState: EMPTY_CONVERSATION_STATE,
    episodeContinuity: "same_job",
    ...overrides,
  };
}

function baseGeneration(overrides: Record<string, unknown> = {}) {
  return {
    draftReply: "Thanks — I'll get someone to check that out and confirm a time.",
    confidence: "high",
    requiresEscalation: false,
    escalationReason: null,
    factsUsed: [],
    noReplyNeeded: false,
    asksQuestion: null,
    resolvesCommitments: [],
    ...overrides,
  };
}

const BUSINESS_ID = "biz-1";
const CONVERSATION_ID = "conv-1";

/** Seeds the fake tables every test needs regardless of scenario. */
function seedBusiness(supabase: FakeSupabase) {
  supabase.tables.conversations = [
    { id: CONVERSATION_ID, customer_phone: "+447700900123", customer_name: "Test Customer", created_at: "2026-01-01T00:00:00Z" },
  ];
  supabase.tables.ai_configurations = [
    {
      business_id: BUSINESS_ID,
      system_prompt: "Be helpful.",
      business_rules: "Charge a callout fee.",
      escalation_rules: "Escalate emergencies.",
      auto_reply_general_enabled: false,
    },
  ];
  supabase.tables.businesses = [{ id: BUSINESS_ID, trade: "plumbing" }];
  supabase.tables.reply_drafts = [];
  supabase.tables.messages = [];
}

function seedPendingDraft(supabase: FakeSupabase, opts: { episodeId: string; customerMessageId: string; draftId: string }) {
  supabase.tables.reply_drafts.push({
    id: opts.draftId,
    business_id: BUSINESS_ID,
    conversation_id: CONVERSATION_ID,
    episode_id: opts.episodeId,
    customer_message_id: opts.customerMessageId,
    status: "pending",
    draft_text: "An older draft.",
    intent: "UNCLEAR",
  });
}

function draftsIn(supabase: FakeSupabase, episodeId?: string) {
  return supabase.tables.reply_drafts.filter((d) => !episodeId || d.episode_id === episodeId);
}

function statusOf(supabase: FakeSupabase, draftId: string) {
  return supabase.tables.reply_drafts.find((d) => d.id === draftId)?.status;
}

// ---------------------------------------------------------------------

test("1. a normal text message supersedes the previous pending draft", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  const episodeId = "ep-1";
  seedPendingDraft(currentSupabase, { episodeId, customerMessageId: "old-msg", draftId: "old-draft" });
  nextEpisode = { id: episodeId, priorState: EMPTY_CONVERSATION_STATE, isNew: false, wasBookedCandidate: false };
  nextUnderstanding = baseUnderstanding();
  nextGeneration = baseGeneration();

  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "new-text-msg",
    messageBody: "Hi, my boiler is leaking.",
  });

  assert.equal(statusOf(currentSupabase, "old-draft"), "superseded");
  const newDraft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "new-text-msg");
  assert.equal(newDraft?.status, "pending");
});

test("2. a non-text/unsupported message supersedes the previous pending draft before creating its fallback draft", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  const episodeId = "ep-1";
  seedPendingDraft(currentSupabase, { episodeId, customerMessageId: "old-msg", draftId: "old-draft" });
  nextEpisode = { id: episodeId, priorState: EMPTY_CONVERSATION_STATE, isNew: false, wasBookedCandidate: false };

  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "unsupported-msg",
    messageBody: "[unsupported message]",
    messageType: "video",
  });

  assert.equal(statusOf(currentSupabase, "old-draft"), "superseded");
  const fallback = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "unsupported-msg");
  assert.equal(fallback?.status, "pending");
  assert.match(String(fallback?.draft_text), /not able to view attachments/i);
});

test("3. an image with no mediaId supersedes the previous pending draft before creating its fallback draft", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  const episodeId = "ep-1";
  seedPendingDraft(currentSupabase, { episodeId, customerMessageId: "old-msg", draftId: "old-draft" });
  nextEpisode = { id: episodeId, priorState: EMPTY_CONVERSATION_STATE, isNew: false, wasBookedCandidate: false };

  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "no-media-msg",
    messageBody: "[image message]",
    messageType: "image",
    mediaId: null,
  });

  assert.equal(statusOf(currentSupabase, "old-draft"), "superseded");
  const fallback = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "no-media-msg");
  assert.equal(fallback?.status, "pending");
});

test("4. an image whose media processing returns null supersedes the previous pending draft before creating its fallback draft", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  const episodeId = "ep-1";
  seedPendingDraft(currentSupabase, { episodeId, customerMessageId: "old-msg", draftId: "old-draft" });
  nextEpisode = { id: episodeId, priorState: EMPTY_CONVERSATION_STATE, isNew: false, wasBookedCandidate: false };
  nextPhotoAnalysis = null; // simulates handleCustomerPhoto failing (download/auth/analysis error)

  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "failed-photo-msg",
    messageBody: "[image message]",
    messageType: "image",
    mediaId: "media-abc",
  });

  assert.equal(statusOf(currentSupabase, "old-draft"), "superseded");
  const fallback = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "failed-photo-msg");
  assert.equal(fallback?.status, "pending");
});

test("5. multiple consecutive failed/unsupported image messages leave only the newest draft pending", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  const episodeId = "ep-1";
  nextEpisode = { id: episodeId, priorState: EMPTY_CONVERSATION_STATE, isNew: false, wasBookedCandidate: false };
  nextPhotoAnalysis = null;

  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "img-1",
    messageBody: "[image message]",
    messageType: "image",
    mediaId: "media-1",
  });
  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "img-2",
    messageBody: "[image message]",
    messageType: "image",
    mediaId: "media-2",
  });
  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "img-3",
    messageBody: "[unsupported message]",
    messageType: "video",
  });

  const drafts = draftsIn(currentSupabase, episodeId);
  const pending = drafts.filter((d) => d.status === "pending");
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.customer_message_id, "img-3");
  assert.equal(drafts.find((d) => d.customer_message_id === "img-1")?.status, "superseded");
  assert.equal(drafts.find((d) => d.customer_message_id === "img-2")?.status, "superseded");
});

test("6. a valid BOOKING_REQUEST draft cannot be buried underneath older pending fallback drafts", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  const episodeId = "ep-1";
  nextEpisode = { id: episodeId, priorState: EMPTY_CONVERSATION_STATE, isNew: false, wasBookedCandidate: false };

  // A failed photo lands first, exactly like the live incident.
  nextPhotoAnalysis = null;
  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "img-1",
    messageBody: "[image message]",
    messageType: "image",
    mediaId: "media-1",
  });

  // Then the customer's real request arrives as text.
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BOOKING_REQUEST" });
  nextGeneration = baseGeneration({ draftReply: "Sure — what time works for the visit?" });
  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "text-1",
    messageBody: "Hi, I've got a leaking toilet, can someone come out?",
  });

  const drafts = draftsIn(currentSupabase, episodeId);
  const pending = drafts.filter((d) => d.status === "pending");
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.customer_message_id, "text-1");
  assert.equal(pending[0]?.intent, "BOOKING_REQUEST");
  assert.equal(drafts.find((d) => d.customer_message_id === "img-1")?.status, "superseded");
});

test("7. drafts belonging to a different episode are never superseded", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  const episodeA = "ep-A";
  const episodeB = "ep-B";
  seedPendingDraft(currentSupabase, { episodeId: episodeA, customerMessageId: "old-in-a", draftId: "draft-a" });

  nextEpisode = { id: episodeB, priorState: EMPTY_CONVERSATION_STATE, isNew: true, wasBookedCandidate: false };
  nextPhotoAnalysis = null;
  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "new-in-b",
    messageBody: "[image message]",
    messageType: "image",
    mediaId: "media-9",
  });

  assert.equal(statusOf(currentSupabase, "draft-a"), "pending", "a different episode's pending draft must be untouched");
  const newDraft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "new-in-b");
  assert.equal(newDraft?.episode_id, episodeB);
  assert.equal(newDraft?.status, "pending");
});

test("8. the current newly-created draft remains pending and is not accidentally superseded", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  const episodeId = "ep-1";
  seedPendingDraft(currentSupabase, { episodeId, customerMessageId: "old-msg", draftId: "old-draft" });
  nextEpisode = { id: episodeId, priorState: EMPTY_CONVERSATION_STATE, isNew: false, wasBookedCandidate: false };
  nextUnderstanding = baseUnderstanding();
  nextGeneration = baseGeneration();

  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "brand-new-msg",
    messageBody: "Any update on my booking?",
  });

  const own = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "brand-new-msg");
  assert.ok(own, "the current message's own draft must exist");
  assert.equal(own?.status, "pending", "supersede runs before this row is inserted, so it must never catch its own draft");
});

/* -------- Product Reset Blueprint D.1 — booked-episode continuity -------- */
// resolveEpisodeForMessage itself (which episode.test.ts covers directly)
// is mocked here via `nextEpisode` — these tests exercise what
// generate-reply.ts's orchestrator DOES with a wasBookedCandidate
// episode: whether it stays attached, and critically, whether a
// superseding "new_job" verdict ever abandons a real booked job.

test("A. booked job + same-job text reply stays attached to the existing episode", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  closeEpisodeCalls = [];
  createEpisodeCallCount = 0;
  const bookedEpisodeId = "ep-booked";
  nextEpisode = { id: bookedEpisodeId, priorState: EMPTY_CONVERSATION_STATE, isNew: false, wasBookedCandidate: true };
  nextUnderstanding = baseUnderstanding({ primaryIntent: "RETURNING_PROBLEM", episodeContinuity: "same_job" });
  nextGeneration = baseGeneration({ draftReply: "Thanks — I'll pass that on to the team ahead of tomorrow's visit." });

  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "followup-text",
    messageBody: "Just to add — it's worse than I thought, there's water pooling now too.",
  });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "followup-text");
  assert.equal(draft?.episode_id, bookedEpisodeId);
  assert.equal(closeEpisodeCalls.length, 0, "the booked episode must never be closed for a same_job follow-up");
  assert.equal(createEpisodeCallCount, 0, "no new episode should be created for a same_job follow-up");
});

test("B. booked job + same-job photo stays attached to the existing episode, and Photo Intelligence still runs", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  closeEpisodeCalls = [];
  createEpisodeCallCount = 0;
  const bookedEpisodeId = "ep-booked";
  nextEpisode = { id: bookedEpisodeId, priorState: EMPTY_CONVERSATION_STATE, isNew: false, wasBookedCandidate: true };
  nextPhotoAnalysis = {
    visible: "Water pooling around the base of a sink cabinet, a plumbing fitting visibly dripping.",
    possible: "May indicate a loose or failed fitting connection.",
    unknown: "Exact cause cannot be confirmed from the photo alone.",
  };
  nextUnderstanding = baseUnderstanding({ primaryIntent: "RETURNING_PROBLEM", episodeContinuity: "same_job" });
  nextGeneration = baseGeneration({ draftReply: "Thanks for the photo — that's really helpful ahead of tomorrow's visit." });

  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "followup-photo",
    messageBody: "[image message]",
    messageType: "image",
    mediaId: "media-followup",
  });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "followup-photo");
  assert.equal(draft?.episode_id, bookedEpisodeId, "the photo's draft must stay on the booked job's episode");
  assert.equal(closeEpisodeCalls.length, 0);
  assert.equal(createEpisodeCallCount, 0);
});

test("C. booked job + a genuinely unrelated new request creates a new episode WITHOUT abandoning the booked one", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  closeEpisodeCalls = [];
  createEpisodeCallCount = 0;
  createdEpisodeId = "ep-fresh";
  const bookedEpisodeId = "ep-booked";
  nextEpisode = { id: bookedEpisodeId, priorState: EMPTY_CONVERSATION_STATE, isNew: false, wasBookedCandidate: true };
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BOOKING_REQUEST", episodeContinuity: "new_job" });
  nextGeneration = baseGeneration({ draftReply: "Sure — when would you like someone to look at that?" });

  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "unrelated-request",
    messageBody: "Different question — my electric shower has also stopped working, can someone look at that too?",
  });

  assert.equal(createEpisodeCallCount, 1, "a genuinely unrelated request must open a new episode");
  assert.equal(
    closeEpisodeCalls.length,
    0,
    "the booked episode is a real, valid future appointment and must never be marked abandoned just because a later message is about something else"
  );
  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "unrelated-request");
  assert.equal(draft?.episode_id, "ep-fresh");
  assert.notEqual(draft?.episode_id, bookedEpisodeId);
});

test("F. an in-progress (not booked) episode superseded by a new_job verdict is still abandoned, exactly as before", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  closeEpisodeCalls = [];
  createEpisodeCallCount = 0;
  createdEpisodeId = "ep-fresh-2";
  const inProgressEpisodeId = "ep-in-progress";
  nextEpisode = { id: inProgressEpisodeId, priorState: EMPTY_CONVERSATION_STATE, isNew: false, wasBookedCandidate: false };
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BOOKING_REQUEST", episodeContinuity: "new_job" });
  nextGeneration = baseGeneration();

  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "new-topic",
    messageBody: "Actually, different issue — my toilet is now leaking too.",
  });

  assert.deepEqual(closeEpisodeCalls, [{ episodeId: inProgressEpisodeId, status: "abandoned" }]);
  assert.equal(createEpisodeCallCount, 1);
});

test("G. supersede/safety behaviour composes correctly with a booked-episode continuity resolution", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  closeEpisodeCalls = [];
  createEpisodeCallCount = 0;
  const bookedEpisodeId = "ep-booked";
  seedPendingDraft(currentSupabase, { episodeId: bookedEpisodeId, customerMessageId: "stale-msg", draftId: "stale-draft" });
  nextEpisode = { id: bookedEpisodeId, priorState: EMPTY_CONVERSATION_STATE, isNew: false, wasBookedCandidate: true };
  nextUnderstanding = baseUnderstanding({ primaryIntent: "RETURNING_PROBLEM", episodeContinuity: "same_job" });
  nextGeneration = baseGeneration();

  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "followup-2",
    messageBody: "One more thing about that same leak.",
  });

  // The existing supersede fix still fires normally for this episode.
  assert.equal(statusOf(currentSupabase, "stale-draft"), "superseded");
  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "followup-2");
  assert.equal(draft?.status, "pending");
  assert.equal(draft?.episode_id, bookedEpisodeId);
});
