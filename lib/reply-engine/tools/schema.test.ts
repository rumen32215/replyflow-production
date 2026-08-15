import { test } from "node:test";
import assert from "node:assert/strict";
import { toolsForIntent, needsToolDecision, TOOL_SCHEMAS } from "./schema";
import { TOOL_NAMES } from "./types";
import { INTENTS } from "../understanding/types";

/**
 * The deterministic intent -> tool-availability gate. This is what
 * guarantees "a general question never produces a tool call" without
 * relying on the model to decline — every case here is checked without
 * ever making an LLM call.
 */

test("a general question (BUSINESS_INFORMATION) offers no tools at all — no unnecessary tool call is possible", () => {
  assert.deepEqual(toolsForIntent("BUSINESS_INFORMATION"), []);
  assert.equal(needsToolDecision({ primaryIntent: "BUSINESS_INFORMATION" }), false);
});

test("SOCIAL, PRICING_INQUIRY, PAYMENT_QUERY, and UNCLEAR all offer no tools", () => {
  for (const intent of ["SOCIAL", "PRICING_INQUIRY", "PAYMENT_QUERY", "UNCLEAR"] as const) {
    assert.deepEqual(toolsForIntent(intent), [], `${intent} should offer no tools`);
  }
});

test("EMERGENCY offers escalate_to_owner only — a normal booking flow is structurally impossible", () => {
  assert.deepEqual(toolsForIntent("EMERGENCY"), ["escalate_to_owner"]);
});

test("COMPLAINT offers escalate_to_owner only", () => {
  assert.deepEqual(toolsForIntent("COMPLAINT"), ["escalate_to_owner"]);
});

test("BOOKING_REQUEST offers the real booking toolset", () => {
  const tools = toolsForIntent("BOOKING_REQUEST");
  assert.ok(tools.includes("check_availability"));
  assert.ok(tools.includes("create_booking"));
  assert.ok(tools.includes("create_or_update_job"));
  assert.ok(tools.includes("get_customer_context"));
  assert.ok(tools.includes("escalate_to_owner"));
  assert.equal(tools.includes("update_booking"), false, "a brand new request should never offer update_booking");
});

test("BOOKING_CHANGE and BOOKING_CANCELLATION offer update_booking, never create_booking", () => {
  for (const intent of ["BOOKING_CHANGE", "BOOKING_CANCELLATION"] as const) {
    const tools = toolsForIntent(intent);
    assert.ok(tools.includes("update_booking"));
    assert.equal(tools.includes("create_booking"), false);
  }
});

test("RETURNING_PROBLEM offers customer-history and job tools", () => {
  const tools = toolsForIntent("RETURNING_PROBLEM");
  assert.ok(tools.includes("get_customer_context"));
  assert.ok(tools.includes("create_or_update_job"));
});

test("needsToolDecision is true for every intent with a non-empty toolset, false otherwise", () => {
  for (const intent of INTENTS) {
    assert.equal(needsToolDecision({ primaryIntent: intent }), toolsForIntent(intent).length > 0, `mismatch for ${intent}`);
  }
});

test("every tool name has a real schema, and every schema is strict-mode shaped", () => {
  for (const name of TOOL_NAMES) {
    const schema = TOOL_SCHEMAS[name];
    assert.equal(schema.name, name);
    assert.ok(schema.description.length > 0);
    const params = schema.parameters as { type: string; additionalProperties: boolean; properties: Record<string, unknown>; required: string[] };
    assert.equal(params.type, "object");
    assert.equal(params.additionalProperties, false);
    // Strict mode requires every declared property to be listed in
    // `required` (optionality is expressed via nullable types instead).
    assert.deepEqual(new Set(Object.keys(params.properties)), new Set(params.required));
  }
});
