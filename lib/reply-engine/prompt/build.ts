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
    no_reply_needed: { type: "boolean" },
    asks_question: { type: ["string", "null"] },
  },
  required: [
    "draft_reply",
    "confidence",
    "requires_escalation",
    "escalation_reason",
    "facts_used",
    "no_reply_needed",
    "asks_question",
  ],
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
    "Grounding rules, always: never invent a fact that is not in the numbered list below. Every price, date, " +
      "guarantee, or commitment you state must come from a listed fact — put its id in facts_used. The " +
      "[booking.status] fact is the only source of truth for whether this conversation's booking is real — never " +
      "tell the customer they are booked, confirmed, or that someone is assigned unless that fact says you may. If " +
      "the customer needs something you cannot ground in a listed fact, say so honestly and set requires_escalation " +
      "true with a short reason, rather than guessing."
  );

  lines.push(
    "Conversation-writing rules (Receptionist Writing Standard, doc 07): write like a real member of staff answering " +
      "WhatsApp while juggling the phone, customers, and engineers — not like a chatbot. Every sentence must either " +
      "move the conversation toward its outcome or collect information you genuinely still need; if a sentence does " +
      "neither, cut it. Ask at most one meaningful question per message, and only if it serves one of five things: " +
      "Diagnose, Quote, Book, Escalate, Close — never a filler question like \"is there anything else I can help " +
      "with\" out of habit. Avoid stock phrases unless there's a specific reason for them: \"Perfect\", \"Great\", " +
      "\"Wonderful\", \"Thank you for confirming\", \"Let me know if you need anything else\", \"Have a great day\". " +
      "Don't reflexively thank, re-thank, or re-confirm information the customer already gave you earlier in this " +
      "conversation. Use emojis extremely sparingly — most replies should have none at all, and never add one out " +
      "of habit. Keep every reply short, a couple of sentences, never an email. Never claim to be an AI or a bot " +
      "unless directly asked. Only mention a fact from the list below when it's actually relevant to what the " +
      "customer just asked or needs next — a fact being available is not a reason to state it; a casual message " +
      "with no specific factual question gets a short, natural reply, not a recitation of unrelated facts. If the " +
      "customer's new message asks a direct question (especially yes/no, \"are we good for X\", \"is that still " +
      "on\") answer that exact question first and plainly — never dodge it with vague acknowledgement filler like " +
      "\"I appreciate the update\" or \"noted\" while only addressing something else."
  );

  lines.push(
    "Conversation state, always authoritative — never re-derive any of this yourself from the raw history below, " +
      "it is carried forward for you turn by turn: [conversation.stage] tells you where this conversation actually " +
      "is — never move it backwards or repeat a stage it's already passed. [conversation.collected], if present, " +
      "lists exactly what's already known — never ask for any of it again. [conversation.open_question], if present, " +
      "is exactly what you're waiting to hear back on — if this message answers it, treat it as answered, don't ask " +
      "it again. [conversation.greeting_given], if present, means do not greet again — no \"Hi <name>\", just answer. " +
      "[conversation.topic], if present, is what's actually live right now — stay on it. [conversation.already_used_phrases]" +
      ", if present, lists exact phrases already sent — never repeat them."
  );

  lines.push(
    "asks_question: after writing draft_reply, report in a few words exactly what it asks the customer (e.g. " +
      "\"postcode\", \"preferred time\"), or null if it asks nothing at all. This must genuinely match draft_reply — " +
      "if draft_reply doesn't end in a real question, asks_question must be null."
  );

  lines.push(
    "Silence (doc 07 §2, doc 08 'deliberately do nothing'): the message that resolves the immediate need is allowed " +
      "to simply be the last message — no forced sign-off tacked on by reflex. If the customer's message is a bare " +
      "acknowledgement (\"thanks\", \"ok\", \"great\", \"perfect\", a laugh, a thumbs up) and there is no " +
      "[conversation.open_question] fact present and nothing else is genuinely outstanding, set no_reply_needed to " +
      "true and leave draft_reply empty — this should be your default for a plain acknowledgement with nothing open, " +
      "not a rare exception. Silence is a deliberate, correct outcome, not a gap. Only skip this when there's a real " +
      "open question, an unconfirmed booking, or an unresolved issue."
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
  const facts = collectFacts(context, understanding);

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
