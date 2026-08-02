import { test } from "node:test";
import assert from "node:assert/strict";
import { toLessonResult } from "./lesson-result";

test("a confident, well-formed lesson is returned trimmed", () => {
  const result = toLessonResult({ has_lesson: true, lesson: "  It looks like you charge extra after 6pm.  " });
  assert.equal(result, "It looks like you charge extra after 6pm.");
});

test("has_lesson false always returns null, even if lesson text is present", () => {
  const result = toLessonResult({ has_lesson: false, lesson: "This should never be used." });
  assert.equal(result, null);
});

test("a missing or malformed has_lesson field returns null, never assumed true", () => {
  assert.equal(toLessonResult({ lesson: "Something" }), null);
  assert.equal(toLessonResult({ has_lesson: "true", lesson: "Something" }), null);
});

test("an empty or whitespace-only lesson returns null even when has_lesson is true", () => {
  assert.equal(toLessonResult({ has_lesson: true, lesson: "" }), null);
  assert.equal(toLessonResult({ has_lesson: true, lesson: "   " }), null);
});

test("a non-string lesson returns null", () => {
  assert.equal(toLessonResult({ has_lesson: true, lesson: null }), null);
  assert.equal(toLessonResult({ has_lesson: true, lesson: 42 }), null);
});

test("completely malformed or missing raw output returns null, never throws", () => {
  assert.equal(toLessonResult(null), null);
  assert.equal(toLessonResult(undefined), null);
  assert.equal(toLessonResult("not an object"), null);
  assert.equal(toLessonResult({}), null);
});
