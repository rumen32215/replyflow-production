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

// Plumber Reset Phase 3 step 5 (autonomy tiers) — the deeper policy
// logic (Tier 1 eligibility conditions, the final tier decision, the
// prepared-action summary) is exercised directly and thoroughly by
// lib/reply-engine/autonomy/policy.test.ts and apply.test.ts; here
// these are controlled per-test so this file can verify generate-
// reply.ts's own orchestration — does it call the right things in the
// right order, gate auto-send correctly per tier, and write the right
// reply_drafts columns — without re-deriving the policy's own logic.
let nextToolDecision: { executed: unknown[]; escalateRequested: boolean; escalateReason: string | null } = {
  executed: [],
  escalateRequested: false,
  escalateReason: null,
};
let nextTier1Check: { applicable: boolean; eligible: boolean; reasons: string[] } = { applicable: false, eligible: false, reasons: [] };
let nextTier1Apply: { attempted: boolean; succeeded: boolean; reasons: string[] } = { attempted: false, succeeded: false, reasons: [] };
let nextAutonomyDecision: { tier: string; reasons: string[]; allowAutoSend: boolean } = {
  tier: "tier2_prepare",
  reasons: [],
  allowAutoSend: false,
};
let nextPreparedAction: { actionType: string; summary: string; payload: Record<string, unknown> } | null = null;
let sendCallCount = 0;

// Product Reset Blueprint D.1 — call spies for the two functions whose
// invocation (or non-invocation) IS the behaviour under test: a booked
// episode superseded by an unrelated request must never be abandoned,
// while a genuinely in-progress one still must be (existing behaviour).
let closeEpisodeCalls: Array<{ episodeId: string; status: string }> = [];
let createEpisodeCallCount = 0;
let createdEpisodeId = "unused-new-episode";

// Production hardening (2026-08-14) — a spy, not just a no-op: closing
// the silent-message-loss gap (the readiness gate used to be a bare
// `return`, with no draft and no trace) is only actually verified by
// asserting an event was recorded, not merely that the call didn't throw.
let recordedErrorEvents: Array<{ severity: string; source: string; context?: Record<string, unknown> }> = [];

// "server-only" throws unconditionally when required outside Next's own
// build pipeline (by design, as a guard) — harmless to no-op here since
// this test never runs in a browser context.
mock.module("server-only", { namedExports: {} });

