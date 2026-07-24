/**
 * Single source of truth for values referenced across the app.
 * Trade-specific content (service suggestions, preview scenarios)
 * lives in lib/trades.ts, keyed by the trade the owner actually
 * picked in onboarding — ReplyFlow is a platform, not a plumbing app.
 */

/**
 * The complete v1 navigation (ReplyFlow v1 Product Blueprint) — six
 * destinations, one list, single source of truth for the desktop
 * sidebar (all six, desktop has room) and the mobile bottom tab bar
 * (the four `primary` ones only — a thumb-reachable bar tops out
 * around four large targets; Hours and Settings are one tap further
 * on mobile, via the topbar's secondary nav).
 *
 * Receptionist and Business no longer have their own nav entries —
 * both fold into Knowledge (checklist 2.5), which is what
 * "/dashboard/everything-i-know" now serves as the entry point to.
 * WhatsApp connection is reached from Settings and from Front Desk
 * when its health actually needs attention (checklist 3.2), never
 * from primary navigation.
 *
 * No AI terminology anywhere in labels (Decision 001).
 */
export const DASHBOARD_NAV = [
  { href: "/dashboard", label: "Front Desk", icon: "Home", primary: true },
  { href: "/dashboard/conversations", label: "Conversations", icon: "MessagesSquare", primary: true },
  { href: "/dashboard/customers", label: "Customers", icon: "Users", primary: true },
  { href: "/dashboard/everything-i-know", label: "Knowledge", icon: "Brain", primary: true },
  { href: "/dashboard/availability", label: "Hours", icon: "CalendarDays", primary: false },
  { href: "/dashboard/settings", label: "Settings", icon: "Settings", primary: false },
] as const;

export const BRAND = {
  name: "ReplyFlow",
  tagline: "Never miss another customer.",
} as const;
