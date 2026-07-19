"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Briefcase } from "lucide-react";
import { Reveal, press } from "@/components/shared/motion";
import { groupForStatus, statusLabel, GROUP_ORDER, GROUP_LABELS, type ConversationGroup } from "@/lib/conversations";
import { minutesSince, formatWaitingTime } from "@/lib/dashboard-signals";
import { cn } from "@/lib/utils";

/**
 * The front desk (Conversations Experience V2). Conversations are
 * ordered by importance, never simply by time: Waiting for You always
 * first, then what the receptionist is handling, then booked, then
 * finished — which quietly falls out of attention at the bottom.
 *
 * Each card answers exactly four questions — Who? What? Status? When?
 * No message previews as clutter, no search box, no filters: the
 * important customers find the owner.
 */

export interface ConversationListItem {
  id: string;
  customer_name: string | null;
  customer_phone: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  status: string;
}

const GROUP_STYLES: Record<ConversationGroup, { dot: string; chip: string }> = {
  waiting: { dot: "bg-amber-400", chip: "bg-amber-50 text-amber-700 border-amber-200" },
  active: { dot: "bg-primary", chip: "bg-accent text-primary border-primary/20" },
  booked: { dot: "bg-success", chip: "bg-success/10 text-success border-success/25" },
  done: { dot: "bg-muted-foreground/40", chip: "bg-muted text-muted-foreground border-border" },
};

function whenLabel(iso: string | null): string {
  if (!iso) return "";
  const minutes = minutesSince(iso);
  if (minutes < 60 * 24) return `${formatWaitingTime(minutes)} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ConversationList({
  conversations,
  draftConversationIds = [],
}: {
  conversations: ConversationListItem[];
  draftConversationIds?: readonly string[];
}) {
  const pathname = usePathname();
  const draftIds = new Set(draftConversationIds);

  if (conversations.length === 0) {
    // Never "No conversations." — celebrate the calm (Conversations
    // Experience V2: Empty State). Sprint 8.5 IA review: this used to
    // also nudge "teach me X" and list recently-learned facts here —
    // Conversations' one job is live customer communication, so that
    // content moved out entirely rather than being duplicated from
    // Front Desk / Everything I Know.
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-border px-4 py-4">
          <h1 className="text-[17px] font-extrabold tracking-tight">Conversations</h1>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[15px] font-bold">You&apos;re all caught up.</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              When your next enquiry arrives, I&apos;ll bring it here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const groups = GROUP_ORDER.map((group) => ({
    group,
    // A draft awaiting approval is an orthogonal signal, not its own
    // lifecycle stage — surfaced as a badge and pulled to the top
    // within its existing group, never a 5th group of its own.
    items: conversations
      .filter((c) => groupForStatus(c.status) === group)
      .sort((a, b) => Number(draftIds.has(b.id)) - Number(draftIds.has(a.id))),
  })).filter((g) => g.items.length > 0);

  let revealIndex = 0;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border px-4 py-4">
        <h1 className="text-[17px] font-extrabold tracking-tight">Conversations</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {groups.map(({ group, items }) => (
          <div key={group} className="mb-4">
            <p
              className={cn(
                "mb-1.5 px-1 text-[11px] font-bold uppercase tracking-widest",
                group === "waiting" ? "text-amber-600" : "text-muted-foreground"
              )}
            >
              {GROUP_LABELS[group]}
            </p>
            <div className="space-y-1.5">
              {items.map((c) => {
                const href = `/dashboard/conversations/${c.id}`;
                const active = pathname === href;
                const style = GROUP_STYLES[group];
                const index = revealIndex++;
                return (
                  <Reveal key={c.id} index={Math.min(index, 8)}>
                    <Link href={href} className="block">
                      <motion.div
                        {...press}
                        className={cn(
                          "rounded-2xl border bg-card p-3.5 transition-colors",
                          active ? "border-primary/40 bg-accent/60" : "border-border hover:bg-muted/40",
                          group === "done" && "opacity-70"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          {/* Who */}
                          <p className="truncate text-[13.5px] font-semibold">
                            {c.customer_name || c.customer_phone}
                          </p>
                          {/* When */}
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {whenLabel(c.last_message_at)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          {/* What */}
                          <p className="truncate text-[12.5px] text-muted-foreground">
                            {c.last_message_preview || "New enquiry"}
                          </p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {draftIds.has(c.id) && (
                              <span className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
                                <Briefcase className="h-2.5 w-2.5" strokeWidth={3} />
                                Draft ready
                              </span>
                            )}
                            {/* Status */}
                            <span
                              className={cn(
                                "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
                                style.chip
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                              {statusLabel(c.status)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
