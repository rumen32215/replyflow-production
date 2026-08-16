import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCommunicationGuidance, buildRelationshipTimeline, type CustomerJob } from "./customer-memory-signals";

function job(overrides: Partial<CustomerJob> = {}): CustomerJob {
  return {
    id: "job-1",
    jobTitle: "Leaking tap",
    status: "booked",
    scheduledFor: null,
    completedAt: null,
    notes: null,
    createdAt: "2026-01-01T09:00:00.000Z",
    estimatedValue: null,
    ...overrides,
  };
}

test("buildCommunicationGuidance: no preference stored returns null, never an empty-state sentence", () => {
  assert.equal(buildCommunicationGuidance("Dave", null), null);
});

test("buildCommunicationGuidance: whitespace-only preference is treated as none", () => {
  assert.equal(buildCommunicationGuidance("Dave", "   "), null);
});

test("buildCommunicationGuidance: turns the stored fragment into a natural sentence, name first", () => {
  const result = buildCommunicationGuidance("Dave", "Prefers a text over a call");
  assert.equal(result, "Dave prefers a text over a call.");
});

test("buildCommunicationGuidance: the raw stored text is never rewritten, only re-cased at the join point", () => {
  const result = buildCommunicationGuidance("Priya", "always ask for the side gate code");
  assert.equal(result, "Priya always ask for the side gate code.");
});

test("buildCommunicationGuidance: never doubles up punctuation the owner already typed", () => {
  const result = buildCommunicationGuidance("Dave", "Prefers a text over a call.");
  assert.equal(result, "Dave prefers a text over a call.");
});

test("buildCommunicationGuidance: adds a full stop when the owner's text has no closing punctuation", () => {
  const result = buildCommunicationGuidance("Dave", "hates being called before 9am");
  assert.ok(result?.endsWith("."));
});

test("buildCommunicationGuidance: never exposes a raw field label", () => {
  const result = buildCommunicationGuidance("Dave", "Prefers text");
  assert.ok(!result?.toLowerCase().includes("communication preference"));
  assert.ok(!result?.includes(":"));
});

/* -------- buildRelationshipTimeline (QA2 Phase 7, 2026-08-16) -------- */

test("a completed job produces one milestone, not a 'Booked in for' + 'Completed' pair", () => {
  const events = buildRelationshipTimeline({
    conversationStartedAt: "2026-01-01T09:00:00.000Z",
    jobs: [job({ status: "completed", createdAt: "2026-01-02T09:00:00.000Z", completedAt: "2026-01-05T09:00:00.000Z" })],
  });
  const jobEvents = events.filter((e) => e.id !== "enquiry");
  assert.equal(jobEvents.length, 1);
  assert.equal(jobEvents[0]!.label, "Completed — Leaking tap");
  assert.equal(jobEvents[0]!.kind, "completed");
});

test("a still-open booked job (no completedAt yet) still shows its own 'Booked in for' milestone", () => {
  const events = buildRelationshipTimeline({
    conversationStartedAt: "2026-01-01T09:00:00.000Z",
    jobs: [job({ status: "booked", completedAt: null })],
  });
  const jobEvents = events.filter((e) => e.id !== "enquiry");
  assert.equal(jobEvents.length, 1);
  assert.equal(jobEvents[0]!.label, "Booked in for Leaking tap");
  assert.equal(jobEvents[0]!.kind, "scheduled");
});

test("a draft job (customer preference, never approved) is never described as 'Booked in for' — that would claim a confirmed fact that doesn't exist", () => {
  const events = buildRelationshipTimeline({
    conversationStartedAt: "2026-01-01T09:00:00.000Z",
    jobs: [job({ status: "draft" })],
  });
  const jobEvents = events.filter((e) => e.id !== "enquiry");
  assert.equal(jobEvents.length, 1);
  assert.equal(jobEvents[0]!.label, "Requested Leaking tap");
  assert.ok(!jobEvents[0]!.label.toLowerCase().includes("booked"));
});

test("a cancelled job is unaffected by the draft/completed changes", () => {
  const events = buildRelationshipTimeline({
    conversationStartedAt: "2026-01-01T09:00:00.000Z",
    jobs: [job({ status: "cancelled" })],
  });
  const jobEvents = events.filter((e) => e.id !== "enquiry");
  assert.equal(jobEvents.length, 1);
  assert.equal(jobEvents[0]!.label, "Enquired about Leaking tap");
  assert.equal(jobEvents[0]!.kind, "cancelled");
});

test("multiple jobs each produce exactly one milestone, sorted chronologically", () => {
  const events = buildRelationshipTimeline({
    conversationStartedAt: "2026-01-01T09:00:00.000Z",
    jobs: [
      job({ id: "a", jobTitle: "Job A", status: "completed", createdAt: "2026-01-02T09:00:00.000Z", completedAt: "2026-01-03T09:00:00.000Z" }),
      job({ id: "b", jobTitle: "Job B", status: "draft", createdAt: "2026-01-10T09:00:00.000Z" }),
    ],
  });
  const jobEvents = events.filter((e) => e.id !== "enquiry");
  assert.equal(jobEvents.length, 2);
  assert.equal(jobEvents[0]!.label, "Completed — Job A");
  assert.equal(jobEvents[1]!.label, "Requested Job B");
});
