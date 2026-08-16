import { test, mock, before } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_CONVERSATION_STATE } from "../understanding/state";

/**
 * Integration coverage for decideAndExecuteTools — the real decide ->
 * validate -> execute -> real booking engine chain, with only the LLM
 * client mocked (a controlled, per-test canned response standing in
 * for what the model would have returned) and a fake Supabase (same
 * convention as execute.test.ts / booking/engine.test.ts). These are
 * the exact scenarios the Phase 3 step 4 brief asked to be proven:
 * general question -> no tool call, returning customer ->
 * get_customer_context, a described problem -> job created, an
 * appointment request -> check_availability, an accepted slot ->
 * booking created, an unavailable slot -> no booking + alternatives,
 * a move request -> update_booking, emergency/complaint -> escalate
 * instead of a normal flow, an ambiguous request -> no invented
 * action, and a tool failure -> never reads as success.
 */

type Row = Record<string, unknown>;
type Op = "eq" | "neq" | "in" | "lt" | "gt" | "is";
interface Filter {
  col: string;
  op: Op;
  val: unknown;
}

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: Filter[] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private mode: "select" | "insert" | "update" = "select";
  private writeObj: Row | null = null;

  constructor(private table: Row[], private tableName: string) {}

  select(_cols?: string) {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col, op: "eq", val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push({ col, op: "neq", val });
    return this;
  }
  in(col: string, vals: readonly unknown[]) {
    this.filters.push({ col, op: "in", val: vals });
    return this;
  }
  lt(col: string, val: unknown) {
    this.filters.push({ col, op: "lt", val });
    return this;
  }
  gt(col: string, val: unknown) {
    this.filters.push({ col, op: "gt", val });
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push({ col, op: "is", val });
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
  insert(obj: Row) {
    this.mode = "insert";
    this.writeObj = obj;
    return this;
  }
  update(obj: Row) {
    this.mode = "update";
    this.writeObj = obj;
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      const rowVal = row[f.col];
      switch (f.op) {
        case "eq":
          return rowVal === f.val;
        case "neq":
          return rowVal !== f.val;
        case "in":
          return (f.val as unknown[]).includes(rowVal);
        case "lt":
          return String(rowVal) < String(f.val);
        case "gt":
          return String(rowVal) > String(f.val);
        case "is":
          return f.val === null ? rowVal === null || rowVal === undefined : rowVal === f.val;
      }
    });
  }

  private selected(): Row[] {
    let rows = this.table.filter((r) => this.matches(r));
    if (this.orderCol) {
      const col = this.orderCol;
      rows = [...rows].sort((a, b) => {
        const av = String(a[col] ?? "");
        const bv = String(b[col] ?? "");
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return this.orderAsc ? cmp : -cmp;
      });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  async maybeSingle() {
    if (this.mode === "insert") {
      const row: Row = { id: `${this.tableName}-${this.table.length + 1}`, reschedule_of_id: null, confirmed_at: null, cancelled_at: null, ...this.writeObj };
      this.table.push(row);
      return { data: row, error: null };
    }
    if (this.mode === "update") {
      const matched = this.table.filter((r) => this.matches(r));
      for (const row of matched) Object.assign(row, this.writeObj);
      return { data: matched[0] ?? null, error: null };
    }
    return { data: this.selected()[0] ?? null, error: null };
  }

  async single() {
    return this.maybeSingle();
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const run = async () => {
      if (this.mode === "update") {
        const matched = this.table.filter((r) => this.matches(r));
        for (const row of matched) Object.assign(row, this.writeObj);
        return { data: matched, error: null };
      }
      if (this.mode === "insert") {
        const row: Row = { id: `${this.tableName}-${this.table.length + 1}`, ...this.writeObj };
        this.table.push(row);
        return { data: [row], error: null };
      }
      return { data: this.selected(), error: null };
    };
    return run().then(onfulfilled, onrejected);
  }
}

interface FakeTables {
  work_cards: Row[];
  customers: Row[];
  bookings: Row[];
  businesses: Row[];
  [key: string]: Row[];
}

class FakeSupabase {
  tables: FakeTables = { work_cards: [], customers: [], bookings: [], businesses: [] };
  throwOn: string | null = null;
  from(name: string) {
    if (this.throwOn === name) throw new Error(`simulated failure on table "${name}"`);
    if (!this.tables[name]) this.tables[name] = [];
    return new FakeQuery(this.tables[name], name);
  }
}

mock.module("server-only", { namedExports: {} });
mock.module("@/lib/product-events", { namedExports: { recordProductEvent: async () => {} } });

let recordedErrorEvents: Array<{ source: string }> = [];
mock.module("@/lib/error-events", {
  namedExports: {
    recordErrorEvent: async (input: { source: string }) => {
      recordedErrorEvents.push(input);
    },
  },
});

// The one seam this file actually controls per test — a canned
// response standing in for what the model would have said, capturing
// exactly what tools it was offered so the deterministic gate
// (schema.ts) can be checked, not just the outcome.
let nextToolCalls: { id: string; name: string; arguments: unknown }[] = [];
let completionError: Error | null = null;
let capturedToolNames: string[] = [];
let completionCallCount = 0;
mock.module("../llm/client", {
  namedExports: {
    getCompletion: async (request: { tools?: { name: string }[] }) => {
      completionCallCount += 1;
      capturedToolNames = (request.tools ?? []).map((t) => t.name);
      if (completionError) throw completionError;
      return { data: null, raw: "", model: "test-model", toolCalls: nextToolCalls };
    },
  },
});

let decideAndExecuteTools: (typeof import("./decide"))["decideAndExecuteTools"];
before(async () => {
  ({ decideAndExecuteTools } = await import("./decide"));
});

const BUSINESS_ID = "biz-1";
const CONVERSATION_ID = "conv-1";
const EPISODE_ID = "ep-1";
const CUSTOMER_ID = "cust-1";

function findWeekday(from: Date): Date {
  const d = new Date(from);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
const WEEKDAY = findWeekday(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
function at(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function baseInput(supabase: FakeSupabase, overrides: Record<string, unknown> = {}) {
  return {
    supabase: supabase as any,
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    episodeId: EPISODE_ID,
    customerId: CUSTOMER_ID as string | null,
    customerPhone: "+447700900123",
    customerName: "Sarah",
    understanding: {
      primaryIntent: "BOOKING_REQUEST",
      secondaryIntents: [],
      confidence: "high",
      patternEntities: { phoneNumbers: [], postcodes: [], emails: [], explicitDates: [] },
      meaningEntities: { urgency: "none", impliedJobType: null, sentiment: "neutral" },
      safetyTag: null,
      conversationState: EMPTY_CONVERSATION_STATE,
      episodeContinuity: "same_job",
      bookingAcceptance: "none",
    },
    messageBody: "test message",
    ...overrides,
  };
}

function seedBusiness(supabase: FakeSupabase) {
  supabase.tables.businesses.push({ id: BUSINESS_ID, opening_time: "08:00", closing_time: "17:00", availability: {} });
}
function seedJob(supabase: FakeSupabase, overrides: Row = {}) {
  supabase.tables.work_cards.push({
    id: "job-1",
    business_id: BUSINESS_ID,
    conversation_id: CONVERSATION_ID,
    episode_id: EPISODE_ID,
    customer_id: CUSTOMER_ID,
    issue: "Leaking tap",
    address: null,
    status: "draft",
    next_booking_id: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  });
}

test.beforeEach(() => {
  nextToolCalls = [];
  completionError = null;
  capturedToolNames = [];
  completionCallCount = 0;
  recordedErrorEvents = [];
});

// ---------------------------------------------------------------------
// 1. General question -> no unnecessary tool call

test("a general question makes no tool-decision LLM call at all, and executes nothing", async () => {
  const supabase = new FakeSupabase();
  const result = await decideAndExecuteTools(baseInput(supabase, { understanding: { ...baseInput(supabase).understanding, primaryIntent: "BUSINESS_INFORMATION" } }) as any);
  assert.deepEqual(result.executed, []);
  assert.equal(result.escalateRequested, false);
  assert.equal(completionCallCount, 0, "no LLM call should ever be made for an intent with no available tools");
});

// ---------------------------------------------------------------------
// 2. Returning customer -> get_customer_context

test("a returning-customer signal calls get_customer_context and returns their real history", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.customers.push({ id: CUSTOMER_ID, name: "Sarah", default_address: null, notes: "Fixed her boiler in March" });
  nextToolCalls = [{ id: "call-1", name: "get_customer_context", arguments: {} }];

  const result = await decideAndExecuteTools(baseInput(supabase, { understanding: { ...baseInput(supabase).understanding, primaryIntent: "RETURNING_PROBLEM" } }) as any);
  assert.equal(result.executed.length, 1);
  assert.equal(result.executed[0]!.name, "get_customer_context");
  assert.equal(result.executed[0]!.result.ok, true);
});

// ---------------------------------------------------------------------
// 3. Customer describes a problem -> job created/updated

test("a described plumbing problem creates a real job via create_or_update_job", async () => {
  const supabase = new FakeSupabase();
  nextToolCalls = [{ id: "call-1", name: "create_or_update_job", arguments: { issue: "Leaking kitchen tap", address: null, notes: null } }];

  const result = await decideAndExecuteTools(baseInput(supabase) as any);
  assert.equal(result.executed[0]!.result.ok, true);
  assert.equal(supabase.tables.work_cards.length, 1);
  assert.equal(supabase.tables.work_cards[0]!.issue, "Leaking kitchen tap");
});

// ---------------------------------------------------------------------
// 4. Customer asks for an appointment -> check_availability

test("an appointment request calls check_availability and returns real slots, never invented ones", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  nextToolCalls = [{ id: "call-1", name: "check_availability", arguments: { durationMinutes: 60, preferredDate: null } }];

  const result = await decideAndExecuteTools(baseInput(supabase) as any);
  assert.equal(result.executed[0]!.result.ok, true);
  const data = (result.executed[0]!.result as any).data;
  assert.ok(data.slots.length > 0);
});

// ---------------------------------------------------------------------
// 5. Customer accepts a valid slot -> booking can be created

test("an explicitly accepted, genuinely free slot creates a real proposed booking", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  seedJob(supabase);
  nextToolCalls = [{ id: "call-1", name: "create_booking", arguments: { start: at(WEEKDAY, "09:00").toISOString(), end: at(WEEKDAY, "10:00").toISOString() } }];

  const result = await decideAndExecuteTools(baseInput(supabase) as any);
  assert.equal(result.executed[0]!.result.ok, true);
  assert.equal(supabase.tables.bookings.length, 1);
  assert.equal(supabase.tables.bookings[0]!.status, "proposed");
});

// ---------------------------------------------------------------------
// 6. Requested slot unavailable -> no booking, real alternatives

test("an unavailable requested slot creates no booking and returns real alternative times", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  seedJob(supabase);
  supabase.tables.bookings.push({
    id: "existing",
    business_id: BUSINESS_ID,
    job_id: "other-job",
    status: "confirmed",
    scheduled_start: at(WEEKDAY, "09:00").toISOString(),
    scheduled_end: at(WEEKDAY, "10:00").toISOString(),
  });
  nextToolCalls = [{ id: "call-1", name: "create_booking", arguments: { start: at(WEEKDAY, "09:00").toISOString(), end: at(WEEKDAY, "10:00").toISOString() } }];

  const result = await decideAndExecuteTools(baseInput(supabase) as any);
  const outcome = result.executed[0]!.result;
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.reason, "conflict");
  assert.ok((outcome.alternatives ?? []).length > 0);
  assert.equal(supabase.tables.bookings.length, 1, "no new booking was written");
});

