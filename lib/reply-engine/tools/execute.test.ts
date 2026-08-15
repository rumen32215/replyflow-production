import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

/**
 * Exercises the real executeTool dispatcher — validation, the
 * deterministic executors, and their real integration with
 * lib/booking/engine.ts (not mocked: a conflict/slot/booking outcome
 * here is the real engine's own logic, exactly as a live tool call
 * would get it) — against a minimal in-memory fake of the Supabase
 * query builder, same convention as lib/booking/engine.test.ts.
 */

type Row = Record<string, unknown>;
type Op = "eq" | "neq" | "in" | "lt" | "gt";
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
    if (this.throwOn === name) {
      throw new Error(`simulated failure on table "${name}"`);
    }
    if (!this.tables[name]) this.tables[name] = [];
    return new FakeQuery(this.tables[name], name);
  }
}

mock.module("server-only", { namedExports: {} });

let recordedProductEvents: Array<{ eventType: string; context?: Record<string, unknown> }> = [];
let recordedErrorEvents: Array<{ source: string }> = [];
mock.module("@/lib/product-events", {
  namedExports: {
    recordProductEvent: async (input: { eventType: string; context?: Record<string, unknown> }) => {
      recordedProductEvents.push(input);
    },
  },
});
mock.module("@/lib/error-events", {
  namedExports: {
    recordErrorEvent: async (input: { source: string }) => {
      recordedErrorEvents.push(input);
    },
  },
});

let executeTool: (typeof import("./execute"))["executeTool"];
let findCurrentJob: (typeof import("./execute"))["findCurrentJob"];
before(async () => {
  ({ executeTool, findCurrentJob } = await import("./execute"));
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
// Genuinely in the future relative to the real clock — create_booking's
// validation deliberately uses the real current time (production
// correctness), so a fixed past date here would fail validation for
// reasons unrelated to what each test actually checks.
const WEEKDAY = findWeekday(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
function at(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function baseCtx(supabase: FakeSupabase) {
  return {
    supabase: supabase as any,
    businessId: BUSINESS_ID,
    conversationId: CONVERSATION_ID,
    episodeId: EPISODE_ID,
    customerId: CUSTOMER_ID as string | null,
    customerPhone: "+447700900123",
    customerName: "Sarah",
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
  recordedProductEvents = [];
  recordedErrorEvents = [];
});

// ---------------------------------------------------------------------
// get_customer_context

test("get_customer_context: a known customer returns real stored identity and job history", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.customers.push({ id: CUSTOMER_ID, name: "Sarah", default_address: "1 High St", notes: "Prefers texts" });
  supabase.tables.work_cards.push({ id: "job-old", customer_id: CUSTOMER_ID, issue: "Boiler service", status: "completed", scheduled_for: null, completed_at: "2026-04-01T00:00:00Z", created_at: "2026-04-01T00:00:00Z" });

  const outcome = await executeTool(baseCtx(supabase), "get_customer_context", {});
  assert.equal(outcome.result.ok, true);
  if (!outcome.result.ok) return;
  const data = outcome.result.data as any;
  assert.equal(data.customer.name, "Sarah");
  assert.equal(data.recentJobs.length, 1);
  assert.equal(data.recentJobs[0].issue, "Boiler service");
});

test("get_customer_context: no customer_id on this conversation returns an honest empty result, not an error", async () => {
  const supabase = new FakeSupabase();
  const ctx = { ...baseCtx(supabase), customerId: null };
  const outcome = await executeTool(ctx, "get_customer_context", {});
  assert.equal(outcome.result.ok, true);
  if (!outcome.result.ok) return;
  assert.deepEqual(outcome.result.data, { customer: null, recentJobs: [] });
});

// ---------------------------------------------------------------------
// create_or_update_job

test("create_or_update_job: creates a new job when none exists yet, with a real issue", async () => {
  const supabase = new FakeSupabase();
  const outcome = await executeTool(baseCtx(supabase), "create_or_update_job", { issue: "Leaking kitchen tap", address: null, notes: null });
  assert.equal(outcome.result.ok, true);
  if (!outcome.result.ok) return;
  assert.equal((outcome.result.data as any).issue, "Leaking kitchen tap");
  assert.equal(supabase.tables.work_cards.length, 1);
  assert.equal(supabase.tables.work_cards[0]!.customer_id, CUSTOMER_ID);
});

test("create_or_update_job: cannot create a brand new job without an issue", async () => {
  const supabase = new FakeSupabase();
  const outcome = await executeTool(baseCtx(supabase), "create_or_update_job", { issue: null, address: "NW1 1AA", notes: null });
  assert.equal(outcome.result.ok, false);
  if (outcome.result.ok) return;
  assert.equal(outcome.result.reason, "invalid_arguments");
  assert.equal(supabase.tables.work_cards.length, 0);
});

test("create_or_update_job: updates an existing job, merge-only — never nulls out a value it wasn't given", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase, { issue: "Leaking tap", address: "1 High St" });
  const outcome = await executeTool(baseCtx(supabase), "create_or_update_job", { issue: null, address: null, notes: "Access via side gate" });
  assert.equal(outcome.result.ok, true);
  const job = supabase.tables.work_cards[0]!;
  assert.equal(job.issue, "Leaking tap");
  assert.equal(job.address, "1 High St");
  assert.equal(job.notes, "Access via side gate");
});

// ---------------------------------------------------------------------
// check_availability

test("check_availability: returns real slots computed by the deterministic booking engine", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  const outcome = await executeTool(baseCtx(supabase), "check_availability", { durationMinutes: 60, preferredDate: null });
  assert.equal(outcome.result.ok, true);
  if (!outcome.result.ok) return;
  assert.ok((outcome.result.data as any).slots.length > 0);
});

