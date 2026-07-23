"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Brain, Settings, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sprint 8.5 — the topbar's secondary destinations had no active
 * state at all: Topbar was a Server Component with no route to
 * compare against. Split out into its own small client island so it
 * can read the pathname, using the exact same active-state language
 * the primary sidebar/bottom nav already established (a sliding
 * `layoutId` pill in the accent token, primary-coloured icon) rather
 * than inventing a second visual vocabulary for "you are here."
 *
 * Mission Control removed (Owner Experience 01) — its real content is
 * now Front Desk itself; the route still redirects there for any
 * bookmarked link, it's just no longer a nav destination.
 */

const TOPBAR_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/everything-i-know", label: "Everything I Know", icon: Brain },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopbarNav() {
  const pathname = usePathname();

  return (
    <>
      {TOPBAR_LINKS.map((item) => {
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
                layoutId="topbar-active"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-full bg-accent"
              />
            )}
            <item.icon className="relative h-[17px] w-[17px]" />
          </Link>
        );
      })}
    </>
  );
}
