import { test } from "node:test";
import assert from "node:assert/strict";
import { isAdminEmail } from "./admin";

test("a listed email is recognised as admin", () => {
  assert.equal(isAdminEmail("founder@example.com", "founder@example.com"), true);
});

test("an unlisted email is never admin", () => {
  assert.equal(isAdminEmail("someone@example.com", "founder@example.com"), false);
});

test("matches case-insensitively", () => {
  assert.equal(isAdminEmail("Founder@Example.com", "founder@example.com"), true);
});

test("handles a real comma-separated allowlist", () => {
  assert.equal(isAdminEmail("second@example.com", "founder@example.com, second@example.com"), true);
});

test("null or undefined email is never admin", () => {
  assert.equal(isAdminEmail(null, "founder@example.com"), false);
  assert.equal(isAdminEmail(undefined, "founder@example.com"), false);
});

test("an unset allowlist blocks everyone, never defaults to open", () => {
  assert.equal(isAdminEmail("founder@example.com", undefined), false);
  assert.equal(isAdminEmail("founder@example.com", ""), false);
});

test("a stray empty entry in the allowlist (trailing comma) is never treated as a match for an empty email", () => {
  assert.equal(isAdminEmail("", "founder@example.com,"), false);
});