// ---------------------------------------------------------------------
// create_booking

test("create_booking: requires an existing job — never invents one", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  const start = at(WEEKDAY, "09:00");
  const end = at(WEEKDAY, "10:00");
  const outcome = await executeTool(baseCtx(supabase), "create_booking", { start: start.toISOString(), end: end.toISOString() });
  assert.equal(outcome.result.ok, false);
  if (outcome.result.ok) return;
  assert.equal(outcome.result.reason, "no_job");
  assert.equal(supabase.tables.bookings.length, 0);
});

test("create_booking: a genuinely free slot creates a real, proposed booking and links it to the job", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  seedJob(supabase);
  const start = at(WEEKDAY, "09:00");
  const end = at(WEEKDAY, "10:00");
  const outcome = await executeTool(baseCtx(supabase), "create_booking", { start: start.toISOString(), end: end.toISOString() });
  assert.equal(outcome.result.ok, true);
  if (!outcome.result.ok) return;
  assert.equal((outcome.result.data as any).status, "proposed", "an AI-initiated booking is never auto-confirmed");
  assert.equal(supabase.tables.bookings.length, 1);
  assert.equal(supabase.tables.work_cards[0]!.next_booking_id, supabase.tables.bookings[0]!.id);
});

test("create_booking: a slot that conflicts with a real existing booking is rejected, with real alternatives, and nothing is written", async () => {
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
  const outcome = await executeTool(baseCtx(supabase), "create_booking", {
    start: at(WEEKDAY, "09:30").toISOString(),
    end: at(WEEKDAY, "10:30").toISOString(),
  });
  assert.equal(outcome.result.ok, false);
  if (outcome.result.ok) return;
  assert.equal(outcome.result.reason, "conflict");
  assert.ok(Array.isArray(outcome.result.alternatives));
  assert.equal(supabase.tables.bookings.length, 1, "only the pre-existing booking, nothing new was written");
});

// ---------------------------------------------------------------------
// update_booking

test("update_booking: no active booking on the job returns no_active_booking, never invents one to act on", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase);
  const outcome = await executeTool(baseCtx(supabase), "update_booking", { action: "confirm", start: null, end: null });
  assert.equal(outcome.result.ok, false);
  if (outcome.result.ok) return;
  assert.equal(outcome.result.reason, "no_active_booking");
});

