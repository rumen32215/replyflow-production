import { test } from "node:test";
import assert from "node:assert/strict";
import { DRAFT_LOCK_STALE_MS, draftLockStaleThreshold, isDraftLockFree } from "./draft-lock";

const NOW = new Date("2026-08-08T12:00:00.000Z");

test("no lock recorded (null) is free", () => {
  assert.equal(isDraftLockFree(null, NOW), true);
});

test("a lock acquired moments ago is not free", () => {
  const lockedAt = new Date(NOW.getTime() - 1000).toISOString();
  assert.equal(isDraftLockFree(lockedAt, NOW), false);
});

test("a lock acquired right now is not free", () => {
  assert.equal(isDraftLockFree(NOW.toISOString(), NOW), false);
});

test("a lock older than the stale window is free again", () => {
  const lockedAt = new Date(NOW.getTime() - DRAFT_LOCK_STALE_MS - 1000).toISOString();
  assert.equal(isDraftLockFree(lockedAt, NOW), true);
});

test("a lock exactly at the stale boundary is not yet free (strict less-than)", () => {
  const lockedAt = new Date(NOW.getTime() - DRAFT_LOCK_STALE_MS).toISOString();
  assert.equal(isDraftLockFree(lockedAt, NOW), false);
});

test("draftLockStaleThreshold subtracts the stale window from now", () => {
  const threshold = draftLockStaleThreshold(NOW);
  assert.equal(threshold, new Date(NOW.getTime() - DRAFT_LOCK_STALE_MS).toISOString());
});

test("a custom stale window is respected by both helpers", () => {
  const customMs = 5000;
  const threshold = draftLockStaleThreshold(NOW, customMs);
  assert.equal(threshold, new Date(NOW.getTime() - customMs).toISOString());

  const justInside = new Date(NOW.getTime() - customMs + 1).toISOString();
  const justOutside = new Date(NOW.getTime() - customMs - 1).toISOString();
  assert.equal(isDraftLockFree(justInside, NOW, customMs), false);
  assert.equal(isDraftLockFree(justOutside, NOW, customMs), true);
});
