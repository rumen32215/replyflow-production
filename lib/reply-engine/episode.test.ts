import { test, mock, before } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_CONVERSATION_STATE } from "./understanding/state";

/**
 * Regression coverage for the Product Reset Blueprint D.1 fix: a
 * booked episode used to be permanently excluded from continuity
 * consideration, so any message after a booking (even a photo of the
 * exact same job) was routed into a brand-new, context-free episode
 * with the classifier never consulted. These tests exercise the real
 * resolveEpisodeForMessage / findRecentlyBookedEpisode against a
 * minimal in-memory fake of the Supabase query builder — not a
 * reimplementation of the logic.
 */

type Row = Record<string, unknown>;

class FakeQuery implements PromiseLike<{ data: unknown; error: null }> {
  private filters: Array<[string, unknown]> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
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
  in(col: string, vals: readonly unknown[]) {
    this.filters.push([col, vals as unknown]);
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

  private matches(row: Row) {
    return this.filters.every(([col, val]) =>
      Array.isArray(val) ? (val as unknown[]).includes(row[col]) : row[col] === val
    );
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
    if (this.mode === "insert") {
      // Simulates a unique-violation on the partial "one in-progress
      // episode" index: another active/waiting_owner row already
      // exists for this conversation_id.
      const conflict = this.table.find(
        (r) =>
          r.conversation_id === this.writeObj!.conversation_id &&
          (r.status === "active" || r.status === "waiting_owner")
      );
      if (conflict) return { data: null, error: { code: "23505", message: "duplicate key" } };
      const row = { id: `generated-${this.table.length}`, ...this.writeObj };
      this.table.push(row);
      return { data: row, error: null };
    }
    return { data: this.selected()[0] ?? null, error: null };
  }

  async single() {
    return this.maybeSingle();
  }

  private async execute(): Promise<{ data: unknown; error: null }> {
    if (this.mode === "update") {
      for (const row of this.table) {
        if (this.matches(row)) Object.assign(row, this.writeObj);
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
  conversation_episodes: Row[];
  work_cards: Row[];
  reply_drafts: Row[];
  [key: string]: Row[];
}

class FakeSupabase {
  tables: FakeTables = { conversation_episodes: [], work_cards: [], reply_drafts: [] };
  from(name: string) {
    if (!this.tables[name]) this.tables[name] = [];
    return new FakeQuery(this.tables[name]);
  }
}

// "server-only" throws unconditionally when required outside Next's own
// build pipeline (by design, as a guard) — harmless to no-op here.
mock.module("server-only", { namedExports: {} });

let resolveEpisodeForMessage: (typeof import("./episode"))["resolveEpisodeForMessage"];
let findRecentlyBookedEpisode: (typeof import("./episode"))["findRecentlyBookedEpisode"];
before(async () => {
  ({ resolveEpisodeForMessage, findRecentlyBookedEpisode } = await import("./episode"));
});

const CONVERSATION_ID = "conv-1";
const BUSINESS_ID = "biz-1";

function seedBookedEpisode(
  supabase: FakeSupabase,
  opts: { episodeId: string; scheduledFor: string | null; openedAt: string }
) {
  supabase.tables.conversation_episodes.push({
    id: opts.episodeId,
    conversation_id: CONVERSATION_ID,
    business_id: BUSINESS_ID,
    status: "booked",
    opened_at: opts.openedAt,
    ai_state: { ...EMPTY_CONVERSATION_STATE, slots: { ...EMPTY_CONVERSATION_STATE.slots, issue: "leak under kitchen sink" } },
  });
  supabase.tables.work_cards.push({
    id: `wc-${opts.episodeId}`,
    episode_id: opts.episodeId,
    scheduled_for: opts.scheduledFor,
    created_at: opts.openedAt,
  });
}

test("findRecentlyBookedEpisode: an upcoming appointment is always a candidate", async () => {
  const supabase = new FakeSupabase();
  seedBookedEpisode(supabase, { episodeId: "ep-1", scheduledFor: "2026-08-20T10:00:00.000Z", openedAt: "2026-08-12T19:00:00.000Z" });
  const now = new Date("2026-08-12T20:00:00.000Z"); // well before the appointment
  const result = await findRecentlyBookedEpisode(supabase as never, CONVERSATION_ID, now);
  assert.equal(result?.id, "ep-1");
});

test("findRecentlyBookedEpisode: within the grace window after the appointment is still a candidate", async () => {
  const supabase = new FakeSupabase();
  seedBookedEpisode(supabase, { episodeId: "ep-1", scheduledFor: "2026-08-12T10:00:00.000Z", openedAt: "2026-08-11T19:00:00.000Z" });
  const now = new Date("2026-08-13T09:00:00.000Z"); // 23h after the appointment, inside 48h grace
  const result = await findRecentlyBookedEpisode(supabase as never, CONVERSATION_ID, now);
  assert.equal(result?.id, "ep-1");
});

test("D. an old booked job outside the continuity window is not offered as a candidate", async () => {
  const supabase = new FakeSupabase();
  seedBookedEpisode(supabase, { episodeId: "ep-1", scheduledFor: "2026-08-01T10:00:00.000Z", openedAt: "2026-07-31T19:00:00.000Z" });
  const now = new Date("2026-08-12T19:00:00.000Z"); // ~11 days later, well outside 48h grace
  const result = await findRecentlyBookedEpisode(supabase as never, CONVERSATION_ID, now);
  assert.equal(result, null);
});

test("a booked episode with no linked Work Card is not offered as a candidate", async () => {
  const supabase = new FakeSupabase();
  supabase.tables.conversation_episodes.push({
    id: "ep-1",
    conversation_id: CONVERSATION_ID,
    business_id: BUSINESS_ID,
    status: "booked",
    opened_at: "2026-08-12T19:00:00.000Z",
    ai_state: EMPTY_CONVERSATION_STATE,
  });
  const result = await findRecentlyBookedEpisode(supabase as never, CONVERSATION_ID, new Date("2026-08-12T20:00:00.000Z"));
  assert.equal(result, null);
});

test("a booked episode with no scheduled_for at all is not offered as a candidate", async () => {
  const supabase = new FakeSupabase();
  seedBookedEpisode(supabase, { episodeId: "ep-1", scheduledFor: null, openedAt: "2026-08-12T19:00:00.000Z" });
  const result = await findRecentlyBookedEpisode(supabase as never, CONVERSATION_ID, new Date("2026-08-12T20:00:00.000Z"));
  assert.equal(result, null);
});

test("resolveEpisodeForMessage: an in-progress episode always wins over a booked one (existing behaviour preserved)", async () => {
  const supabase = new FakeSupabase();
  seedBookedEpisode(supabase, { episodeId: "ep-booked", scheduledFor: "2026-08-20T10:00:00.000Z", openedAt: "2026-08-11T19:00:00.000Z" });
  supabase.tables.conversation_episodes.push({
    id: "ep-active",
    conversation_id: CONVERSATION_ID,
    business_id: BUSINESS_ID,
    status: "active",
    opened_at: "2026-08-12T19:00:00.000Z",
    ai_state: EMPTY_CONVERSATION_STATE,
  });
  const result = await resolveEpisodeForMessage(supabase as never, { conversationId: CONVERSATION_ID, businessId: BUSINESS_ID }, new Date("2026-08-12T20:00:00.000Z"));
  assert.equal(result.id, "ep-active");
  assert.equal(result.isNew, false);
  assert.equal(result.wasBookedCandidate, false);
});

test("resolveEpisodeForMessage: no in-progress episode, but a live booked one exists -> offered as a candidate", async () => {
  const supabase = new FakeSupabase();
  seedBookedEpisode(supabase, { episodeId: "ep-booked", scheduledFor: "2026-08-13T10:00:00.000Z", openedAt: "2026-08-12T19:00:00.000Z" });
  const result = await resolveEpisodeForMessage(supabase as never, { conversationId: CONVERSATION_ID, businessId: BUSINESS_ID }, new Date("2026-08-12T20:00:00.000Z"));
  assert.equal(result.id, "ep-booked");
  assert.equal(result.isNew, false);
  assert.equal(result.wasBookedCandidate, true);
});

test("resolveEpisodeForMessage: no in-progress and no live booked episode -> creates a new one (existing behaviour preserved)", async () => {
  const supabase = new FakeSupabase();
  seedBookedEpisode(supabase, { episodeId: "ep-old", scheduledFor: "2026-07-01T10:00:00.000Z", openedAt: "2026-06-30T19:00:00.000Z" });
  const result = await resolveEpisodeForMessage(supabase as never, { conversationId: CONVERSATION_ID, businessId: BUSINESS_ID }, new Date("2026-08-12T20:00:00.000Z"));
  assert.notEqual(result.id, "ep-old");
  assert.equal(result.isNew, true);
  assert.equal(result.wasBookedCandidate, false);
});

test("E. consecutive resolveEpisodeForMessage calls for the same burst deterministically return the same episode", async () => {
  const supabase = new FakeSupabase();
  seedBookedEpisode(supabase, { episodeId: "ep-booked", scheduledFor: "2026-08-13T10:00:00.000Z", openedAt: "2026-08-12T19:00:00.000Z" });
  const now = new Date("2026-08-12T20:00:00.000Z");
  const first = await resolveEpisodeForMessage(supabase as never, { conversationId: CONVERSATION_ID, businessId: BUSINESS_ID }, now);
  const second = await resolveEpisodeForMessage(supabase as never, { conversationId: CONVERSATION_ID, businessId: BUSINESS_ID }, now);
  const third = await resolveEpisodeForMessage(supabase as never, { conversationId: CONVERSATION_ID, businessId: BUSINESS_ID }, now);
  assert.equal(first.id, "ep-booked");
  assert.equal(second.id, "ep-booked");
  assert.equal(third.id, "ep-booked");
});
