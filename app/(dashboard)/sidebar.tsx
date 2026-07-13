"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessagesSquare, Bot, Building2, MessageCircle, Settings, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Badge } from "@/components/ui/badge";
import { DASHBOARD_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ICONS: Record<(typeof DASHBOARD_NAV)[number]["icon"], LucideIcon> = {
  LayoutDashboard,
  MessagesSquare,
  Bot,
  Building2,
  MessageCircle,
  Settings,
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-[73px] items-center border-b border-border px-6">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {DASHBOARD_NAV.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href;

          if (!item.available) {
            return (
              <div
                key={item.href}
                className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/50"
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-semibold">
                  Soon
                </Badge>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
