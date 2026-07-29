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
 * V1 First-Run redesign: Business Profile, Behaviour, and Everything I
 * Know no longer have separate destinations at all — they're one page
 * ("Teach your receptionist," /dashboard/receptionist), and this is
 * that page's single nav entry, replacing the old "Knowledge" entry.
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
  { href: "/dashboard/receptionist", label: "Receptionist", icon: "Headset", primary: true },
  { href: "/dashboard/approvals", label: "Approvals", icon: "ClipboardCheck", primary: false },
  { href: "/dashboard/availability", label: "Hours", icon: "CalendarDays", primary: false },
  { href: "/dashboard/settings", label: "Settings", icon: "Settings", primary: false },
] as const;

export const BRAND = {
  name: "ReplyFlow",
  tagline: "Never miss another customer.",
} as const;
