/**
 * The one place a trade is recognised. ReplyFlow is a platform, not a
 * plumbing app — onboarding's hiring conversation already lets an owner pick
 * any of these (or type their own), so anything trade-flavoured
 * elsewhere in the product (Receptionist's preview scenarios,
 * Business Knowledge's service suggestions) reads from here rather
 * than hardcoding one trade's content for every business.
 */

export const KNOWN_TRADES = [
  "plumbing",
  "electrical",
  "landscaping",
  "building",
  "cleaning",
  "heating",
  "roofing",
  "painting",
] as const;

export type TradeKey = (typeof KNOWN_TRADES)[number];
export type TradeOrGeneral = TradeKey | "general";

/**
 * V1 First-Run product decision: focus beats breadth. New signups only
 * ever choose from these five — the best receptionist for five trades,
 * not an average one for eight. This is a signup-UI restriction only:
 * KNOWN_TRADES and normalizeTrade above are unchanged and still
 * recognise all eight, so any existing business on a trade outside
 * this five (e.g. "heating") keeps working exactly as it does today —
 * nothing here is retroactive.
 */
export const ONBOARDING_TRADES = ["plumbing", "electrical", "painting", "building", "roofing"] as const;
export const ONBOARDING_TRADE_LABELS: Record<(typeof ONBOARDING_TRADES)[number], string> = {
  plumbing: "Plumber",
  electrical: "Electrician",
  painting: "Painter & Decorator",
  building: "Builder",
  roofing: "Roofer",
};

/** Free text ("Other") or anything unrecognised falls back to a
 * genuinely generic set — never guessed, never plumbing by default. */
export function normalizeTrade(trade: string | null | undefined): TradeOrGeneral {
  const t = (trade ?? "").toLowerCase().trim();
  return (KNOWN_TRADES as readonly string[]).includes(t) ? (t as TradeKey) : "general";
}

/** Suggested services for Business Knowledge's "Services" chips —
 * tapped, not typed, same as everywhere else, just no longer
 * plumbing's list shown to every trade. */
const TRADE_SERVICES: Record<TradeOrGeneral, readonly string[]> = {
  plumbing: ["Boiler Repairs", "Leaks", "Bathrooms", "Emergency Call-Out", "Blocked Drains", "Heating"],
  electrical: ["Rewiring", "Fuse Box Upgrades", "Lighting Installation", "Emergency Call-Out", "EV Charger Installation", "Fault Finding"],
  landscaping: ["Lawn Care", "Garden Design", "Fencing", "Patios & Decking", "Tree Surgery", "Turfing"],
  building: ["Extensions", "Renovations", "Loft Conversions", "Brickwork", "Plastering", "Groundworks"],
  cleaning: ["End of Tenancy Cleans", "Regular Cleans", "Deep Cleans", "Carpet Cleaning", "Window Cleaning", "Office Cleaning"],
  heating: ["Boiler Installation", "Boiler Servicing", "Central Heating", "Radiator Repairs", "Power Flushing", "Emergency Call-Out"],
  roofing: ["Roof Repairs", "Re-Roofing", "Guttering", "Flat Roofs", "Chimney Work", "Emergency Call-Out"],
  painting: ["Interior Painting", "Exterior Painting", "Wallpapering", "Fence & Shed Painting", "Commercial Painting", "Colour Consultations"],
  general: ["Call-Out Visits", "Free Quotes", "Emergency Work", "Repairs", "Installations", "Maintenance"],
};

export function servicesForTrade(trade: string | null | undefined): readonly string[] {
  return TRADE_SERVICES[normalizeTrade(trade)];
}

/** Before-arrival instructions — a small trade-neutral base list plus,
 * where genuinely relevant, one extra suggestion for that trade (a
 * landscaper has no "stopcock" to ask about). */
const BASE_ACCESS_SUGGESTIONS = [
  "There's parking available on the street",
  "Please keep pets secured",
  "Let us know the door code or key safe in advance",
  "Please clear access to the work area",
] as const;

const ACCESS_EXTRA_BY_TRADE: Partial<Record<TradeOrGeneral, string>> = {
  plumbing: "Please make sure the stopcock is accessible",
  heating: "Please make sure the stopcock is accessible",
  electrical: "Please make sure the fuse box is accessible",
};

export function accessSuggestionsForTrade(trade: string | null | undefined): readonly string[] {
  const extra = ACCESS_EXTRA_BY_TRADE[normalizeTrade(trade)];
  return extra ? [extra, ...BASE_ACCESS_SUGGESTIONS] : BASE_ACCESS_SUGGESTIONS;
}

/**
 * Trade-specific diagnostic guidance for the reply engine's system
 * prompt (Phase B — "trade should affect the intelligence, not merely
 * the UI label"). Deliberately populated for plumbing only — plumber-
 * first is the explicit product decision, not an oversight. The shape
 * (a lookup by trade) is what lets a second trade be added later
 * without restructuring anything that reads from it —
 * lib/reply-engine/prompt/build.ts just looks up whatever's here for
 * the business's own trade and says nothing extra when there's no
 * entry, exactly like every other trade-keyed lookup in this file.
 */
export const TRADE_INTAKE_GUIDANCE: Partial<Record<TradeOrGeneral, string>> = {
  plumbing:
    "Where genuinely still unknown and relevant, prioritise finding out (one at a time, never all at once, only " +
    "what's not already collected): what the issue actually is, the postcode or address so a visit can actually " +
    "be arranged, where in the property the problem is, how urgent it is (can the customer isolate the water " +
    "themselves? is there active flooding?), whether hot water or heating is affected, the property type where " +
    "it's relevant, and roughly when they'd like it looked at. Ask for a photo only when it would genuinely help " +
    "understand this specific issue — something visible (a leak, a damaged pipe, an unfamiliar part, a boiler's " +
    "fault code or model plate), never something a photo can't show (a strange noise, low water pressure, a " +
    "simple booking request) — and only if the customer hasn't already sent one for this issue. A job can still " +
    "be genuinely ready without a photo; never treat one as required.",
};

export function intakeGuidanceForTrade(trade: string | null | undefined): string | null {
  return TRADE_INTAKE_GUIDANCE[normalizeTrade(trade)] ?? null;
}
