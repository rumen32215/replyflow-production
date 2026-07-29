import { test } from "node:test";
import assert from "node:assert/strict";
import { describeError } from "./error-events-format";

test("a real Error yields its name and message", () => {
  const result = describeError(new TypeError("Cannot read property 'x' of undefined"));
  assert.equal(result.errorName, "TypeError");
  assert.equal(result.errorDetail, "Cannot read property 'x' of undefined");
});

test("undefined (no error passed) yields nulls, not a string", () => {
  const result = describeError(undefined);
  assert.equal(result.errorName, null);
  assert.equal(result.errorDetail, null);
});

test("a non-Error thrown value still yields a description, never throws", () => {
  const result = describeError("a plain string was thrown");
  assert.equal(result.errorName, null);
  assert.equal(result.errorDetail, "a plain string was thrown");
});

test("a very long error message is truncated, never stored unbounded", () => {
  const longMessage = "x".repeat(10_000);
  const result = describeError(new Error(longMessage));
  assert.ok(result.errorDetail !== null && result.errorDetail.length <= 300);
});

test("truncation preserves the start of the message, where the useful diagnostic detail usually is", () => {
  const result = describeError(new Error("short and useful" + "x".repeat(10_000)));
  assert.ok(result.errorDetail !== null && result.errorDetail.startsWith("short and useful"));
});
