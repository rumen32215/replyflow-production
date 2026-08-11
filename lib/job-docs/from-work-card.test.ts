import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJobDocSeedFromWorkCard, type WorkCardForJobDoc } from "./from-work-card";

const base: WorkCardForJobDoc = {
  customerName: "Rumen/Orhan",
  issue: "boiler leaking",
  address: "SW1A 1AA",
  conversationSummary: "Customer has a leaking boiler",
  collectedDetails: "Boiler is under the kitchen sink",
  notes: null,
  scheduledFor: "2026-08-11T13:00:00.000Z",
  completedAt: null,
};

test("title prefers the address when known", () => {
  const seed = buildJobDocSeedFromWorkCard(base);
  assert.equal(seed.title, "Rumen/Orhan — SW1A 1AA");
});

test("title falls back to the issue when there is no address yet", () => {
  const seed = buildJobDocSeedFromWorkCard({ ...base, address: null });
  assert.equal(seed.title, "Rumen/Orhan — boiler leaking");
});

test("raw notes combine conversation summary, collected details, and notes — nothing retyped", () => {
  const seed = buildJobDocSeedFromWorkCard({ ...base, notes: "Customer has a dog, ring the bell twice" });
  assert.equal(
    seed.rawNotes,
    "Customer has a leaking boiler\n\nBoiler is under the kitchen sink\n\nCustomer has a dog, ring the bell twice"
  );
});

test("raw notes skip empty fields rather than leaving blank gaps", () => {
  const seed = buildJobDocSeedFromWorkCard({ ...base, notes: null });
  assert.equal(seed.rawNotes, "Customer has a leaking boiler\n\nBoiler is under the kitchen sink");
});

test("raw notes fall back to the issue when every text field is empty", () => {
  const seed = buildJobDocSeedFromWorkCard({
    ...base,
    conversationSummary: null,
    collectedDetails: null,
    notes: null,
  });
  assert.equal(seed.rawNotes, "Job: boiler leaking");
});

test("job date prefers completedAt over scheduledFor", () => {
  const seed = buildJobDocSeedFromWorkCard({ ...base, completedAt: "2026-08-11T15:00:00.000Z" });
  assert.equal(seed.jobDate, "2026-08-11T15:00:00.000Z");
});

test("job date falls back to scheduledFor when the job isn't marked completed yet", () => {
  const seed = buildJobDocSeedFromWorkCard(base);
  assert.equal(seed.jobDate, base.scheduledFor);
});

test("job date is null when neither exists", () => {
  const seed = buildJobDocSeedFromWorkCard({ ...base, scheduledFor: null, completedAt: null });
  assert.equal(seed.jobDate, null);
});
