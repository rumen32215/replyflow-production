import { ONBOARDING_TRADES, ONBOARDING_TRADE_LABELS } from "@/lib/trades";
import type { BusinessKnowledge } from "@/lib/knowledge";

/**
 * The hiring conversation's authored content — doc 15 §4 / SPECS §2, §4
 * (DOCS/CONSTITUTION/15-..., DOCS/SPECS/ReplyFlow-Onboarding-
 * Implementation-Architecture.md). Fixed, reviewed copy, not a live
 * model call — the input space (five trades, a handful of yes/no
 * branches) is small and fully enumerable, so there's no reason to
 * accept the inconsistency risk of generating it at runtime. Imported
 * by both `hiring-conversation.tsx` (to render) and
 * `/api/onboarding/prepare` (to apply the same mapping server-side) —
 * one source of truth for what an answer actually means, not copy
 * duplicated in two places.
 */

type Trade = (typeof ONBOARDING_TRADES)[number];

function tradeLabel(trade: string): string {
  return (ONBOARDING_TRADE_LABELS[trade as Trade] ?? trade).toLowerCase();
}

function formatAreas(areas: string[]): string {
  if (areas.length === 0) return "";
  if (areas.length === 1) return areas[0]!;
  return `${areas.slice(0, -1).join(", ")} and ${areas[areas.length - 1]}`;
}

/** Learn beat — what changes about what it listens for, per trade. */
export const TRADE_VOCAB: Record<Trade, string> = {
  plumbing: "someone says they've got a leak or no hot water, I'll know exactly what that means.",
  electrical: "someone says their consumer unit's tripping, I'll know exactly what that means.",
  roofing: "someone says water's coming through the ceiling, I'll know that's not routine.",
  building: "someone mentions an extension or a loft conversion, I'll know that's a proper job, not a quick fix.",
  painting: "someone says their lounge needs doing, I'll know that's a room, not a whole house, unless they say otherwise.",
};

/**
 * Prepare beat — the hours guess. Weaves the trade back in ("since
 * you're an electrician...") because that's how a person who was
 * actually listening earlier would ask, not because it's citing what
 * other electricians do — the guess itself is still framed as this
 * conversation's own inference, never an aggregate from a library of
 * other businesses (the "learner, not expert" correction).
 */
export function hoursGuessLine(trade: string): string {
  return `Since you're ${/^[aeiou]/i.test(tradeLabel(trade)) ? "an" : "a"} ${tradeLabel(trade)}, I'm picturing weekdays, roughly eight till half five — is that close?`;
}

/** Widen beat — the area guess is framing only, never a strict
 * guess/correct binary: there's no postcode to derive named places
 * from a mileage number, so both branches lead into the same chip
 * input next, just with different lead-in copy. */
export const AREA_GUESS_LINE =
  "Can I check my thinking? I'd picture a fairly local patch, not the whole county — closer to ten miles, or twenty?";
export const AREA_LEAD_IN = {
  accepted: "Good — that's the shape, then. Where exactly?",
  corrected: "Fair — let's get specific.",
} as const;

/** Understand beat — domestic/commercial. Genuine curiosity, not
 * required configuration: `null` (skipped or dismissed) is a fully
 * valid, expected answer, and nothing downstream assumes otherwise. */
export function customerTypeConsequence(answer: "domestic" | "both" | null): string | null {
  if (answer === "domestic") {
    return "Noted — if it's not domestic work, I'll let them know upfront rather than book something you don't do.";
  }
  if (answer === "both") {
    return "Noted — I'll treat commercial and domestic enquiries the same unless you tell me otherwise.";
  }
  return null; // skipped — no consequence to state, nothing was learned
}

/** Applies a customer-type answer to the business's real knowledge.
 * Reuses `jobsDeclined` (already a real field the reply engine reads,
 * already suggesting "Commercial jobs" as a value in the dashboard's
 * own editor) — no new column. `null` writes nothing. */
export function applyCustomerType(knowledge: BusinessKnowledge, answer: "domestic" | "both" | null): BusinessKnowledge {
  if (answer !== "domestic") return knowledge;
  if (knowledge.jobsDeclined.includes("Commercial jobs")) return knowledge;
  return { ...knowledge, jobsDeclined: [...knowledge.jobsDeclined, "Commercial jobs"] };
}