test("update_booking: confirms a real proposed booking", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  seedJob(supabase);
  await executeTool(baseCtx(supabase), "create_booking", { start: at(WEEKDAY, "09:00").toISOString(), end: at(WEEKDAY, "10:00").toISOString() });
  const outcome = await executeTool(baseCtx(supabase), "update_booking", { action: "confirm", start: null, end: null });
  assert.equal(outcome.result.ok, true);
  if (!outcome.result.ok) return;
  assert.equal((outcome.result.data as any).status, "confirmed");
});

test("update_booking: reschedules to a real alternative, cancelling the old booking", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  seedJob(supabase);
  await executeTool(baseCtx(supabase), "create_booking", { start: at(WEEKDAY, "09:00").toISOString(), end: at(WEEKDAY, "10:00").toISOString() });
  const outcome = await executeTool(baseCtx(supabase), "update_booking", {
    action: "reschedule",
    start: at(WEEKDAY, "13:00").toISOString(),
    end: at(WEEKDAY, "14:00").toISOString(),
  });
  assert.equal(outcome.result.ok, true);
  const cancelledOriginal = supabase.tables.bookings.find((b) => b.status === "cancelled");
  assert.ok(cancelledOriginal, "the original booking must be cancelled, not deleted or mutated in place");
});

test("update_booking: rescheduling an already-CONFIRMED booking through the AI tool path never silently re-confirms the new slot (Plumber Reset Phase 3 step 5)", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  seedJob(supabase);
  await executeTool(baseCtx(supabase), "create_booking", { start: at(WEEKDAY, "09:00").toISOString(), end: at(WEEKDAY, "10:00").toISOString() });
  await executeTool(baseCtx(supabase), "update_booking", { action: "confirm", start: null, end: null });

  const outcome = await executeTool(baseCtx(supabase), "update_booking", {
    action: "reschedule",
    start: at(WEEKDAY, "13:00").toISOString(),
    end: at(WEEKDAY, "14:00").toISOString(),
  });
  assert.equal(outcome.result.ok, true);
  if (!outcome.result.ok) return;
  assert.equal((outcome.result.data as any).status, "proposed", "an AI-initiated reschedule of a confirmed booking must require fresh approval, never inherit confirmed status");
});

// ---------------------------------------------------------------------
// Fail-safe behaviour

test("executeTool: invalid arguments never touch the database at all", async () => {
  const supabase = new FakeSupabase();
  supabase.throwOn = "work_cards"; // if this tool tried to query anything, the test would throw synchronously
  const outcome = await executeTool(baseCtx(supabase), "create_or_update_job", { issue: 42, address: null, notes: null });
  assert.equal(outcome.result.ok, false);
  if (outcome.result.ok) return;
  assert.equal(outcome.result.reason, "invalid_arguments");
});

test("executeTool: an unexpected database failure degrades to execution_failed, never a thrown error, and is logged", async () => {
  const supabase = new FakeSupabase();
  supabase.throwOn = "work_cards";
  const outcome = await executeTool(baseCtx(supabase), "create_or_update_job", { issue: "Leaking tap", address: null, notes: null });
  assert.equal(outcome.result.ok, false);
  if (outcome.result.ok) return;
  assert.equal(outcome.result.reason, "execution_failed");
  assert.equal(recordedErrorEvents.length, 1);
  assert.equal(recordedErrorEvents[0]!.source, "reply-engine.tool_execution_failed");
});

test("executeTool: every invocation is logged for auditability, success or failure", async () => {
  const supabase = new FakeSupabase();
  await executeTool(baseCtx(supabase), "get_customer_context", {});
  assert.equal(recordedProductEvents.length, 1);
  assert.equal(recordedProductEvents[0]!.eventType, "tool.get_customer_context");
});

test("findCurrentJob: returns null when this episode has no job yet", async () => {
  const supabase = new FakeSupabase();
  const job = await findCurrentJob(supabase as any, EPISODE_ID);
  assert.equal(job, null);
});
