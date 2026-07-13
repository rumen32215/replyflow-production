"use client";

import { usePathname } from "next/navigation";
import { ConversationList, type ConversationListItem } from "@/components/dashboard/conversations/conversation-list";
import { cn } from "@/lib/utils";

/**
 * app/(dashboard)/dashboard/conversations/layout.tsx renders this once
 * and passes the current route's page content in as `children` — the
 * base route renders a "select a conversation" placeholder, [id]
 * renders the actual thread. This component only decides *which panes
 * are visible*, driven by whether the current path is the list route
 * or a specific conversation:
 *   - desktop (md+): both panes always visible, side by side
 *   - mobile: list route -> list only; conversation route -> thread only
 */
export function ConversationsShell({
  conversations,
  children,
}: {
  conversations: ConversationListItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDetailView = pathname !== "/dashboard/conversations";

  return (
    <div className="-m-8 flex h-[calc(100vh-73px)] overflow-hidden">
      <div
        className={cn(
          "w-full shrink-0 border-r border-border bg-card md:w-[340px]",
          isDetailView ? "hidden md:block" : "block"
        )}
      >
        <ConversationList conversations={conversations} />
      </div>

      <div className={cn("min-w-0 flex-1 flex-col bg-background", isDetailView ? "flex" : "hidden md:flex")}>
        {children}
      </div>
    </div>
  );
}
