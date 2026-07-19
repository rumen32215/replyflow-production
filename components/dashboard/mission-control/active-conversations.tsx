import Link from "next/link";
import { SettleCard, Reveal } from "@/components/shared/motion";
import { groupForStatus, statusLabel, type ConversationGroup } from "@/lib/conversations";
import { EmptyState } from "@/components/shared/empty-state";
import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "What is happening right now?" — every conversation still in
 * progress (waiting, active, or booked — never the finished ones,
 * that's Recent Activity's job), reusing the exact same status
 * vocabulary Conversations already uses (lib/conversations.ts) so a
 * status means the same thing everywhere it appears.
 */
export interface ActiveConversationItem {
  id: string;
  name: string;
  status: string;
  lastMessagePreview: string | null;
}

const GROUP_STYLE: Record<ConversationGroup, string> = {
  waiting: "border-attention/20 bg-attention/10 text-attention",
  active: "border-primary/20 bg-accent text-primary",
  booked: "border-success/25 bg-success/10 text-success",
  done: "border-border bg-muted text-muted-foreground",
};

export function ActiveConversations({ items }: { items: ActiveConversationItem[] }) {
  return (
    <SettleCard delay={0.09} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        Active conversations
      </h2>
      {items.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="Nothing in progress right now."
          description="Once a customer gets in touch, the conversation shows up here while it's still moving."
        />
      ) : (
        <div className="space-y-1.5">
          {items.map((item, i) => {
            const group = groupForStatus(item.status);
            return (
              <Reveal key={item.id} index={Math.min(i, 6)}>
                <Link
                  href={`/dashboard/conversations/${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">{item.name}</p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {item.lastMessagePreview || "New enquiry"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                      GROUP_STYLE[group]
                    )}
                  >
                    {statusLabel(item.status)}
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}
    </SettleCard>
  );
}
