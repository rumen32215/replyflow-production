"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Headset, MessageCircle, CalendarDays, Settings, type LucideIcon } from "lucide-react";
import { DASHBOARD_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Mobile-only. The desktop sidebar shows all destinations; a
 * thumb-reachable bottom bar tops out around four, so everything else
 * (the non-`primary` DASHBOARD_NAV entries) lives here instead — one
 * tap further, in the topbar, never competing for the bottom bar's
 * limited room.
 */
const ICONS: Record<"Headset" | "MessageCircle" | "CalendarDays" | "Settings", LucideIcon> = {
  Headset,
  MessageCircle,
  CalendarDays,
  Settings,
};

const SECONDARY_NAV = DASHBOARD_NAV.filter(
  (item): item is (typeof DASHBOARD_NAV)[number] & { icon: "Headset" | "MessageCircle" | "CalendarDays" | "Settings" } => !item.primary
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
          </Link>
        );
      })}
    </>
  );
}
