"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, MessagesSquare, Headset, CalendarDays, type LucideIcon } from "lucide-react";
import { DASHBOARD_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * The mobile tab bar — the primary way a tradesperson holds ReplyFlow.
 * Thumb-first: four large targets, instant touch acknowledgement, the
 * active indicator slides rather than flashes so the owner always
 * understands where they came from and where they are.
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

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {DASHBOARD_NAV.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pb-2 pt-2.5",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="bottomnav-active"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  className="absolute top-0 h-[2.5px] w-10 rounded-full bg-primary"
                />
              )}
              <motion.span whileTap={{ scale: 0.9 }} className="flex flex-col items-center gap-0.5">
                <Icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.4 : 2} />
                <span className={cn("text-[10.5px] leading-tight", active ? "font-semibold" : "font-medium")}>
                  {item.label}
                </span>
              </motion.span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
