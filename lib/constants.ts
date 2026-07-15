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
 * Sidebar nav. Every item routes to a real page — the ones without a
 * feature behind them yet (Conversations, AI Receptionist, Business
 * Profile, WhatsApp Connection, Settings) render via
 * components/dashboard/coming-soon.tsx so the shell, routing, and auth
 * guard are all in place before the real feature lands. `available`
 * is kept as a pattern for future nav items that should be visibly
 * locked (e.g. Billing) rather than clickable.
 */
export const DASHBOARD_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", available: true },
  { href: "/dashboard/conversations", label: "Conversations", icon: "MessagesSquare", available: true },
  { href: "/dashboard/ai-receptionist", label: "AI Receptionist", icon: "Bot", available: true },
  { href: "/dashboard/business-profile", label: "Business Profile", icon: "Building2", available: true },
  { href: "/dashboard/whatsapp", label: "WhatsApp Connection", icon: "MessageCircle", available: true },
  { href: "/dashboard/settings", label: "Settings", icon: "Settings", available: true },
] as const;

export const BRAND = {
  name: "ReplyFlow",
  tagline: "Never miss another customer.",
} as const;
