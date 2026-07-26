/**
 * The receptionist's teaching vocabulary — pure functions only, no
 * React, no Supabase. Owners teach behaviours; the options and
 * scenarios here are what the Receptionist page's chips and starter
 * messages are built from.
 *
 * Coaching Implementation Plan, C5: this module used to also contain
 * a hand-written, deterministic reply simulator (`buildPreviewConversation`)
 * standing in for the real receptionist during teaching — a second,
 * fake reasoning system the owner could easily mistake for the real
 * one. It's gone. Every example an owner sees now comes from the same
 * real reasoning core production uses (lib/reply-engine/live-reply.ts)
 * — one receptionist, one brain, no exceptions.
 *
 * The `text` on each teaching option is the exact string persisted in
 * ai_configurations (system_prompt / business_rules / escalation_rules),
 * so the schema and any previously saved data keep working unchanged.
 */

import { normalizeTrade, type TradeOrGeneral } from "@/lib/trades";

export type Tone = "professional" | "friendly" | "concise";

export interface TeachingOption {
  id: string;
  /** Short chip/summary text — used in collapsed one-line summaries
   * (summariseTopic) and anywhere space is tight. Kept short even when
   * `question` exists. */
  label: string;
  /** The exact string persisted/parsed (see parseOptions/composeOptions)
   * — never changes without a real migration of already-saved data. */
  text: string;
  /** Hiring Experience redesign: the same option, phrased as the real
   * scenario a receptionist would face — shown in the full teaching
   * row instead of `label`, where there's room for it. Falls back to
   * `label` when absent. */
  question?: string;
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

// Hiring Experience redesign: `question` reframes each option as the
// real scenario a receptionist would actually face, not an abstract
// category name — "a decision, not a setting." `label` (short, used in
// collapsed summaries) and `text` (the persisted string) are both
// untouched, so nothing already saved for a real business changes.
export const ESCALATION_OPTIONS: readonly TeachingOption[] = [
  {
    id: "gas-leak",
    label: "A gas leak is mentioned",
    question: "Someone messages smelling gas — should I always get you immediately, no matter what?",
    text: "Hand off immediately if the customer mentions a gas leak.",
  },
  {
    id: "flooding",
    label: "There's flooding",
    question: "There's flooding or serious water damage — should I always get you immediately?",
    text: "Hand off immediately if there's flooding or major water damage.",
  },
  {
    id: "wants-person",
    label: "They ask for a person",
    question: "They directly ask to speak to a real person — should I always get you?",
    text: "Hand off if the customer directly asks to speak to a person.",
  },
  {
    id: "complaint",
    label: "They're unhappy",
    question: "They're making a complaint — should I always get you?",
    text: "Hand off if the customer is making a complaint.",
  },
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

/**
 * What kind of exchange this is — used only to pick a representative
 * scenario for the tone-comparison examples (Coaching Implementation
 * Plan C3). Kept separate from the scenario's id/label/message so the
 * owner-facing scenario picker can show real customer problems
 * (Receptionist V3.1).
 */
export type ScenarioKind = "standard" | "quote" | "emergency" | "price";

export interface PreviewScenario {
  id: string;
  label: string;
  customerMessage: string;
  kind: ScenarioKind;
}

/**
 * Real customer problems, not developer categories — this is what
 * watching real customers looks like, not "Scenario 3: Emergency."
 * Keyed by trade so a landscaper isn't shown "boiler leaking" as their
 * demo (ReplyFlow is a platform, not a plumbing app) — every set keeps
 * the same shape (one emergency, one price question, one quote
 * request, three standard enquiries) so callers never need to know
 * which trade it is, only the scenario's `kind`.
 */
const TRADE_SCENARIOS: Record<TradeOrGeneral, readonly PreviewScenario[]> = {
  plumbing: [
    { id: "boiler-leak", label: "Boiler leaking", customerMessage: "Hi, my boiler's leaking water from underneath — can someone come out?", kind: "emergency" },
    { id: "no-hot-water", label: "No hot water", customerMessage: "We've had no hot water since this morning, can you help?", kind: "standard" },
    { id: "kitchen-tap", label: "Kitchen tap", customerMessage: "My kitchen tap won't stop dripping — how much would that be to fix?", kind: "price" },
    { id: "radiator", label: "Radiator issue", customerMessage: "One of my radiators isn't heating up properly.", kind: "standard" },
    { id: "blocked-drain", label: "Blocked drain", customerMessage: "The drain outside our kitchen is completely blocked.", kind: "standard" },
    { id: "bathroom-install", label: "Bathroom installation", customerMessage: "Could I get a quote for a full bathroom installation?", kind: "quote" },
  ],
  electrical: [
    { id: "power-cut", label: "Power cut", customerMessage: "Hi, we've completely lost power to half the house — can someone come out?", kind: "emergency" },
    { id: "flickering-lights", label: "Flickering lights", customerMessage: "Our lights keep flickering, could you take a look?", kind: "standard" },
    { id: "socket-fix", label: "Socket not working", customerMessage: "One of our sockets isn't working — how much would that be to fix?", kind: "price" },
    { id: "fuse-tripping", label: "Fuse box tripping", customerMessage: "Our fuse box keeps tripping and we don't know why.", kind: "standard" },
    { id: "outdoor-lighting", label: "Outdoor lighting", customerMessage: "We'd like to add some outdoor lighting to the garden.", kind: "standard" },
    { id: "ev-charger", label: "EV charger", customerMessage: "Could I get a quote for an EV charger installation?", kind: "quote" },
  ],
  landscaping: [
    { id: "fallen-tree", label: "Fallen tree", customerMessage: "A tree's come down in the storm and it's blocking our driveway — can someone come out?", kind: "emergency" },
    { id: "overgrown-garden", label: "Overgrown garden", customerMessage: "Our garden's really overgrown, could you help tidy it up?", kind: "standard" },
    { id: "fence-price", label: "Fence replacement", customerMessage: "How much would it be to replace our back fence?", kind: "price" },
    { id: "lawn-care", label: "Lawn care", customerMessage: "Could someone come and sort our lawn out? It's looking patchy.", kind: "standard" },
    { id: "hedge-trim", label: "Hedge trim", customerMessage: "Our hedges need a trim, when could you fit us in?", kind: "standard" },
    { id: "patio-quote", label: "New patio", customerMessage: "Could I get a quote for a new patio?", kind: "quote" },
  ],
  building: [
    { id: "collapsed-ceiling", label: "Ceiling damage", customerMessage: "Part of our ceiling has come down — can someone come out urgently?", kind: "emergency" },
    { id: "damp-wall", label: "Damp patch", customerMessage: "We've got a damp patch on one of our walls, could you take a look?", kind: "standard" },
    { id: "extension-price", label: "Extension cost", customerMessage: "How much would a single-storey extension cost roughly?", kind: "price" },
    { id: "crack-in-wall", label: "Crack in wall", customerMessage: "We've noticed a crack appearing in one of our walls.", kind: "standard" },
    { id: "plastering", label: "Plastering", customerMessage: "We need a room re-plastered, are you able to help?", kind: "standard" },
    { id: "loft-conversion", label: "Loft conversion", customerMessage: "Could I get a quote for a loft conversion?", kind: "quote" },
  ],
  cleaning: [
    { id: "flood-cleanup", label: "Flood clean-up", customerMessage: "We've had a flood and need an emergency clean — can someone come out today?", kind: "emergency" },
    { id: "end-of-tenancy", label: "End of tenancy", customerMessage: "We're moving out and need an end of tenancy clean, can you help?", kind: "standard" },
    { id: "regular-clean-price", label: "Weekly clean cost", customerMessage: "How much would a regular weekly clean cost?", kind: "price" },
    { id: "carpet-stain", label: "Carpet stain", customerMessage: "We've got a bad stain on the carpet, could you take a look?", kind: "standard" },
    { id: "deep-clean", label: "Deep clean", customerMessage: "We'd like to book a deep clean before guests arrive.", kind: "standard" },
    { id: "office-clean-quote", label: "Office clean", customerMessage: "Could I get a quote for a weekly office clean?", kind: "quote" },
  ],
  heating: [
    { id: "no-heating-winter", label: "No heating", customerMessage: "Our heating's completely gone and it's freezing — can someone come out?", kind: "emergency" },
    { id: "radiator-cold", label: "Cold radiator", customerMessage: "One of our radiators is cold at the top, could you take a look?", kind: "standard" },
    { id: "boiler-service-price", label: "Boiler service cost", customerMessage: "How much for an annual boiler service?", kind: "price" },
    { id: "noisy-boiler", label: "Noisy boiler", customerMessage: "Our boiler's making a strange noise, is that something to worry about?", kind: "standard" },
    { id: "power-flush", label: "Power flush", customerMessage: "We think our system needs a power flush, can you help?", kind: "standard" },
    { id: "boiler-install-quote", label: "New boiler", customerMessage: "Could I get a quote for a new boiler installation?", kind: "quote" },
  ],
  roofing: [
    { id: "roof-leak", label: "Roof leak", customerMessage: "We've got water coming through the ceiling — can someone come out urgently?", kind: "emergency" },
    { id: "missing-tiles", label: "Missing tiles", customerMessage: "We've noticed a few tiles have come loose after the wind.", kind: "standard" },
    { id: "reroof-price", label: "Re-roof cost", customerMessage: "Roughly how much would a full re-roof cost?", kind: "price" },
    { id: "guttering", label: "Guttering", customerMessage: "Our guttering's overflowing, could you take a look?", kind: "standard" },
    { id: "chimney", label: "Chimney issue", customerMessage: "We think there might be an issue with our chimney flashing.", kind: "standard" },
    { id: "flat-roof-quote", label: "Flat roof repair", customerMessage: "Could I get a quote for repairing our flat roof?", kind: "quote" },
  ],
  painting: [
    { id: "ceiling-water-damage", label: "Water-damaged ceiling", customerMessage: "We've had a leak and the ceiling paint's peeling badly — could someone come take a look soon?", kind: "emergency" },
    { id: "room-repaint", label: "Room repaint", customerMessage: "We'd like a couple of rooms repainted, are you taking on work?", kind: "standard" },
    { id: "exterior-price", label: "Exterior repaint cost", customerMessage: "How much would it be to repaint the exterior of our house?", kind: "price" },
    { id: "wallpaper-removal", label: "Wallpaper removal", customerMessage: "We need old wallpaper stripped before repainting, can you help with that?", kind: "standard" },
    { id: "fence-painting", label: "Fence painting", customerMessage: "Our garden fence needs a fresh coat, could you fit us in?", kind: "standard" },
    { id: "commercial-quote", label: "Shop front", customerMessage: "Could I get a quote for painting our shop front?", kind: "quote" },
  ],
  general: [
    { id: "urgent-job", label: "Urgent job", customerMessage: "This is urgent, can someone come out today?", kind: "emergency" },
    { id: "general-enquiry", label: "New enquiry", customerMessage: "Hi, could you help with a job we've got?", kind: "standard" },
    { id: "price-question", label: "Price question", customerMessage: "Roughly how much would this cost?", kind: "price" },
    { id: "another-enquiry", label: "Another enquiry", customerMessage: "We've got a job we'd like some help with.", kind: "standard" },
    { id: "availability", label: "Availability", customerMessage: "When would you be able to fit us in?", kind: "standard" },
    { id: "quote-request", label: "Quote request", customerMessage: "Could I get a quote for some work?", kind: "quote" },
  ],
};

export function scenariosForTrade(trade: string | null | undefined): readonly PreviewScenario[] {
  return TRADE_SCENARIOS[normalizeTrade(trade)];
}