mock.module("@/lib/supabase/service", {
  namedExports: { createServiceClient: () => currentSupabase },
});
mock.module("@/lib/error-events", {
  namedExports: {
    recordErrorEvent: async (input: { severity: string; source: string; context?: Record<string, unknown> }) => {
      recordedErrorEvents.push({ severity: input.severity, source: input.source, context: input.context });
    },
  },
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
// Plumber Reset Phase 3 step 4 — the tool-decision step is exercised
// directly by lib/reply-engine/tools/decide.test.ts against real
// execution logic; here it's a pure no-op so every existing scenario
// in this file keeps testing exactly what it already tested (draft/
// escalation/silence/auto-send behaviour), unaffected by the new step.
mock.module("./tools/decide", {
  namedExports: { decideAndExecuteTools: async () => nextToolDecision },
});
mock.module("./tools/execute", {
  namedExports: { findCurrentJob: async () => null },
});
mock.module("./autonomy/policy", {
  namedExports: {
    checkTier1Eligibility: () => nextTier1Check,
    decideAutonomy: () => nextAutonomyDecision,
    buildPreparedAction: () => nextPreparedAction,
  },
});
mock.module("./autonomy/apply", {
  namedExports: {
    applyTier1AutoConfirm: async () => nextTier1Apply,
    reflectConfirmedBooking: (toolResults: unknown[]) => toolResults,
  },
});
mock.module("@/lib/product-events", {
  namedExports: { recordProductEvent: async () => {} },
});
mock.module("./prompt/generate", {
  namedExports: { generateReplyDraft: async () => ({ generation: nextGeneration, facts: [] }) },
});
mock.module("./media-intake", {
  namedExports: { handleCustomerPhoto: async () => nextPhotoAnalysis },
});
mock.module("./send", {
  namedExports: {
    sendReplyToCustomer: async () => {
      sendCallCount += 1;
      return { ok: true };
    },
  },
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
    bookingAcceptance: "none",
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

/* -------- Production hardening (2026-08-14) — readiness-gate observability -------- */
// Live testing traced a real, silent message-loss bug to exactly this
// gate: a bare `return` with no draft and no error_events row, for a
// business that hasn't finished teaching its receptionist. This must
// stay silent to the customer (no invented reply) but never silent to
// observability (a real, queryable record of why nothing happened).

test("9. an untaught receptionist produces no draft but records an observable, non-customer-facing reason", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  // Override seedBusiness's fully-taught config — an empty receptionist
  // setup is exactly what makes Shared Brain's readyToActAlone false.
  currentSupabase.tables.ai_configurations = [
    {
      business_id: BUSINESS_ID,
      system_prompt: "",
      business_rules: "",
      escalation_rules: "",
      auto_reply_general_enabled: false,
    },
  ];
  recordedErrorEvents = [];
  const episodeId = "ep-untaught";
  nextEpisode = { id: episodeId, priorState: EMPTY_CONVERSATION_STATE, isNew: true, wasBookedCandidate: false };

  await generateReplyForMessage({
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    customerMessageId: "not-ready-msg",
    messageBody: "Hi, my boiler is leaking.",
  });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "not-ready-msg");
  assert.equal(draft, undefined, "no draft must be invented just to look like something happened");
  assert.equal(recordedErrorEvents.length, 1, "the outcome must be recorded exactly once");
  assert.equal(recordedErrorEvents[0]?.severity, "warning");
  assert.equal(recordedErrorEvents[0]?.source, "reply-engine.not_ready_to_act_alone");
  assert.equal(recordedErrorEvents[0]?.context?.customerMessageId, "not-ready-msg");
  assert.equal(recordedErrorEvents[0]?.context?.conversationId, CONVERSATION_ID);
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

// ---------------------------------------------------------------------
// Plumber Reset Phase 3 step 5 — Autonomy tiers.
//
// The deeper policy logic (exact Tier 1 eligibility conditions, the
// final tier decision, the prepared-action summary) is exercised
// directly by lib/reply-engine/autonomy/policy.test.ts and apply.test.ts.
// These tests verify generate-reply.ts's own orchestration: does it
// call the tool-decision/eligibility/apply steps in the right order,
// gate auto-send correctly per tier, and write the right reply_drafts
// audit columns — never trusting a drafted sentence alone.

function resetAutonomyMocks() {
  nextToolDecision = { executed: [], escalateRequested: false, escalateReason: null };
  nextTier1Check = { applicable: false, eligible: false, reasons: [] };
  nextTier1Apply = { attempted: false, succeeded: false, reasons: [] };
  nextAutonomyDecision = { tier: "tier2_prepare", reasons: [], allowAutoSend: false };
  nextPreparedAction = null;
  sendCallCount = 0;
}

function autonomyEpisode(id = "ep-autonomy") {
  return { id, priorState: EMPTY_CONVERSATION_STATE, isNew: false, wasBookedCandidate: false };
}

test("Autonomy — Tier 0: a safe, general question with auto-reply enabled is sent automatically", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_reply_general_enabled = true;
  resetAutonomyMocks();
  nextAutonomyDecision = { tier: "tier0_auto", reasons: ["safe"], allowAutoSend: true };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BUSINESS_INFORMATION" });
  nextGeneration = baseGeneration({ confidence: "high" });

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-tier0-a", messageBody: "Are you open on Saturdays?" });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-tier0-a");
  assert.equal(draft?.status, "sent");
  assert.equal(sendCallCount, 1);
  assert.equal(draft?.autonomy_tier, "tier0_auto");
});

test("Autonomy — Tier 0: a routine conversational follow-up (status check) with auto-reply enabled is sent automatically", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_reply_general_enabled = true;
  resetAutonomyMocks();
  nextAutonomyDecision = { tier: "tier0_auto", reasons: ["safe"], allowAutoSend: true };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "STATUS_CHECK" });
  nextGeneration = baseGeneration({ confidence: "high" });

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-tier0-b", messageBody: "Just checking in on my job." });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-tier0-b");
  assert.equal(draft?.status, "sent");
  assert.equal(sendCallCount, 1);
});