/**
 * The discovery system — doc 15 §4's "not a template, a genuine
 * per-trade finding," generalised into a small, extensible list rather
 * than a one-off switch, so a future discovery (unrelated to trade, or
 * a second discovery for an existing trade) is a new entry here, never
 * a rewrite of the sequence logic in hiring-conversation.tsx.
 */
export interface DiscoveryContext {
  trade: string;
  businessName: string;
  serviceAreas: string[];
}

export interface Discovery {
  id: string;
  appliesTo: (ctx: DiscoveryContext) => boolean;
  question: (ctx: DiscoveryContext) => string;
  /** Only ever called on acceptance — declining writes nothing, since
   * declining isn't a fact and nothing should be invented to fill the
   * gap. */
  onAccept: (knowledge: BusinessKnowledge) => BusinessKnowledge;
}

function appendEmergencyNote(knowledge: BusinessKnowledge, note: string): BusinessKnowledge {
  if (knowledge.emergencyNotes.includes(note)) return knowledge;
  return { ...knowledge, emergencyNotes: knowledge.emergencyNotes ? `${knowledge.emergencyNotes} ${note}` : note };
}

function appendPersonality(knowledge: BusinessKnowledge, trait: string): BusinessKnowledge {
  if (knowledge.personality.includes(trait)) return knowledge;
  return { ...knowledge, personality: [...knowledge.personality, trait] };
}

const urgentDiscovery = (
  id: string,
  trade: Trade,
  urgentExample: string,
  note: string
): Discovery => ({
  id,
  appliesTo: (ctx) => ctx.trade === trade,
  question: (ctx) => {
    const where = ctx.serviceAreas.length > 0 ? ` around ${formatAreas(ctx.serviceAreas)}` : "";
    return `Can I flag something? You said mostly homes, and I said I'd hold things till morning by default — but ${urgentExample}${where}. Want me to treat anything that sounds genuinely urgent differently, even outside your hours?`;
  },
  onAccept: (k) => appendEmergencyNote(k, note),
});

export const DISCOVERIES: Discovery[] = [
  urgentDiscovery(
    "plumbing-burst-pipe",
    "plumbing",
    "a burst pipe doesn't know that",
    "Treats burst pipes and no hot water as urgent, even outside normal hours."
  ),
  urgentDiscovery(
    "electrical-no-power",
    "electrical",
    "no power at all, or a burning smell, isn't a 'wait till Monday' problem",
    "Treats total power loss or a burning smell as urgent, even outside normal hours."
  ),
  urgentDiscovery(
    "roofing-active-leak",
    "roofing",
    "weather doesn't wait for office hours",
    "Treats an active leak into the house as urgent, even outside normal hours."
  ),
  {
    id: "building-lead-time",
    appliesTo: (ctx) => ctx.trade === "building",
    question: () =>
      "Can I flag something? Most of what you do is booked weeks out, not same-day. Want me to say that upfront, so nobody's expecting you tomorrow morning for a job that needs planning?",
    onAccept: (k) => appendPersonality(k, "Books several weeks ahead."),
  },
  {
    id: "painting-access",
    appliesTo: (ctx) => ctx.trade === "painting",
    question: () =>
      "Can I flag something? You're usually working inside people's homes — want me to always check about pets or which rooms need to stay clear before confirming?",
    onAccept: (k) => appendPersonality(k, "Always checks access before booking."),
  },
];

/** Returns the first discovery whose condition matches, or null if
 * none does — a trade with no matching discovery simply skips the
 * beat rather than forcing an invented one. */
export function selectDiscovery(ctx: DiscoveryContext): Discovery | null {
  return DISCOVERIES.find((d) => d.appliesTo(ctx)) ?? null;
}

/** Close beat — the one deliberate callback to the very first fact
 * given, demonstrating the same memory the rest of the encounter has
 * been building. */
export function closingLine(businessName: string): string {
  return `I think I've got a real picture of ${businessName} now.`;
}
