/**
 * Single source of truth for values referenced across the onboarding flow.
 * Keeping these here (instead of hardcoded in components) is what lets us
 * add a second trade later without hunting through the codebase — see
 * Founder Handbook, Page 6 (Target Customer) for why "Plumbing" is the
 * only unlocked trade in v1.
 */

export const TRADES = [
  { value: "plumbing", label: "Plumbing", available: true },
  { value: "electrical", label: "Electrical", available: false },
  { value: "roofing", label: "Roofing", available: false },
  { value: "landscaping", label: "Landscaping", available: false },
] as const;

export const PLUMBING_SERVICES = [
  "Boiler Repairs",
  "Leaks",
  "Bathrooms",
  "Emergency Call-Out",
  "Blocked Drains",
  "Heating",
] as const;

export const GREETING_STYLES = [
  {
    value: "professional",
    label: "Professional",
    example: "Hi, thanks for contacting ABC Plumbing. How can we help?",
  },
  {
    value: "friendly",
    label: "Friendly",
    example: "Hey there! 👋 Thanks for reaching out to ABC Plumbing.",
  },
  {
    value: "concise",
    label: "Concise",
    example: "ABC Plumbing here. What's the issue?",
  },
] as const;

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