test("Autonomy — owner setting OFF: an explicitly accepted slot is proposed but never auto-confirmed", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase); // auto_confirm_bookings_enabled is not set — off by default
  resetAutonomyMocks();
  nextTier1Check = { applicable: true, eligible: false, reasons: ["automatic booking confirmation is not enabled for this business"] };
  nextAutonomyDecision = { tier: "tier2_prepare", reasons: nextTier1Check.reasons, allowAutoSend: false };
  nextPreparedAction = { actionType: "propose_booking", summary: "Sarah wants Tuesday at 10:00am. Job: leaking bathroom P-trap. Confirm booking?", payload: { start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T10:00:00.000Z", customerName: "Sarah" } };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BOOKING_REQUEST", bookingAcceptance: "explicit_accept" });
  nextGeneration = baseGeneration();

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-owner-off", messageBody: "10am works for me." });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-owner-off");
  assert.equal(draft?.status, "pending");
  assert.equal(sendCallCount, 0);
  assert.equal(draft?.autonomy_tier, "tier2_prepare");
  assert.equal(draft?.action_type, "propose_booking");
  assert.ok(String(draft?.action_summary ?? "").includes("Confirm booking?"));
});

test("Autonomy — owner setting ON: an explicitly accepted, genuinely available slot is confirmed and sent automatically", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_confirm_bookings_enabled = true;
  resetAutonomyMocks();
  nextTier1Check = { applicable: true, eligible: true, reasons: [] };
  nextTier1Apply = { attempted: true, succeeded: true, reasons: [] };
  nextAutonomyDecision = { tier: "tier1_auto_action", reasons: ["confirmed"], allowAutoSend: true };
  nextPreparedAction = { actionType: "confirm_booking", summary: "Sarah's booking for Tuesday 10:00am is confirmed.", payload: { start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T10:00:00.000Z", customerName: "Sarah" } };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BOOKING_REQUEST", bookingAcceptance: "explicit_accept" });
  nextGeneration = baseGeneration();

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-owner-on", messageBody: "10am works for me." });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-owner-on");
  assert.equal(draft?.status, "sent");
  assert.equal(sendCallCount, 1);
  assert.equal(draft?.autonomy_tier, "tier1_auto_action");
  assert.equal(draft?.action_type, "confirm_booking");
});

test("Autonomy — a booking request with no slot yet accepted never reaches Tier 1 and is never auto-sent", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_confirm_bookings_enabled = true;
  resetAutonomyMocks();
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BOOKING_REQUEST", bookingAcceptance: "asking_availability" });
  nextGeneration = baseGeneration();

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-no-accept", messageBody: "Can you come tomorrow?" });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-no-accept");
  assert.equal(draft?.status, "pending");
  assert.equal(sendCallCount, 0);
  assert.equal(draft?.action_type, null);
});

test("Autonomy — ambiguous acceptance ('sounds good' with no specific slot on the table) is never treated as explicit acceptance", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_confirm_bookings_enabled = true;
  resetAutonomyMocks();
  nextTier1Check = { applicable: true, eligible: false, reasons: ["customer has not explicitly accepted a specific slot (signal: expressing_preference)"] };
  nextAutonomyDecision = { tier: "tier2_prepare", reasons: nextTier1Check.reasons, allowAutoSend: false };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BOOKING_REQUEST", bookingAcceptance: "expressing_preference" });
  nextGeneration = baseGeneration();

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-ambiguous", messageBody: "Sounds good, mate." });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-ambiguous");
  assert.equal(draft?.status, "pending");
  assert.equal(sendCallCount, 0);
});

test("Autonomy — a slot accepted but subsequently unavailable: Tier 1 was eligible, the real confirm attempt failed, and the customer is never told it's confirmed", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_confirm_bookings_enabled = true;
  resetAutonomyMocks();
  nextTier1Check = { applicable: true, eligible: true, reasons: [] };
  nextTier1Apply = { attempted: true, succeeded: false, reasons: ["automatic confirmation attempt failed: conflict"] };
  nextAutonomyDecision = { tier: "tier2_prepare", reasons: nextTier1Apply.reasons, allowAutoSend: false };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BOOKING_REQUEST", bookingAcceptance: "explicit_accept" });
  nextGeneration = baseGeneration();

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-now-conflict", messageBody: "10am works." });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-now-conflict");
  assert.equal(draft?.status, "pending", "must never read as sent/confirmed once the real slot turned out to be unavailable");
  assert.equal(sendCallCount, 0);
  assert.equal(draft?.autonomy_tier, "tier2_prepare");
});

