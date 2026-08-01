import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBrain, type BrainInput } from "./reasoning";
import type { OrganiseCandidate } from "./organise";

function candidate(overrides: Partial<OrganiseCandidate> = {}): OrganiseCandidate {
  return {
    conversationId: "conv-1",
    customerName: "Dave",
    impliesBooking: true,
    hasWorkCard: false,
    ...overrides,
  };
}

test("buildBrain: omitting organise entirely produces no organise observation (backward compatible)", () => {
  const brain = buildBrain({});
  assert.equal(brain.observations.some((o) => o.id.startsWith("organise:")), false);
});

test("buildBrain: organise input with no real gaps produces no organise observation", () => {
  const input: BrainInput = { organise: { candidates: [candidate({ hasWorkCard: true })] } };
  const brain = buildBrain(input);
  assert.equal(brain.observations.some((o) => o.id.startsWith("organise:")), false);
});

test("buildBrain: a real organise gap surfaces as a real observation", () => {
  const input: BrainInput = { organise: { candidates: [candidate()] } };
  const brain = buildBrain(input);
  const organiseObs = brain.observations.find((o) => o.id.startsWith("organise:"));
  assert.ok(organiseObs);
  assert.equal(organiseObs!.tone, "watching");
  assert.equal(organiseObs!.href, "/dashboard/conversations/conv-1");
  assert.ok(organiseObs!.text.includes("Dave"));
});

test("buildBrain: a waiting customer still ranks ahead of an organise gap", () => {
  const input: BrainInput = {
    organise: { candidates: [candidate()] },
    activity: {
      whatsappConnected: true,
      waitingCount: 1,
      oldestWaitingName: "Priya",
      oldestWaitingMinutes: 20,
      completedToday: 0,
      bookedToday: 0,
    },
  };
  const brain = buildBrain(input);
  assert.equal(brain.observations[0]!.id, "watching:waiting");
  assert.ok(brain.observations.some((o) => o.id.startsWith("organise:")));
});

test("buildBrain: only the top organise gap becomes an observation, even with several real gaps", () => {
  const input: BrainInput = {
    organise: {
      candidates: [
        candidate({ conversationId: "conv-1", customerName: "Dave" }),
        candidate({ conversationId: "conv-2", customerName: "Priya" }),
      ],
    },
  };
  const brain = buildBrain(input);
  const organiseObs = brain.observations.filter((o) => o.id.startsWith("organise:"));
  assert.equal(organiseObs.length, 1);
  assert.equal(organiseObs[0]!.id, "organise:booking-without-work-card:conv-1");
});
