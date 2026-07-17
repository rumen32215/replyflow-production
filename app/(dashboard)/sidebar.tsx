"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, MessagesSquare, Headset, CalendarDays, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { DASHBOARD_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Desktop-only sidebar. The same four destinations as the mobile
 * bottom nav — desktop gains space, never different functionality.
 * Navigation never flashes: the active highlight gently slides
 * between items via a shared layoutId.
 */

const ICONS: Record<(typeof DASHBOARD_NAV)[number]["icon"], LucideIcon> = {
  Home,
  MessagesSquare,
  Headset,
  CalendarDays,
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ receptionistName = null }: { receptionistName?: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-[240px] shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-[73px] items-center border-b border-border px-6">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {DASHBOARD_NAV.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          // The chosen name, not the role — a character, not a
          // database field — wherever it fits naturally in the chrome.
          const label = item.href === "/dashboard/receptionist" && receptionistName ? receptionistName : item.label;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-lg bg-accent"
                />
              )}
              <Icon className="relative h-4 w-4" />
              <span className="relative truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
