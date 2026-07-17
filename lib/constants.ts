/**
 * Single source of truth for values referenced across the app.
 * Trade-specific content (service suggestions, preview scenarios)
 * lives in lib/trades.ts, keyed by the trade the owner actually
 * picked in onboarding — ReplyFlow is a platform, not a plumbing app.
 */

/**
 * The four primary destinations (ReplyFlow V3 — Front Desk). Rendered
 * as the bottom tab bar on mobile and the sidebar on desktop, from
 * this one list. Business ("her profile") is reached from a link on
 * Front Desk rather than the tab bar — a profile is something you tap
 * into from the relationship, not a fifth destination competing with
 * it. Settings lives in the topbar (genuine account preferences, not
 * a place of work); WhatsApp connection is reached from Front Desk's
 * fast lane and Settings, never from primary navigation.
 *
 * No AI terminology anywhere in labels (Decision 001).
 */
export const DASHBOARD_NAV = [
  { href: "/dashboard", label: "Front Desk", icon: "Home" },
  { href: "/dashboard/conversations", label: "Conversations", icon: "MessagesSquare" },
  { href: "/dashboard/receptionist", label: "Receptionist", icon: "Headset" },
  { href: "/dashboard/availability", label: "Diary", icon: "CalendarDays" },
] as const;

export const BRAND = {
  name: "ReplyFlow",
  tagline: "Never miss another customer.",
} as const;
