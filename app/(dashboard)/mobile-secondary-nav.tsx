"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Headset, MessageCircle, ClipboardCheck, FileText, CalendarDays, Settings, type LucideIcon } from "lucide-react";
import { DASHBOARD_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * ReplyFlow v1 Product Blueprint, checklist 2.6 — mobile-only. The
 * desktop sidebar shows all destinations; a thumb-reachable bottom bar
 * tops out around four, so everything else (the non-`primary`
 * DASHBOARD_NAV entries — Receptionist included, since ReplyFlow V4)
 * lives here instead — one tap further, in the topbar, never competing
 * for the bottom bar's limited room. Was `TopbarNav` (Sprint 8.5) when
 * it carried three desktop-and-mobile secondary destinations; renamed
 * now that its whole reason to exist is mobile-only.
 */
const ICONS: Record<"Headset" | "MessageCircle" | "ClipboardCheck" | "FileText" | "CalendarDays" | "Settings", LucideIcon> = {
  Headset,
  MessageCircle,
  ClipboardCheck,
  FileText,
  CalendarDays,
  Settings,
};

const SECONDARY_NAV = DASHBOARD_NAV.filter(
  (
    item
  ): item is (typeof DASHBOARD_NAV)[number] & {
    icon: "Headset" | "MessageCircle" | "ClipboardCheck" | "FileText" | "CalendarDays" | "Settings";
  } => !item.primary
);

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Master Execution Plan 2.4 — same always-visible-item, badge-carries-urgency
 * pattern as the desktop sidebar (see sidebar.tsx). */
export function MobileSecondaryNav({ approvalsCount = 0 }: { approvalsCount?: number }) {
  const pathname = usePathname();

  return (
    <>
      {SECONDARY_NAV.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item.href);
        const showBadge = item.href === "/dashboard/approvals" && approvalsCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={showBadge ? `${item.label} (${approvalsCount})` : item.label}
            className={cn(
              "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="mobile-secondary-nav-active"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-full bg-accent"
              />
            )}
            <Icon className="relative h-[17px] w-[17px]" />
            {showBadge && (
              <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-attention" />
            )}
          </Link>
        );
      })}
    </>
  );
}
