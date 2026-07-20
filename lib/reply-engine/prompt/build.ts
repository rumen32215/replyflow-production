import type { CompletionMessage, JsonSchemaSpec } from "../llm/types";
import type { UnderstandingResult } from "../understanding/types";
import type { ReplyContext } from "../context/types";
import { collectFacts, type Fact } from "./facts";

/**
 * Deterministic prompt construction (Sprint 9 §5) — four blocks, always
 * in the same order, built entirely from data Context Assembly already
 * gathered. Nothing here calls an LLM or a database; the same context
 * always produces the same prompt.
 */

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    draft_reply: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high", "verified"] },
    requires_escalation: { type: "boolean" },
    escalation_reason: { type: ["string", "null"] },
    facts_used: { type: "array", items: { type: "string" } },
  },
  required: ["draft_reply", "confidence", "requires_escalation", "escalation_reason", "facts_used"],
} as const;

function buildSystemBlock(context: ReplyContext, facts: Fact[]): string {
  const r = context.receptionist;
  const businessName = context.businessProfile?.businessName ?? "the business";
  const receptionistName = context.businessProfile?.receptionistName;

  const lines: string[] = [
    `You are ${receptionistName ? `${receptionistName}, ` : ""}the WhatsApp receptionist for ${businessName}, a ${
      context.businessProfile?.trade ?? "trade/service"
    } business in the UK. You reply to real customers on WhatsApp.`,
  ];

  if (r?.tone) lines.push(`Tone: ${r.tone}.`);
  if (r?.behaviours) lines.push(`What you should always do: ${r.behaviours}`);
  if (r?.businessRules) lines.push(`House rules you must never break: ${r.businessRules}`);
  if (r?.escalationRules) lines.push(`When to hand off to the owner instead of answering yourself: ${r.escalationRules}`);

  lines.push(
    "Hard rules, always: never invent a fact that is not in the numbered list below. Every price, date, guarantee, " +
      "or commitment you state must come from a listed fact — put its id in facts_used. If the customer needs " +
      "something you cannot ground in a listed fact, say so honestly and set requires_escalation true with a short " +
      "reason, rather than guessing. Keep the reply short and natural for WhatsApp — a couple of sentences, not an " +
      "email. Never claim to be an AI or a bot unless directly asked."
  );

  if (facts.length === 0) {
    lines.push("No business facts are available for this message — do not invent any; escalate instead.");
  }

  return lines.join("\n");
}

function buildFactsBlock(facts: Fact[]): string {
  if (facts.length === 0) return "";
  const lines = facts.map((f) => `[${f.id}] ${f.text}`);
  return `Known facts about this business (cite by id in facts_used when you rely on one):\n${lines.join("\n")}`;
}

function buildCustomerContextBlock(context: ReplyContext): string {
  const parts: string[] = [];

  if (context.customerMemory) {
    parts.push(`About this customer: ${context.customerMemory.summary} (${context.customerMemory.relationshipStrength}).`);
  }

  if (context.conversationHistory && context.conversationHistory.messages.length > 0) {
    const lines = context.conversationHistory.messages.map(
      (m) => `${m.direction === "inbound" ? "Customer" : "You"}: ${m.body}`
    );
    parts.push(`Recent conversation:\n${lines.join("\n")}`);
  }

  return parts.join("\n\n");
}

function buildNewMessageBlock(context: ReplyContext, understanding: UnderstandingResult): string {
  const who = context.newMessage.customerName || context.newMessage.customerPhone;
  const lines = [`New message from ${who}: "${context.newMessage.body}"`];
  lines.push(`Detected intent: ${understanding.primaryIntent}${understanding.secondaryIntents.length ? ` (also: ${understanding.secondaryIntents.join(", ")})` : ""}.`);
  if (understanding.meaningEntities.urgency !== "none") lines.push(`Urgency: ${understanding.meaningEntities.urgency}.`);
  return lines.join("\n");
}

export interface BuiltPrompt {
  messages: CompletionMessage[];
  jsonSchema: JsonSchemaSpec;
  facts: Fact[];
}

export function buildPrompt(context: ReplyContext, understanding: UnderstandingResult): BuiltPrompt {
  const facts = collectFacts(context);

  const system = buildSystemBlock(context, facts);
  const userBlocks = [buildFactsBlock(facts), buildCustomerContextBlock(context), buildNewMessageBlock(context, understanding)].filter(
    Boolean
  );

  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: userBlocks.join("\n\n") },
    ],
    jsonSchema: { name: "reply_draft", schema: RESPONSE_SCHEMA },
    facts,
  };
}