test("Autonomy — emergency: never auto-sent, always Tier 3, regardless of anything else", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_reply_general_enabled = true;
  currentSupabase.tables.ai_configurations[0]!.auto_confirm_bookings_enabled = true;
  resetAutonomyMocks();
  nextAutonomyDecision = { tier: "tier3_owner_required", reasons: ["the deterministic safety gate requires the owner's review"], allowAutoSend: false };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "EMERGENCY", meaningEntities: { urgency: "urgent", impliedJobType: null, sentiment: "negative" } });
  nextGeneration = baseGeneration({ requiresEscalation: true, escalationReason: "Emergency — water damage in progress." });

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-emergency", messageBody: "Water is coming through my ceiling!" });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-emergency");
  assert.equal(draft?.status, "pending");
  assert.equal(sendCallCount, 0);
  assert.equal(draft?.requires_escalation, true);
  assert.equal(draft?.autonomy_tier, "tier3_owner_required");
});

test("Autonomy — complaint: never auto-sent, always Tier 3", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_reply_general_enabled = true;
  resetAutonomyMocks();
  nextAutonomyDecision = { tier: "tier3_owner_required", reasons: ["the deterministic safety gate requires the owner's review"], allowAutoSend: false };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "COMPLAINT" });
  nextGeneration = baseGeneration({ requiresEscalation: true, escalationReason: "Customer unhappy with previous work." });

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-complaint", messageBody: "I'm really unhappy — the leak is back and I already paid." });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-complaint");
  assert.equal(draft?.status, "pending");
  assert.equal(sendCallCount, 0);
  assert.equal(draft?.autonomy_tier, "tier3_owner_required");
});

test("Autonomy — low-confidence interpretation is never auto-sent even in an otherwise-safe category", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_reply_general_enabled = true;
  resetAutonomyMocks();
  // Real safety.wouldAutoSend is false here (confidence "low" never
  // clears BUSINESS_INFORMATION's real "medium" minConfidence bar) —
  // Tier 0 eligibility is driven by the real safety layer, not the
  // mocked autonomy decision, so this proves the gate is genuinely
  // confidence-driven, not just following whatever the mock says.
  nextAutonomyDecision = { tier: "tier2_prepare", reasons: ["low confidence"], allowAutoSend: false };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BUSINESS_INFORMATION" });
  nextGeneration = baseGeneration({ confidence: "low" });

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-low-conf", messageBody: "Do you do boiler repairs too?" });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-low-conf");
  assert.equal(draft?.status, "pending");
  assert.equal(sendCallCount, 0);
});

test("Autonomy — a pricing request is never auto-sent, regardless of confidence", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_reply_general_enabled = true;
  resetAutonomyMocks();
  nextAutonomyDecision = { tier: "tier2_prepare", reasons: ["pricing always requires the owner"], allowAutoSend: false };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "PRICING_INQUIRY" });
  nextGeneration = baseGeneration({ confidence: "high" });

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-pricing", messageBody: "What's your call-out fee?" });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-pricing");
  assert.equal(draft?.status, "pending");
  assert.equal(sendCallCount, 0);
});

test("Autonomy — a reschedule request is prepared for the owner, never auto-executed even with auto-confirm enabled", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_confirm_bookings_enabled = true;
  resetAutonomyMocks();
  nextPreparedAction = { actionType: "reschedule_booking", summary: "Sarah wants Thursday at 2pm instead. Job: leaking tap. Confirm booking?", payload: { start: "2026-09-03T14:00:00.000Z", end: "2026-09-03T15:00:00.000Z", customerName: "Sarah" } };
  nextAutonomyDecision = { tier: "tier2_prepare", reasons: ["reschedule requires the owner"], allowAutoSend: false };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BOOKING_CHANGE", bookingAcceptance: "explicit_accept" });
  nextGeneration = baseGeneration();

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-reschedule", messageBody: "Can we move it to Thursday 2pm instead? Yes that works." });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-reschedule");
  assert.equal(draft?.status, "pending");
  assert.equal(sendCallCount, 0);
  assert.equal(draft?.action_type, "reschedule_booking");
});

