import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";

export const metadata: Metadata = { title: "Conversations — ReplyFlow" };

/**
 * Rendered as the right pane's content only on desktop (the shell hides
 * this route entirely on mobile in favor of the list — see
 * components/dashboard/conversations/conversations-shell.tsx). This is
 * intentionally minimal: it's a "pick something" state, not a page in
 * its own right.
 */
export default function ConversationsIndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <MessagesSquare className="h-6 w-6" />
      </div>
      <div>
        <p className="text-[14px] font-semibold">Select a conversation</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Choose a thread from the list to view messages.</p>
      </div>
    </div>
  );
}
