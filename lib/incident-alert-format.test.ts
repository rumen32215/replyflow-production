import { test } from "node:test";
import assert from "node:assert/strict";
import { formatIncidentAlertText } from "./incident-alert-format";

test("includes the message and source", () => {
  const text = formatIncidentAlertText({ source: "webhook.processing_failed", message: "Something broke.", businessId: null });
  assert.ok(text.includes("Something broke."));
  assert.ok(text.includes("source: webhook.processing_failed"));
});

test("includes the business id when known", () => {
  const text = formatIncidentAlertText({ source: "reply-engine.pipeline_failure", message: "x", businessId: "abc-123" });
  assert.ok(text.includes("business: abc-123"));
});

test("omits the business line entirely when null, rather than printing 'business: null'", () => {
  const text = formatIncidentAlertText({ source: "webhook.signature_invalid", message: "x", businessId: null });
  assert.ok(!text.includes("business:"));
});
