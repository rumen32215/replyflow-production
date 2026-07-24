"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * ReplyFlow v1 Product Blueprint, checklist 2.5 — Business,
 * Receptionist, and Everything I Know are one relationship ("what has
 * she learned, and where do I go to teach more") split across three
 * pages nothing previously connected. This is the rename-not-rewrite
 * version the Blueprint's self-challenge landed on: no routes moved,
 * no data-fetching changed — just a shared strip so the relationship
 * is visible, with Overview (confidence) as the natural entry point.
 */
const KNOWLEDGE_TABS = [
  { href: "/dashboard/everything-i-know", label: "Overview" },
  { href: "/dashboard/business", label: "Facts" },
  { href: "/dashboard/receptionist", label: "Behavior" },
] as const;

export function KnowledgeTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Knowledge" className="mb-4 flex items-center gap-1 border-b border-border">
      {KNOWLEDGE_TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {active && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-primary" />}
          </Link>
        );
      })}
    </nav>
  );
}