// ---------------------------------------------------------------------
// 7. Customer asks to move an existing booking -> update_booking

test("a request to move an existing booking calls update_booking and reschedules it for real", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  seedJob(supabase, { next_booking_id: "existing-booking" });
  supabase.tables.bookings.push({
    id: "existing-booking",
    business_id: BUSINESS_ID,
    job_id: "job-1",
    status: "confirmed",
    scheduled_start: at(WEEKDAY, "09:00").toISOString(),
    scheduled_end: at(WEEKDAY, "10:00").toISOString(),
  });
  nextToolCalls = [
    { id: "call-1", name: "update_booking", arguments: { action: "reschedule", start: at(WEEKDAY, "13:00").toISOString(), end: at(WEEKDAY, "14:00").toISOString() } },
  ];

  const result = await decideAndExecuteTools(baseInput(supabase, { understanding: { ...baseInput(supabase).understanding, primaryIntent: "BOOKING_CHANGE" } }) as any);
  assert.equal(result.executed[0]!.result.ok, true);
  const cancelled = supabase.tables.bookings.find((b) => b.id === "existing-booking");
  assert.equal(cancelled!.status, "cancelled");
});

// ---------------------------------------------------------------------
// 8 & 9. Emergency / complaint -> escalate, never a normal booking flow

