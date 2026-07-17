/**
 * The one place a trade is recognised. ReplyFlow is a platform, not a
 * plumbing app — onboarding's trade-step already lets an owner pick
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
