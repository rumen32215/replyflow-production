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
 *
 * ReplyFlow V2 (2026-08-11): WhatsApp gets its own direct secondary
 * nav entry. It was previously reachable only via a CTA buried at the
 * bottom of the Test Conversation screen — not from navigation at all
 * — which put the current V2 job-ready workflow's one hard
 * prerequisite behind an old onboarding-sequence detour. Kept
 * secondary (not one of the four thumb-reachable primary tabs) rather
 * than restructuring the primary group.
 *
 * ReplyFlow V4 (P0.B): Work Cards is the operational centre of the
 * product — the thing a plumber actually manages all day — and had no
 * nav destination at all before this. It takes a primary slot;
 * Receptionist moves to secondary in exchange, because it's setup/
 * configuration infrastructure visited occasionally, not a daily
 * destination. Still four primary items, not five — a straight swap,
 * not an expansion.
 *
 * No AI terminology anywhere in labels (Decision 001).
 */
export const DASHBOARD_NAV = [
  { href: "/dashboard", label: "Front Desk", icon: "Home", primary: true },
  { href: "/dashboard/conversations", label: "Conversations", icon: "MessagesSquare", primary: true },
  { href: "/dashboard/work-cards", label: "Work Cards", icon: "ClipboardList", primary: true },
  { href: "/dashboard/customers", label: "Customers", icon: "Users", primary: true },
  { href: "/dashboard/receptionist", label: "Receptionist", icon: "Headset", primary: false },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: "MessageCircle", primary: false },
  { href: "/dashboard/approvals", label: "Approvals", icon: "ClipboardCheck", primary: false },
  { href: "/dashboard/job-records", label: "Job Records", icon: "FileText", primary: false },
  { href: "/dashboard/availability", label: "Hours", icon: "CalendarDays", primary: false },
  { href: "/dashboard/settings", label: "Settings", icon: "Settings", primary: false },
] as const;

export const BRAND = {
  name: "ReplyFlow",
  tagline: "Never miss another customer.",
} as const;