test("an emergency only ever offers escalate_to_owner — a booking tool is never even available to call", async () => {
  const supabase = new FakeSupabase();
  nextToolCalls = [{ id: "call-1", name: "escalate_to_owner", arguments: { reason: "Water coming through the ceiling, customer has isolated the stopcock." } }];

  const result = await decideAndExecuteTools(baseInput(supabase, { understanding: { ...baseInput(supabase).understanding, primaryIntent: "EMERGENCY" } }) as any);
  assert.deepEqual(capturedToolNames, ["escalate_to_owner"]);
  assert.equal(result.escalateRequested, true);
  assert.ok(result.escalateReason?.includes("ceiling"));
});

test("a complaint only ever offers escalate_to_owner too", async () => {
  const supabase = new FakeSupabase();
  nextToolCalls = [{ id: "call-1", name: "escalate_to_owner", arguments: { reason: "Customer unhappy with previous work, already paid." } }];

  const result = await decideAndExecuteTools(baseInput(supabase, { understanding: { ...baseInput(supabase).understanding, primaryIntent: "COMPLAINT" } }) as any);
  assert.deepEqual(capturedToolNames, ["escalate_to_owner"]);
  assert.equal(result.escalateRequested, true);
});

test("a hallucinated booking tool call during an emergency is ignored — defense in depth beyond the offered-tools list alone", async () => {
  const supabase = new FakeSupabase();
  nextToolCalls = [{ id: "call-1", name: "create_booking", arguments: { start: at(WEEKDAY, "09:00").toISOString(), end: at(WEEKDAY, "10:00").toISOString() } }];

  const result = await decideAndExecuteTools(baseInput(supabase, { understanding: { ...baseInput(supabase).understanding, primaryIntent: "EMERGENCY" } }) as any);
  assert.deepEqual(result.executed, []);
  assert.equal(supabase.tables.bookings.length, 0);
});

