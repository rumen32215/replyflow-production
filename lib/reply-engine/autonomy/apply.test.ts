import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

/**
 * applyTier1AutoConfirm against the real lib/booking/engine.ts (not
 * mocked) via a fake Supabase — the same convention as
 * lib/reply-engine/tools/execute.test.ts. This is the one place a
 * Tier 1 confirmation is ever actually performed; every case here
 * proves it's real (a real row change) or genuinely absent, never
 * assumed.
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
      return { data: this.selected(), error: null };
    };
    return run().then(onfulfilled, onrejected);
  }
}

interface FakeTables {
  work_cards: Row[];
  bookings: Row[];
  [key: string]: Row[];
}

class FakeSupabase {
  tables: FakeTables = { work_cards: [], bookings: [] };
  from(name: string) {
    if (!this.tables[name]) this.tables[name] = [];
    return new FakeQuery(this.tables[name], name);
  }
}

mock.module("server-only", { namedExports: {} });

let applyTier1AutoConfirm: (typeof import("./apply"))["applyTier1AutoConfirm"];
let reflectConfirmedBooking: (typeof import("./apply"))["reflectConfirmedBooking"];
before(async () => {
  ({ applyTier1AutoConfirm, reflectConfirmedBooking } = await import("./apply"));
});

const EPISODE_ID = "ep-1";

function seedJobWithBooking(supabase: FakeSupabase, bookingStatus: "proposed" | "confirmed" = "proposed") {
  supabase.tables.work_cards.push({ id: "job-1", episode_id: EPISODE_ID, issue: "Leaking tap", address: "1 High St", status: "draft", next_booking_id: "booking-1", created_at: "2026-01-01T00:00:00Z" });
  supabase.tables.bookings.push({
    id: "booking-1",
    business_id: "biz-1",
    job_id: "job-1",
    status: bookingStatus,
    scheduled_start: "2026-09-01T09:00:00.000Z",
    scheduled_end: "2026-09-01T10:00:00.000Z",
  });
}

// ---------------------------------------------------------------------
// applyTier1AutoConfirm

test("applyTier1AutoConfirm: no job for this episode -> not attempted, never a false success", async () => {
  const supabase = new FakeSupabase();
  const result = await applyTier1AutoConfirm(supabase as any, EPISODE_ID);
  assert.equal(result.attempted, false);
  assert.equal(result.succeeded, false);
});

test("applyTier1AutoConfirm: a job with no active booking -> not attempted", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.work_cards.push({ id: "job-1", episode_id: EPISODE_ID, next_booking_id: null, created_at: "2026-01-01T00:00:00Z" });
  const result = await applyTier1AutoConfirm(supabase as any, EPISODE_ID);
  assert.equal(result.attempted, false);
});

test("applyTier1AutoConfirm: a real proposed booking is genuinely confirmed in the database", async () => {
  const supabase = new FakeSupabase();
  seedJobWithBooking(supabase, "proposed");
  const result = await applyTier1AutoConfirm(supabase as any, EPISODE_ID);
  assert.equal(result.succeeded, true);
  assert.equal(supabase.tables.bookings[0]!.status, "confirmed");
});

test("applyTier1AutoConfirm: an already-confirmed booking reports failure, not a false 'succeeded' — never re-applies silently", async () => {
  const supabase = new FakeSupabase();
  seedJobWithBooking(supabase, "confirmed");
  const result = await applyTier1AutoConfirm(supabase as any, EPISODE_ID);
  assert.equal(result.attempted, true);
  assert.equal(result.succeeded, false);
});

// ---------------------------------------------------------------------
// reflectConfirmedBooking

test("reflectConfirmedBooking: patches the proposed booking's status to confirmed, nothing else", async () => {
  const toolResults = [
    { name: "get_customer_context" as const, result: { ok: true as const, data: { customer: null, recentJobs: [] } } },
    { name: "create_booking" as const, result: { ok: true as const, data: { start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T10:00:00.000Z", status: "proposed" as const } } },
  ];
  const patched = reflectConfirmedBooking(toolResults);
  assert.equal(patched[0], toolResults[0], "unrelated entries are untouched (same reference)");
  assert.equal((patched[1]!.result as any).data.status, "confirmed");
  assert.equal((toolResults[1]!.result as any).data.status, "proposed", "the original array must never be mutated in place");
});

test("reflectConfirmedBooking: no proposed booking present -> returns an equivalent, unpatched array", async () => {
  const toolResults = [{ name: "get_customer_context" as const, result: { ok: true as const, data: { customer: null, recentJobs: [] } } }];
  const patched = reflectConfirmedBooking(toolResults);
  assert.deepEqual(patched, toolResults);
});