test("Autonomy — a cancellation request is prepared for the owner, never auto-sent", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  resetAutonomyMocks();
  nextPreparedAction = { actionType: "cancel_booking", summary: "Sarah's booking for Tuesday 10:00am was cancelled.", payload: { start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T10:00:00.000Z", customerName: "Sarah" } };
  nextAutonomyDecision = { tier: "tier2_prepare", reasons: ["cancellation requires the owner"], allowAutoSend: false };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BOOKING_CANCELLATION" });
  nextGeneration = baseGeneration({ confidence: "verified" });

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-cancel", messageBody: "Please cancel my booking." });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-cancel");
  assert.equal(draft?.status, "pending");
  assert.equal(sendCallCount, 0);
  assert.equal(draft?.action_type, "cancel_booking");
});

test("Autonomy — a tool failure this turn never results in the customer being told an action succeeded", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_confirm_bookings_enabled = true;
  resetAutonomyMocks();
  nextToolDecision = {
    executed: [{ name: "create_booking", result: { ok: false, reason: "execution_failed" } }],
    escalateRequested: false,
    escalateReason: null,
  };
  nextAutonomyDecision = { tier: "tier2_prepare", reasons: ["does not qualify for automatic handling"], allowAutoSend: false };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BOOKING_REQUEST", bookingAcceptance: "explicit_accept" });
  nextGeneration = baseGeneration();

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-tool-fail", messageBody: "10am works." });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-tool-fail");
  assert.equal(draft?.status, "pending");
  assert.equal(sendCallCount, 0);
});

test("Autonomy — a booking-confirm failure (Tier 1 eligible but the real apply call failed) is logged and never auto-sent", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_confirm_bookings_enabled = true;
  resetAutonomyMocks();
  nextTier1Check = { applicable: true, eligible: true, reasons: [] };
  nextTier1Apply = { attempted: true, succeeded: false, reasons: ["automatic confirmation attempt failed: not_found"] };
  nextAutonomyDecision = { tier: "tier2_prepare", reasons: nextTier1Apply.reasons, allowAutoSend: false };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BOOKING_REQUEST", bookingAcceptance: "explicit_accept" });
  nextGeneration = baseGeneration();

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-confirm-fail", messageBody: "10am works." });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-confirm-fail");
  assert.equal(draft?.status, "pending");
  assert.equal(sendCallCount, 0);
});

test("Autonomy — the customer is never told a booking is confirmed unless Tier 1 genuinely succeeded (draft_text is only auto-sent on real success)", async () => {
  currentSupabase = new FakeSupabase();
  seedBusiness(currentSupabase);
  currentSupabase.tables.ai_configurations[0]!.auto_confirm_bookings_enabled = true;
  resetAutonomyMocks();
  nextTier1Check = { applicable: true, eligible: true, reasons: [] };
  nextTier1Apply = { attempted: true, succeeded: true, reasons: [] };
  nextAutonomyDecision = { tier: "tier1_auto_action", reasons: ["confirmed"], allowAutoSend: true };
  nextEpisode = autonomyEpisode();
  nextUnderstanding = baseUnderstanding({ primaryIntent: "BOOKING_REQUEST", bookingAcceptance: "explicit_accept" });
  nextGeneration = baseGeneration({ draftReply: "You're all booked in for Tuesday at 10am." });

  await generateReplyForMessage({ businessId: BUSINESS_ID, conversationId: CONVERSATION_ID, customerMessageId: "m-real-success", messageBody: "10am works." });

  const draft = currentSupabase.tables.reply_drafts.find((d) => d.customer_message_id === "m-real-success");
  assert.equal(draft?.status, "sent");
  assert.equal(sendCallCount, 1);
  assert.equal(draft?.draft_text, "You're all booked in for Tuesday at 10am.");
});
