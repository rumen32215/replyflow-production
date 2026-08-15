import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

/**
 * Exercises the real resolveOrCreateCustomer against a minimal
 * in-memory fake of the Supabase query builder — same shape as
 * lib/reply-engine/episode.test.ts's own fake, not a reimplementation
 * of the logic under test.
 */

type Row = Record<string, unknown>;

class FakeQuery implements PromiseLike<{ data: unknown; error: null }> {
  private filters: Array<[string, unknown]> = [];
  private mode: "select" | "insert" | "update" = "select";
  private writeObj: Row | null = null;

  constructor(private table: Row[]) {}

  select(_cols?: string) {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
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

  private matches(row: Row) {
    return this.filters.every(([col, val]) => row[col] === val);
  }

  async maybeSingle() {
    if (this.mode === "insert") {
      const conflict = this.table.find((r) => r.business_id === this.writeObj!.business_id && r.phone === this.writeObj!.phone);
      if (conflict) return { data: null, error: { code: "23505", message: "duplicate key" } };
      const row = { id: `generated-${this.table.length}`, default_address: null, communication_preference: null, notes: null, ...this.writeObj };
      this.table.push(row);
      return { data: row, error: null };
    }
    return { data: this.table.find((r) => this.matches(r)) ?? null, error: null };
  }

  async single() {
    return this.maybeSingle();
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const run = async () => {
      if (this.mode === "update") {
        for (const row of this.table) {
          if (this.matches(row)) Object.assign(row, this.writeObj);
        }
        return { data: null, error: null };
      }
      return { data: this.table.filter((r) => this.matches(r)), error: null };
    };
    return run().then(onfulfilled, onrejected);
  }
}

class FakeSupabase {
  tables: { customers: Row[] } = { customers: [] };
  from(name: string) {
    return new FakeQuery(this.tables[name as "customers"]);
  }
}

// "server-only" throws unconditionally when required outside Next's own
// build pipeline (by design, as a guard) — harmless to no-op here.
mock.module("server-only", { namedExports: {} });

let resolveOrCreateCustomer: (typeof import("./resolve"))["resolveOrCreateCustomer"];
before(async () => {
  ({ resolveOrCreateCustomer } = await import("./resolve"));
});

const BUSINESS_ID = "biz-1";

test("a brand-new phone number creates a new customer row with the given name", async () => {
  const supabase = new FakeSupabase();
  const customer = await resolveOrCreateCustomer(supabase as any, { businessId: BUSINESS_ID, phone: "+447700900001", name: "Sarah" });
  assert.equal(customer.phone, "+447700900001");
  assert.equal(customer.name, "Sarah");
  assert.equal(supabase.tables.customers.length, 1);
});

test("a returning customer with a name already on file keeps it, even if WhatsApp now sends a different name", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.customers.push({
    id: "cust-1",
    business_id: BUSINESS_ID,
    phone: "+447700900002",
    name: "Sarah Jones",
    default_address: null,
    communication_preference: null,
    notes: null,
  });
  const customer = await resolveOrCreateCustomer(supabase as any, { businessId: BUSINESS_ID, phone: "+447700900002", name: "Sarah J" });
  assert.equal(customer.id, "cust-1");
  assert.equal(customer.name, "Sarah Jones", "an existing name must never be silently overwritten");
});

test("a returning customer with no name on file gets one filled in from WhatsApp", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.customers.push({
    id: "cust-2",
    business_id: BUSINESS_ID,
    phone: "+447700900003",
    name: null,
    default_address: null,
    communication_preference: null,
    notes: null,
  });
  const customer = await resolveOrCreateCustomer(supabase as any, { businessId: BUSINESS_ID, phone: "+447700900003", name: "Dave" });
  assert.equal(customer.name, "Dave");
});

test("a second message for a phone number never creates a duplicate customer row", async () => {
  const supabase = new FakeSupabase();
  const first = await resolveOrCreateCustomer(supabase as any, { businessId: BUSINESS_ID, phone: "+447700900004", name: "Mo" });
  const second = await resolveOrCreateCustomer(supabase as any, { businessId: BUSINESS_ID, phone: "+447700900004", name: "Mo" });
  assert.equal(first.id, second.id);
  assert.equal(supabase.tables.customers.length, 1);
});

test("a concurrent insert race (23505) resolves to the row the other request just created, not a thrown error", async () => {
  const supabase = new FakeSupabase();
  const originalFrom = supabase.from.bind(supabase);
  let insertAttempts = 0;
  supabase.from = (name: string) => {
    const query = originalFrom(name);
    const originalInsert = query.insert.bind(query);
    query.insert = (obj: Row) => {
      insertAttempts += 1;
      if (insertAttempts === 1) {
        supabase.tables.customers.push({
          id: "cust-raced",
          business_id: obj.business_id,
          phone: obj.phone,
          name: "Raced Customer",
          default_address: null,
          communication_preference: null,
          notes: null,
        });
      }
      return originalInsert(obj);
    };
    return query;
  };

  const customer = await resolveOrCreateCustomer(supabase as any, { businessId: BUSINESS_ID, phone: "+447700900005", name: "New Name" });
  assert.equal(customer.id, "cust-raced");
  assert.equal(customer.name, "Raced Customer");
});