// ---------------------------------------------------------------------
// 10. Ambiguous request -> no invented action

test("when the model requests no tool at all, nothing is executed and nothing is escalated", async () => {
  const supabase = new FakeSupabase();
  nextToolCalls = [];

  const result = await decideAndExecuteTools(baseInput(supabase) as any);
  assert.deepEqual(result.executed, []);
  assert.equal(result.escalateRequested, false);
  assert.equal(supabase.tables.work_cards.length, 0);
  assert.equal(supabase.tables.bookings.length, 0);
});

// ---------------------------------------------------------------------
// 11. Tool failure -> never reads as success

test("an unexpected execution failure surfaces as a typed failure, not a thrown error, and the pipeline is not blocked", async () => {
  const supabase = new FakeSupabase();
  // Deliberately a table the decide-phase job lookup never touches
  // (work_cards) — this isolates a genuine EXECUTION-time failure from
  // the separate, already-covered case of the decide phase's own job
  // lookup failing (see the LLM-call-failure test below, same degrade
  // path, different trigger).
  supabase.throwOn = "businesses";
  nextToolCalls = [{ id: "call-1", name: "check_availability", arguments: { durationMinutes: null, preferredDate: null } }];

  const result = await decideAndExecuteTools(baseInput(supabase) as any);
  assert.equal(result.executed[0]!.result.ok, false);
  assert.equal((result.executed[0]!.result as any).reason, "execution_failed");
});

test("a failure in the decide phase's own job lookup degrades to no action, exactly like a failed LLM call — never an uncaught throw", async () => {
  const supabase = new FakeSupabase();
  supabase.throwOn = "work_cards";
  nextToolCalls = [{ id: "call-1", name: "create_or_update_job", arguments: { issue: "Leaking tap", address: null, notes: null } }];

  const result = await decideAndExecuteTools(baseInput(supabase) as any);
  assert.deepEqual(result.executed, []);
  assert.equal(recordedErrorEvents.length, 1);
});

test("a failed tool-decision LLM call degrades to no action, logged, never throws", async () => {
  const supabase = new FakeSupabase();
  completionError = new Error("model unavailable");

  const result = await decideAndExecuteTools(baseInput(supabase) as any);
  assert.deepEqual(result.executed, []);
  assert.equal(recordedErrorEvents.length, 1);
  assert.equal(recordedErrorEvents[0]!.source, "reply-engine.decide_tools_failed");
});

// ---------------------------------------------------------------------
// Execution ordering

test("multiple requested tools always execute in the fixed, safe order regardless of the order the model returned them", async () => {
  const supabase = new FakeSupabase();
  nextToolCalls = [
    { id: "call-1", name: "create_or_update_job", arguments: { issue: "Leaking tap", address: null, notes: null } },
    { id: "call-2", name: "get_customer_context", arguments: {} },
  ];

  const result = await decideAndExecuteTools(baseInput(supabase) as any);
  assert.deepEqual(
    result.executed.map((e) => e.name),
    ["get_customer_context", "create_or_update_job"]
  );
});

