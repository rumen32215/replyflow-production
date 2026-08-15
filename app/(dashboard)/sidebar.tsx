"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, MessagesSquare, ClipboardList, Users, Headset, MessageCircle, CalendarDays, Settings, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { DASHBOARD_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Desktop-only sidebar. Mobile's bottom bar shows only the four
 * `primary` destinations. Navigation never flashes: the active
 * highlight gently slides between items via a shared layoutId.
 */

const ICONS: Record<(typeof DASHBOARD_NAV)[number]["icon"], LucideIcon> = {
  Home,
  MessagesSquare,
  ClipboardList,
  Users,
  Headset,
  MessageCircle,
  CalendarDays,
  Settings,
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Plumber Reset — Phase 3 step 7 (UI transition). Approvals no longer
 * has its own nav destination (it was a genuine duplicate of Home's
 * own attention queue) — the same "things need you" count now shows
 * on Home's own icon instead, so the signal is folded in, not lost.
 */
export function Sidebar({ approvalsCount = 0 }: { approvalsCount?: number }) {
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
              <span className="relative truncate">{item.label}</span>
              {item.href === "/dashboard" && approvalsCount > 0 && (
                <span className="relative ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-attention px-1 text-[10.5px] font-bold text-attention-foreground">
                  {approvalsCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
