"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, Settings, type LucideIcon } from "lucide-react";
import { DASHBOARD_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * ReplyFlow v1 Product Blueprint, checklist 2.6 — mobile-only. The
 * desktop sidebar shows all six destinations; a thumb-reachable
 * bottom bar tops out around four, so Hours and Settings (the two
 * non-`primary` DASHBOARD_NAV entries) live here instead — one tap
 * further, in the topbar, never a seventh item competing for the
 * bottom bar's limited room. Was `TopbarNav` (Sprint 8.5) when it
 * carried three desktop-and-mobile secondary destinations; renamed
 * now that its whole reason to exist is mobile-only.
 */
const ICONS: Record<"CalendarDays" | "Settings", LucideIcon> = {
  CalendarDays,
  Settings,
};

const SECONDARY_NAV = DASHBOARD_NAV.filter(
  (item): item is (typeof DASHBOARD_NAV)[number] & { icon: "CalendarDays" | "Settings" } => !item.primary
);

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileSecondaryNav() {
  const pathname = usePathname();

  return (
    <>
      {SECONDARY_NAV.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-full transition-colors",
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
          </Link>
        );
      })}
    </>
  );
}
