/**
 * The receptionist's brain — pure functions only, no React, no Supabase.
 *
 * Owners teach behaviours; ReplyFlow writes the conversation. This is
 * the single module that converts taught knowledge into the natural
 * replies shown in every live preview (Receptionist playground,
 * onboarding, Business "instant understanding"). Deterministic on
 * purpose: real facts slotted into pre-written natural shapes, so the
 * preview can never invent prices, availability, or services
 * (Receptionist V1: "ReplyFlow never guesses").
 *
 * The `text` on each teaching option is the exact string persisted in
 * ai_configurations (system_prompt / business_rules / escalation_rules),
 * so the schema and any previously saved data keep working unchanged.
 */

export type Tone = "professional" | "friendly" | "concise";

export interface TeachingOption {
  id: string;
  label: string;
  text: string;
}

export const BEHAVIOUR_OPTIONS: readonly TeachingOption[] = [
  { id: "ask-problem", label: "Ask what the problem is", text: "Ask the customer what the problem is." },
  { id: "ask-photos", label: "Ask for photos first", text: "Ask if they can send a photo of the issue." },
  { id: "ask-postcode", label: "Ask for their postcode", text: "Ask for their postcode." },
  { id: "mention-emergency", label: "Mention emergency call-outs", text: "Mention that emergency call-outs are available if it's urgent." },
  { id: "short-replies", label: "Keep replies short", text: "Keep replies short and easy to read on a phone." },
  { id: "someone-will-contact", label: "Say someone will be in touch", text: "Let the customer know a team member will be in touch soon." },
] as const;

export const RULE_OPTIONS: readonly TeachingOption[] = [
  { id: "no-exact-prices", label: "Never give exact prices", text: "Never give exact prices over chat — say the team will confirm pricing after a quick look." },
  { id: "no-arrival-times", label: "Never promise arrival times", text: "Never promise a specific arrival time — say the team will confirm timing." },
  { id: "mention-callout-fee", label: "Always mention the call-out fee", text: "Always mention the call-out fee upfront if the business charges one." },
  { id: "always-ask-photos", label: "Always ask for photos", text: "Always ask for a photo of the issue before finishing the conversation." },
] as const;

export const ESCALATION_OPTIONS: readonly TeachingOption[] = [
  { id: "gas-leak", label: "A gas leak is mentioned", text: "Hand off immediately if the customer mentions a gas leak." },
  { id: "flooding", label: "There's flooding", text: "Hand off immediately if there's flooding or major water damage." },
  { id: "wants-person", label: "They ask for a person", text: "Hand off if the customer directly asks to speak to a person." },
  { id: "complaint", label: "They're unhappy", text: "Hand off if the customer is making a complaint." },
] as const;

/** Reverse-detects which options are "on" inside a saved plain-text
 * string; unmatched leftovers become free-form notes so nothing an
 * owner taught before this redesign is ever lost. */
export function parseOptions(saved: string, options: readonly TeachingOption[]) {
  const selected = new Set<string>();
  let remainder = saved;
  for (const option of options) {
    if (remainder.includes(option.text)) {
      selected.add(option.id);
      remainder = remainder.replace(option.text, "");
    }
  }
  return { selected, notes: remainder.replace(/^\s*\n+|\n+\s*$/g, "").trim() };
}

/** Turns teaching state back into the persisted string. */
export function composeOptions(options: readonly TeachingOption[], selected: Set<string>, notes: string) {
  return [...options.filter((o) => selected.has(o.id)).map((o) => o.text), notes.trim()]
    .filter(Boolean)
    .join("\n");
}

export interface PreviewKnowledge {
  businessName: string;
  tone: Tone;
  behaviours: Set<string>;
  rules: Set<string>;
  escalation: Set<string>;
  offersEmergency: boolean;
  chargesCalloutFee: boolean;
  calloutFeeAmount: string | null;
}

/**
 * What kind of exchange this is — drives which reply is composed
 * below. Kept separate from the scenario's id/label/message so the
 * owner-facing scenario picker can show real customer problems
 * (Receptionist V3.1) while the underlying reply logic keeps its
 * original four behaviours.
 */
export type ScenarioKind = "standard" | "quote" | "emergency" | "price";

export interface PreviewScenario {
  id: string;
  label: string;
  customerMessage: string;
  kind: ScenarioKind;
}

/** Real customer problems, not developer categories — this is what
 * watching real customers looks like, not "Scenario 3: Emergency." */
export const PREVIEW_SCENARIOS: readonly PreviewScenario[] = [
  { id: "boiler-leak", label: "Boiler leaking", customerMessage: "Hi, my boiler's leaking water from underneath — can someone come out?", kind: "emergency" },
  { id: "no-hot-water", label: "No hot water", customerMessage: "We've had no hot water since this morning, can you help?", kind: "standard" },
  { id: "kitchen-tap", label: "Kitchen tap", customerMessage: "My kitchen tap won't stop dripping — how much would that be to fix?", kind: "price" },
  { id: "radiator", label: "Radiator issue", customerMessage: "One of my radiators isn't heating up properly.", kind: "standard" },
  { id: "blocked-drain", label: "Blocked drain", customerMessage: "The drain outside our kitchen is completely blocked.", kind: "standard" },
  { id: "bathroom-install", label: "Bathroom installation", customerMessage: "Could I get a quote for a full bathroom installation?", kind: "quote" },
] as const;