// ---------------------------------------------------------------------
// Deterministic job-creation backstop (production test, 2026-08-16):
// job capture used to be entirely at the model's discretion, with no
// fallback when it declined or the decision call itself failed.

function withSlots(overrides: Partial<Record<"issue" | "location" | "preferredTime" | "preferredTimeResolved" | "customerName", string | null>>) {
  return {
    ...EMPTY_CONVERSATION_STATE,
    slots: { ...EMPTY_CONVERSATION_STATE.slots, ...overrides },
  };
}

test("backstop: no tool call returned but issue+location are known — a job is still created", async () => {
  const supabase = new FakeSupabase();
  nextToolCalls = [];

  const result = await decideAndExecuteTools(
    baseInput(supabase, {
      understanding: { ...baseInput(supabase).understanding, conversationState: withSlots({ issue: "Leaking radiator", location: "NW1 1AA" }) },
    }) as any
  );
  assert.equal(result.executed.length, 1);
  assert.equal(result.executed[0]!.name, "create_or_update_job");
  assert.equal(supabase.tables.work_cards.length, 1);
  assert.equal(supabase.tables.work_cards[0]!.issue, "Leaking radiator");
  assert.equal(supabase.tables.work_cards[0]!.address, "NW1 1AA");
});

test("backstop: issue + a resolved preferred time (no location) is also enough to fire", async () => {
  const supabase = new FakeSupabase();
  nextToolCalls = [];

  const result = await decideAndExecuteTools(
    baseInput(supabase, {
      understanding: {
        ...baseInput(supabase).understanding,
        conversationState: withSlots({ issue: "Leaking radiator", preferredTimeResolved: "2026-08-17T14:00:00.000Z" }),
      },
    }) as any
  );
  assert.equal(result.executed.length, 1);
  assert.equal(result.executed[0]!.name, "create_or_update_job");
});

test("backstop: the model already called create_or_update_job itself — no duplicate call is queued", async () => {
  const supabase = new FakeSupabase();
  nextToolCalls = [{ id: "call-1", name: "create_or_update_job", arguments: { issue: "Leaking radiator", address: "NW1 1AA", notes: null } }];

  const result = await decideAndExecuteTools(
    baseInput(supabase, {
      understanding: { ...baseInput(supabase).understanding, conversationState: withSlots({ issue: "Leaking radiator", location: "NW1 1AA" }) },
    }) as any
  );
  assert.equal(result.executed.filter((e) => e.name === "create_or_update_job").length, 1);
  assert.equal(supabase.tables.work_cards.length, 1);
});

test("backstop: only issue known, no location or resolved time — correctly declines", async () => {
  const supabase = new FakeSupabase();
  nextToolCalls = [];

  const result = await decideAndExecuteTools(
    baseInput(supabase, {
      understanding: { ...baseInput(supabase).understanding, conversationState: withSlots({ issue: "Leaking radiator" }) },
    }) as any
  );
  assert.deepEqual(result.executed, []);
  assert.equal(supabase.tables.work_cards.length, 0);
});

test("backstop: a job already exists for this episode — backstop does not fire (avoids duplicating executeCreateOrUpdateJob's own merge)", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase);
  nextToolCalls = [];

  const result = await decideAndExecuteTools(
    baseInput(supabase, {
      understanding: { ...baseInput(supabase).understanding, conversationState: withSlots({ issue: "Leaking radiator", location: "NW1 1AA" }) },
    }) as any
  );
  assert.deepEqual(result.executed, []);
  assert.equal(supabase.tables.work_cards.length, 1, "no second job was inserted");
});

test("backstop: fires even when the tool-decision LLM call itself failed, as long as the job lookup succeeded", async () => {
  const supabase = new FakeSupabase();
  completionError = new Error("model unavailable");

  const result = await decideAndExecuteTools(
    baseInput(supabase, {
      understanding: { ...baseInput(supabase).understanding, conversationState: withSlots({ issue: "Leaking radiator", location: "NW1 1AA" }) },
    }) as any
  );
  assert.equal(result.executed.length, 1);
  assert.equal(result.executed[0]!.name, "create_or_update_job");
  assert.equal(supabase.tables.work_cards.length, 1);
  assert.equal(recordedErrorEvents.length, 1, "the LLM failure is still logged even though the backstop recovered the turn");
});

