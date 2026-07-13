"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, MessagesSquare } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ConversationListItem {
  id: string;
  customer_name: string | null;
  customer_phone: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  status: "open" | "closed";
}

export function ConversationList({ conversations }: { conversations: ConversationListItem[] }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const filtered = conversations.filter((c) => {
    const haystack = `${c.customer_name ?? ""} ${c.customer_phone}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border p-4">
        <h1 className="mb-3 text-[17px] font-extrabold tracking-tight">Conversations</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations..."
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-primary focus:ring-[3px] focus:ring-primary/15"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <EmptyState
            className="m-4 border-none"
            icon={MessagesSquare}
            title="No conversations yet"
            description="They'll appear here once WhatsApp is connected and customers start messaging in."
          />
        ) : filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">No matches for &ldquo;{query}&rdquo;</p>
        ) : (
          filtered.map((c) => {
            const href = `/dashboard/conversations/${c.id}`;
            const active = pathname === href;
            return (
              <Link
                key={c.id}
                href={href}
                className={cn(
                  "flex items-center gap-3 border-b border-border px-4 py-3.5 transition-colors",
                  active ? "bg-accent" : "hover:bg-muted/50"
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-primary">
                  {(c.customer_name || c.customer_phone).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13.5px] font-semibold">{c.customer_name || c.customer_phone}</p>
                    {c.last_message_at && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {new Date(c.last_message_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[12.5px] text-muted-foreground">{c.last_message_preview}</p>
                    {c.status === "open" && <Badge variant="success" className="shrink-0 px-1.5 py-0 text-[9px]">Open</Badge>}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
