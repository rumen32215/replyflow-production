"use client";

import { usePathname } from "next/navigation";
import { ConversationList, type ConversationListItem } from "@/components/dashboard/conversations/conversation-list";
import { cn } from "@/lib/utils";

/**
 * Two-pane front desk. Desktop: list + thread side by side. Mobile:
 * one pane at a time — the list route shows the list, a conversation
 * route shows the thread (with its own back control). Breaks out of
 * the page padding so it feels like a full working surface.
 */
export function ConversationsShell({
  conversations,
  draftConversationIds = [],
  children,
}: {
  conversations: ConversationListItem[];
  draftConversationIds?: readonly string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDetailView = pathname !== "/dashboard/conversations";

  return (
    <div className="-mx-4 -mb-24 -mt-6 flex h-[calc(100vh-60px-56px)] overflow-hidden md:-mx-8 md:-mb-8 md:-mt-8 md:h-[calc(100vh-73px)]">
      <div
        className={cn(
          "w-full shrink-0 border-r border-border bg-card md:w-[340px]",
          isDetailView ? "hidden md:block" : "block"
        )}
      >
        <ConversationList conversations={conversations} draftConversationIds={draftConversationIds} />
      </div>

      <div className={cn("min-w-0 flex-1 flex-col bg-background", isDetailView ? "flex" : "hidden md:flex")}>
        {children}
      </div>
    </div>
  );
}