test("backstop: does not fire for an intent that doesn't offer create_or_update_job at all", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  nextToolCalls = [];

  const result = await decideAndExecuteTools(
    baseInput(supabase, {
      understanding: {
        ...baseInput(supabase).understanding,
        primaryIntent: "BOOKING_CHANGE",
        conversationState: withSlots({ issue: "Leaking radiator", location: "NW1 1AA" }),
      },
    }) as any
  );
  assert.deepEqual(result.executed, []);
});

// ---------------------------------------------------------------------
// Deterministic schedule-preference step (production test, 2026-08-16
// round 2): the AI job-creation path could never populate scheduled_for
// at all, structurally. applySchedulePreferenceIfMissing closes that
// gap as a separate deterministic step, never exposed to the model's
// own tool schema.

test("a newly backstop-created job's scheduled_for is set to the resolved preferred time (the window start)", async () => {
  const supabase = new FakeSupabase();
  nextToolCalls = [];

  await decideAndExecuteTools(
    baseInput(supabase, {
      understanding: {
        ...baseInput(supabase).understanding,
        conversationState: withSlots({ issue: "Cracked tiles", location: "W12 1NE", preferredTimeResolved: "2026-08-27T12:00:00.000Z" }),
      },
    }) as any
  );
  assert.equal(supabase.tables.work_cards.length, 1);
  assert.equal(supabase.tables.work_cards[0]!.scheduled_for, "2026-08-27T12:00:00.000Z");
});

test("a resolved preferred time on a later turn fills in an existing draft job's still-empty scheduled_for, even with no other tool call this turn", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase, { issue: "Cracked tiles", address: "W12 1NE" }); // scheduled_for intentionally absent (null)
  nextToolCalls = [];

  const result = await decideAndExecuteTools(
    baseInput(supabase, {
      understanding: {
        ...baseInput(supabase).understanding,
        conversationState: withSlots({ issue: "Cracked tiles", location: "W12 1NE", preferredTimeResolved: "2026-08-27T12:00:00.000Z" }),
      },
    }) as any
  );
  // No tool call was needed (the job already exists) — the deterministic
  // schedule step still runs as a side effect, independent of `executed`.
  assert.deepEqual(result.executed, []);
  assert.equal(supabase.tables.work_cards[0]!.scheduled_for, "2026-08-27T12:00:00.000Z");
});

test("never overwrites a scheduled_for the owner (or an earlier turn) already set", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase, { issue: "Cracked tiles", address: "W12 1NE", scheduled_for: "2026-08-20T09:00:00.000Z" });
  nextToolCalls = [];

  await decideAndExecuteTools(
    baseInput(supabase, {
      understanding: {
        ...baseInput(supabase).understanding,
        conversationState: withSlots({ issue: "Cracked tiles", location: "W12 1NE", preferredTimeResolved: "2026-08-27T12:00:00.000Z" }),
      },
    }) as any
  );
  assert.equal(supabase.tables.work_cards[0]!.scheduled_for, "2026-08-20T09:00:00.000Z", "an already-set time must never be silently replaced");
});

test("never touches scheduled_for on a job that's no longer draft (already booked)", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase, { issue: "Cracked tiles", address: "W12 1NE", status: "booked" });
  nextToolCalls = [];

  await decideAndExecuteTools(
    baseInput(supabase, {
      understanding: {
        ...baseInput(supabase).understanding,
        conversationState: withSlots({ issue: "Cracked tiles", location: "W12 1NE", preferredTimeResolved: "2026-08-27T12:00:00.000Z" }),
      },
    }) as any
  );
  assert.equal(supabase.tables.work_cards[0]!.scheduled_for, undefined, "a confirmed/booked job's time must never be touched by a later customer preference");
});

test("the backstop's notes now come from real collected facts (buildWorkCardDraft), not always null", async () => {
  const supabase = new FakeSupabase();
  nextToolCalls = [];

  await decideAndExecuteTools(
    baseInput(supabase, {
      understanding: {
        ...baseInput(supabase).understanding,
        conversationState: {
          ...withSlots({ issue: "cracked tiles", location: "W12 1NE" }),
          commitments: [{ text: "Ten photos already sent", kind: "customer_fact", status: "resolved" }],
        },
      },
    }) as any
  );
  assert.equal(supabase.tables.work_cards[0]!.issue, "Cracked tiles", "issue is sentence-cased via buildWorkCardDraft, same as the manual form");
  assert.equal(supabase.tables.work_cards[0]!.notes, "Ten photos already sent");
});
