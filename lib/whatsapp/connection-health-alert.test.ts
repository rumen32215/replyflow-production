import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConnectionHealthAlert } from "./connection-health-alert";

const now = new Date("2026-08-01T12:00:00Z");

test("returns null when the token has no expiry (never connected via embedded signup path this check covers)", () => {
  assert.equal(buildConnectionHealthAlert({ tokenExpiresAt: null, now }), null);
});

test("returns null when the connection is healthy", () => {
  const tokenExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(buildConnectionHealthAlert({ tokenExpiresAt, now }), null);
});

test("returns a warning when the token expires soon but hasn't yet", () => {
  const tokenExpiresAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const alert = buildConnectionHealthAlert({ tokenExpiresAt, now });
  assert.equal(alert?.severity, "warning");
  assert.equal(alert?.source, "webhook.whatsapp_token_expiring_soon");
  assert.ok(alert?.message.length);
});

test("returns a critical alert once the token has actually expired", () => {
  const tokenExpiresAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const alert = buildConnectionHealthAlert({ tokenExpiresAt, now });
  assert.equal(alert?.severity, "critical");
  assert.equal(alert?.source, "webhook.whatsapp_token_expired");
  assert.ok(alert?.message.length);
});