/**
 * Which stage this simulated exchange is in — shown as a StatusPill
 * next to the preview so the owner instantly reads what's happening,
 * the same way conversation status works in the real inbox. Honest
 * about what a single demo exchange can actually represent: it never
 * claims a booking or a closed conversation, only what's genuinely
 * derivable from the scenario and what's been taught (Receptionist
 * V1: never guess).
 */
export function deriveScenarioStatus(scenario: PreviewScenario, k: Pick<PreviewKnowledge, "escalation">): {
  label: string;
  tone: "urgent" | "waiting-owner" | "waiting";
} {
  if (scenario.kind === "emergency") {
    if (k.escalation.has("flooding")) return { label: "Waiting for owner", tone: "waiting-owner" };
    return { label: "Urgent", tone: "urgent" };
  }
  return { label: "Waiting for customer", tone: "waiting" };
}

function greetingFor(tone: Tone, businessName: string): string {
  switch (tone) {
    case "professional":
      return `Hello, thanks for contacting ${businessName}. How can we help today?`;
    case "concise":
      return `${businessName} here — what's the issue?`;
    default:
      return `Hi there! Thanks for getting in touch with ${businessName}. How can I help?`;
  }
}

/**
 * Builds the settled turns plus the live reply for a scenario.
 * Every taught behaviour visibly changes the words — the owner sees
 * exactly how their teaching becomes conversation.
 */
export function buildPreviewConversation(k: PreviewKnowledge, scenario: PreviewScenario) {
  const turns = [
    { from: "receptionist" as const, text: greetingFor(k.tone, k.businessName) },
    { from: "customer" as const, text: scenario.customerMessage },
  ];

  const has = (id: string) => k.behaviours.has(id);
  const rule = (id: string) => k.rules.has(id);
  const parts: string[] = [];

  if (scenario.kind === "emergency") {
    if (k.escalation.has("flooding")) {
      parts.push("That sounds urgent — I'm letting the owner know right now, and turning off your water at the stopcock will help in the meantime.");
    } else {
      parts.push("I'm really sorry — that sounds urgent.");
      if (k.offersEmergency || has("mention-emergency")) parts.push("We do offer emergency call-outs, so someone can get to you quickly.");
      if (has("ask-postcode")) parts.push("Could I take your postcode so we can get on our way?");
      else parts.push("Could I take your address?");
    }
  } else if (scenario.kind === "price") {
    if (rule("no-exact-prices")) {
      parts.push("I can't give an exact price over chat, but the team will confirm pricing after a quick look at the job.");
    }
    if (k.chargesCalloutFee && (rule("mention-callout-fee") || !rule("no-exact-prices"))) {
      parts.push(
        k.calloutFeeAmount
          ? `There's a call-out fee of ${k.calloutFeeAmount}, which we'll always mention upfront.`
          : "There is a small call-out fee, which we'll always mention upfront."
      );
    } else if (!rule("no-exact-prices")) {
      parts.push("It depends on the job, but I can get you an accurate quote quickly.");
    }
    if (has("ask-photos") || rule("always-ask-photos")) {
      parts.push("If you can send a couple of photos, that'll help us give you a much better idea.");
    }
  } else if (scenario.kind === "quote") {
    parts.push("Of course — happy to help with that.");
    if (has("ask-photos") || rule("always-ask-photos")) {
      parts.push("Could you send me a few photos of the job first? That way the quote will be accurate.");
    } else if (has("ask-problem")) {
      parts.push("Could you tell me a little about the job?");
    }
    if (has("ask-postcode")) parts.push("And could I grab your postcode?");
    if (rule("no-exact-prices")) parts.push("The team will confirm the final price after a quick look.");
  } else {
    // A standard new enquiry.
    parts.push("I'm sorry to hear that.");
    if (has("ask-photos") || rule("always-ask-photos")) {
      parts.push("Could you send me a few photos first so I can understand the job?");
    } else if (has("ask-problem")) {
      parts.push("Could you tell me a bit more about what's happening?");
    }
    if (has("ask-postcode")) parts.push("Could I also take your postcode?");
    if (has("mention-emergency") && k.offersEmergency) {
      parts.push("If it's urgent, we do offer emergency call-outs.");
    }
  }

  if (has("someone-will-contact") && scenario.kind !== "emergency") {
    parts.push("A team member will be in touch shortly after that.");
  }

  let reply = parts.join(" ").trim();
  if (!reply) reply = "Thanks for getting in touch — how can I help today?";
  if (has("short-replies") && reply.length > 170) {
    // Keep replies phone-sized: first two sentences only.
    const sentences = reply.match(/[^.!?]+[.!?]/g) ?? [reply];
    reply = sentences.slice(0, 2).join(" ").trim();
  }

  return { turns, liveReply: reply };
}
