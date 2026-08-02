import { test } from "node:test";
import assert from "node:assert/strict";
import { runOrganiseCheckpoint, type OrganiseCandidate } from "./organise";

function candidate(overrides: Partial<OrganiseCandidate> = {}): OrganiseCandidate {
  return {
    conversationId: "conv-1",
    customerName: "Dave",
    impliesBooking: true,
    hasWorkCard: false,
    hasRecentPipelineFailure: false,
    ...overrides,
  };
}

test("no candidates produces no gaps", () => {
  assert.deepEqual(runOrganiseCheckpoint([]), []);
});

test("a booking-shaped conversation with no Work Card produces a gap", () => {
  const gaps = runOrganiseCheckpoint([candidate()]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]!.conversationId, "conv-1");
  assert.equal(gaps[0]!.href, "/dashboard/conversations/conv-1");
  assert.ok(gaps[0]!.text.includes("Dave"));
  assert.ok(gaps[0]!.text.includes("Work Card"));
});

test("a booking-shaped conversation that already has a Work Card produces no gap", () => {
  assert.deepEqual(runOrganiseCheckpoint([candidate({ hasWorkCard: true })]), []);
});

test("a conversation that doesn't imply a booking produces no gap, even with no Work Card", () => {
  assert.deepEqual(runOrganiseCheckpoint([candidate({ impliesBooking: false })]), []);
});

test("multiple genuine gaps are all returned, one per matching conversation", () => {
  const gaps = runOrganiseCheckpoint([
    candidate({ conversationId: "conv-1", customerName: "Dave" }),
    candidate({ conversationId: "conv-2", customerName: "Priya", hasWorkCard: true }),
    candidate({ conversationId: "conv-3", customerName: "Tom" }),
  ]);
  assert.equal(gaps.length, 2);
  assert.deepEqual(
    gaps.map((g) => g.conversationId),
    ["conv-1", "conv-3"]
  );
});

test("gap ids are stable and unique per conversation", () => {
  const gaps = runOrganiseCheckpoint([candidate({ conversationId: "abc-123" })]);
  assert.equal(gaps[0]!.id, "organise:booking-without-work-card:abc-123");
});

test("a conversation with a recent pipeline failure produces an unreplied-message gap", () => {
  const gaps = runOrganiseCheckpoint([
    candidate({ conversationId: "conv-1", customerName: "Priya", impliesBooking: false, hasRecentPipelineFailure: true }),
  ]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]!.id, "organise:unreplied-message:conv-1");
  assert.equal(gaps[0]!.href, "/dashboard/conversations/conv-1");
  assert.ok(gaps[0]!.text.includes("Priya"));
});

test("no pipeline failure means no unreplied-message gap, even if it also implies a booking with no Work Card", () => {
  const gaps = runOrganiseCheckpoint([candidate({ hasRecentPipelineFailure: false })]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0]!.id, "organise:booking-without-work-card:conv-1");
});

test("when a conversation matches both rules, the unreplied-message gap wins (listed first)", () => {
  const gaps = runOrganiseCheckpoint([candidate({ hasRecentPipelineFailure: true })]);
  assert.equal(gaps.length, 2);
  assert.equal(gaps[0]!.id, "organise:unreplied-message:conv-1");
  assert.equal(gaps[1]!.id, "organise:booking-without-work-card:conv-1");
});
