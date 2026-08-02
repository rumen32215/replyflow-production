import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCommunicationGuidance } from "./customer-memory-signals";

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
