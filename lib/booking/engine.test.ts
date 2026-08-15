import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

/**
 * Exercises the real checkAvailability/createBooking/updateBooking
 * against a minimal in-memory fake of the Supabase query builder — the
 * same convention as lib/reply-engine/episode.test.ts and
 * lib/customers/resolve.test.ts, extended with the extra filter ops
 * (in/lt/gt/neq) the booking engine's real queries actually use.
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

  async maybeSingle() {
    if (this.mode === "insert") {
      const row: Row = {
        id: `${this.tableName}-${this.table.length + 1}`,
        reschedule_of_id: null,
        confirmed_at: null,
        cancelled_at: null,
        ...this.writeObj,
      };
      this.table.push(row);
      return { data: row, error: null };
    }
    if (this.mode === "update") {
      const matched = this.table.filter((r) => this.matches(r));
      for (const row of matched) Object.assign(row, this.writeObj);
      return { data: matched[0] ?? null, error: null };
    }
    return { data: this.table.find((r) => this.matches(r)) ?? null, error: null };
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
      return { data: this.table.filter((r) => this.matches(r)), error: null };
    };
    return run().then(onfulfilled, onrejected);
  }
}

interface FakeTables {
  bookings: Row[];
  businesses: Row[];
  work_cards: Row[];
  [key: string]: Row[];
}

class FakeSupabase {
  tables: FakeTables = { bookings: [], businesses: [], work_cards: [] };
  from(name: string) {
    if (!this.tables[name]) this.tables[name] = [];
    return new FakeQuery(this.tables[name], name);
  }
}

mock.module("server-only", { namedExports: {} });

let checkAvailability: (typeof import("./engine"))["checkAvailability"];
let createBooking: (typeof import("./engine"))["createBooking"];
let updateBooking: (typeof import("./engine"))["updateBooking"];
before(async () => {
  ({ checkAvailability, createBooking, updateBooking } = await import("./engine"));
});

const BUSINESS_ID = "biz-1";
const JOB_ID = "job-1";
const CUSTOMER_ID = "cust-1";

function findWeekday(from: Date): Date {
  const d = new Date(from);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
const WEEKDAY = findWeekday(new Date(2026, 0, 1));

function at(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function seedBusiness(supabase: FakeSupabase, overrides: Row = {}) {
  supabase.tables.businesses.push({
    id: BUSINESS_ID,
    opening_time: "08:00",
    closing_time: "17:00",
    availability: {},
    ...overrides,
  });
}

function seedJob(supabase: FakeSupabase, status = "draft") {
  supabase.tables.work_cards.push({ id: JOB_ID, status, next_booking_id: null });
}

// ---------------------------------------------------------------------
// checkAvailability

test("checkAvailability: no business found returns no slots, never throws", async () => {
  const supabase = new FakeSupabase();
  const result = await checkAvailability(supabase as any, { businessId: "missing", durationMinutes: 60 });
  assert.deepEqual(result.slots, []);
});

test("checkAvailability: a normal open business with nothing booked returns real slots on the first working day", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  const result = await checkAvailability(supabase as any, { businessId: BUSINESS_ID, durationMinutes: 60, from: WEEKDAY, now: at(WEEKDAY, "00:00") });
  assert.ok(result.slots.length > 0);
  assert.equal(result.slots[0]!.start.getHours(), 8);
});

test("checkAvailability: an existing booking is excluded from the returned slots", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  supabase.tables.bookings.push({
    id: "b1",
    business_id: BUSINESS_ID,
    job_id: "other-job",
    status: "confirmed",
    scheduled_start: at(WEEKDAY, "08:00").toISOString(),
    scheduled_end: at(WEEKDAY, "09:00").toISOString(),
  });
  const result = await checkAvailability(supabase as any, { businessId: BUSINESS_ID, durationMinutes: 60, from: WEEKDAY, now: at(WEEKDAY, "00:00") });
  assert.ok(!result.slots.some((s) => s.start.getTime() === at(WEEKDAY, "08:00").getTime()));
  assert.ok(result.slots.some((s) => s.start.getTime() === at(WEEKDAY, "09:00").getTime()));
});

test("checkAvailability: a cancelled booking never blocks a slot — only proposed/confirmed count", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  supabase.tables.bookings.push({
    id: "b1",
    business_id: BUSINESS_ID,
    job_id: "other-job",
    status: "cancelled",
    scheduled_start: at(WEEKDAY, "08:00").toISOString(),
    scheduled_end: at(WEEKDAY, "09:00").toISOString(),
  });
  const result = await checkAvailability(supabase as any, { businessId: BUSINESS_ID, durationMinutes: 60, from: WEEKDAY, now: at(WEEKDAY, "00:00") });
  assert.ok(result.slots.some((s) => s.start.getTime() === at(WEEKDAY, "08:00").getTime()));
});

test("checkAvailability: a fully-booked immediate day still finds slots on a later, real working day", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase, { availability: { fullyBooked: [`${WEEKDAY.getFullYear()}-${String(WEEKDAY.getMonth() + 1).padStart(2, "0")}-${String(WEEKDAY.getDate()).padStart(2, "0")}`] } });
  const result = await checkAvailability(supabase as any, { businessId: BUSINESS_ID, durationMinutes: 60, from: WEEKDAY, now: at(WEEKDAY, "00:00") });
  assert.ok(result.slots.length > 0);
  assert.ok(
    result.slots.every((s) => s.start.toDateString() !== WEEKDAY.toDateString()),
    "the fully-booked day itself must offer nothing"
  );
});

test("checkAvailability: never returns more than the capped number of slots", async () => {
  const supabase = new FakeSupabase();
  seedBusiness(supabase);
  const result = await checkAvailability(supabase as any, { businessId: BUSINESS_ID, durationMinutes: 30, from: WEEKDAY, now: at(WEEKDAY, "00:00") });
  assert.ok(result.slots.length <= 6);
});

// ---------------------------------------------------------------------
// createBooking

test("createBooking: a normal, conflict-free proposed booking is created and linked to the job without changing its status", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase, "draft");
  const result = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "09:00"),
    end: at(WEEKDAY, "10:00"),
    source: "ai",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.booking.status, "proposed");
  const job = supabase.tables.work_cards[0]!;
  assert.equal(job.next_booking_id, result.booking.id);
  assert.equal(job.status, "draft", "a merely-proposed booking must not itself advance the job's status");
});

test("createBooking: a confirmed booking promotes an early-stage job to 'booked'", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase, "new_enquiry"); // legacy pre-reset status value — existing-data compatibility
  const result = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "09:00"),
    end: at(WEEKDAY, "10:00"),
    status: "confirmed",
    source: "owner",
  });
  assert.equal(result.ok, true);
  const job = supabase.tables.work_cards[0]!;
  assert.equal(job.status, "booked");
});

test("createBooking: a confirmed booking never regresses a job that's already further along", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase, "in_progress");
  await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "09:00"),
    end: at(WEEKDAY, "10:00"),
    status: "confirmed",
    source: "owner",
  });
  const job = supabase.tables.work_cards[0]!;
  assert.equal(job.status, "in_progress");
});

test("createBooking: an overlapping existing booking is rejected as a conflict, and no row is written", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase);
  supabase.tables.bookings.push({
    id: "existing",
    business_id: BUSINESS_ID,
    job_id: "other-job",
    status: "confirmed",
    scheduled_start: at(WEEKDAY, "09:00").toISOString(),
    scheduled_end: at(WEEKDAY, "10:00").toISOString(),
  });
  const result = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "09:30"),
    end: at(WEEKDAY, "10:30"),
    source: "ai",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "conflict");
  assert.equal(supabase.tables.bookings.length, 1, "the rejected booking must never be written");
});

test("createBooking: the AI cannot claim a slot exists that another booking already took — a second attempt at the same real slot is rejected, not silently accepted", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase);
  const first = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "09:00"),
    end: at(WEEKDAY, "10:00"),
    status: "confirmed",
    source: "ai",
  });
  assert.equal(first.ok, true);

  const second = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: "another-job",
    customerId: "another-customer",
    start: at(WEEKDAY, "09:00"),
    end: at(WEEKDAY, "10:00"),
    status: "confirmed",
    source: "ai",
  });
  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.equal(second.reason, "conflict");
});

test("createBooking: an invalid window (end at or before start) is rejected before ever touching the database", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase);
  const result = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "10:00"),
    end: at(WEEKDAY, "09:00"),
    source: "ai",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "invalid_window");
  assert.equal(supabase.tables.bookings.length, 0);
});

// ---------------------------------------------------------------------
// updateBooking

test("updateBooking: confirm — a proposed booking becomes confirmed and the job advances", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase, "draft");
  const created = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "09:00"),
    end: at(WEEKDAY, "10:00"),
    source: "ai",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const result = await updateBooking(supabase as any, created.booking.id, { action: "confirm" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.booking.status, "confirmed");
  assert.equal(supabase.tables.work_cards[0]!.status, "booked");
});

test("updateBooking: confirming an already-confirmed booking is rejected, not silently re-applied", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase);
  const created = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "09:00"),
    end: at(WEEKDAY, "10:00"),
    status: "confirmed",
    source: "owner",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const result = await updateBooking(supabase as any, created.booking.id, { action: "confirm" });
  assert.equal(result.ok, false);
});

test("updateBooking: cancel — clears the job's booking pointer when it matches", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase);
  const created = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "09:00"),
    end: at(WEEKDAY, "10:00"),
    source: "ai",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const result = await updateBooking(supabase as any, created.booking.id, { action: "cancel" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.booking.status, "cancelled");
  assert.equal(supabase.tables.work_cards[0]!.next_booking_id, null);
});

test("updateBooking: cancelling an already-cancelled booking is rejected", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase);
  const created = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "09:00"),
    end: at(WEEKDAY, "10:00"),
    source: "ai",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  await updateBooking(supabase as any, created.booking.id, { action: "cancel" });
  const result = await updateBooking(supabase as any, created.booking.id, { action: "cancel" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "already_terminal");
});

test("updateBooking: acting on a booking id that doesn't exist returns not_found, never throws", async () => {
  const supabase = new FakeSupabase();
  const result = await updateBooking(supabase as any, "does-not-exist", { action: "confirm" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "not_found");
});

test("updateBooking: reschedule — cancels the old booking and creates a new one linked via reschedule_of_id", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase);
  const created = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "09:00"),
    end: at(WEEKDAY, "10:00"),
    status: "confirmed",
    source: "owner",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const result = await updateBooking(supabase as any, created.booking.id, {
    action: "reschedule",
    start: at(WEEKDAY, "13:00"),
    end: at(WEEKDAY, "14:00"),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.booking.reschedule_of_id, created.booking.id);
  assert.equal(result.booking.status, "confirmed", "rescheduling a confirmed booking keeps it confirmed");

  const old = supabase.tables.bookings.find((b) => b.id === created.booking.id)!;
  assert.equal(old.status, "cancelled");

  const job = supabase.tables.work_cards[0]!;
  assert.equal(job.next_booking_id, result.booking.id);
});

test("updateBooking: keepConfirmed: false downgrades a rescheduled confirmed booking to proposed (Plumber Reset Phase 3 step 5 — an AI-initiated reschedule must never silently re-confirm itself)", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase);
  const created = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "09:00"),
    end: at(WEEKDAY, "10:00"),
    status: "confirmed",
    source: "ai",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const result = await updateBooking(supabase as any, created.booking.id, {
    action: "reschedule",
    start: at(WEEKDAY, "13:00"),
    end: at(WEEKDAY, "14:00"),
    keepConfirmed: false,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.booking.status, "proposed", "an AI-initiated reschedule of a confirmed booking must land as proposed, not silently re-confirmed");
});

test("updateBooking: rescheduling into a slot that conflicts with another real booking is rejected, and the original booking is left untouched", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase);
  const created = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "09:00"),
    end: at(WEEKDAY, "10:00"),
    status: "confirmed",
    source: "owner",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  supabase.tables.bookings.push({
    id: "blocker",
    business_id: BUSINESS_ID,
    job_id: "other-job",
    status: "confirmed",
    scheduled_start: at(WEEKDAY, "13:00").toISOString(),
    scheduled_end: at(WEEKDAY, "14:00").toISOString(),
  });

  const result = await updateBooking(supabase as any, created.booking.id, {
    action: "reschedule",
    start: at(WEEKDAY, "13:30"),
    end: at(WEEKDAY, "14:30"),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "conflict");

  const old = supabase.tables.bookings.find((b) => b.id === created.booking.id)!;
  assert.equal(old.status, "confirmed", "a rejected reschedule must never cancel the original booking");
});

test("updateBooking: rescheduling to an invalid window is rejected before touching any row", async () => {
  const supabase = new FakeSupabase();
  seedJob(supabase);
  const created = await createBooking(supabase as any, {
    businessId: BUSINESS_ID,
    jobId: JOB_ID,
    customerId: CUSTOMER_ID,
    start: at(WEEKDAY, "09:00"),
    end: at(WEEKDAY, "10:00"),
    source: "ai",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const result = await updateBooking(supabase as any, created.booking.id, {
    action: "reschedule",
    start: at(WEEKDAY, "14:00"),
    end: at(WEEKDAY, "13:00"),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "invalid_window");

  const old = supabase.tables.bookings.find((b) => b.id === created.booking.id)!;
  assert.equal(old.status, "proposed");
});
