"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Briefcase, MessageCircle } from "lucide-react";
import { SettleCard, Reveal, press } from "@/components/shared/motion";
import { formatWaitingTime } from "@/lib/dashboard-signals";

/**
 * The decision queue — "what needs attention?" answered as one ranked
 * list, not a re-listing of every table on the page. Two real kinds of
 * decision exist in the data today: a customer waiting for a reply,
 * and a draft job awaiting the owner's approval/rejection (jobs.status
 * = 'draft', added specifically so bookings created from a
 * conversation are "never auto-finalised" — lib/conversations.ts).
 * Waiting customers rank first (a person is waiting); drafts follow.
 */
export interface UrgentConversationItem {
  kind: "waiting_conversation";
  conversationId: string;
  name: string;
  reason: string;
  minutes: number;
}

export interface UrgentJobItem {
  kind: "draft_job";
  jobId: string;
  conversationId: string | null;
  jobTitle: string;
  customerName: string;
}

export type UrgentItem = UrgentConversationItem | UrgentJobItem;

export function UrgentWork({ items }: { items: UrgentItem[] }) {
  if (items.length === 0) return null;

  return (
    <SettleCard delay={0.06}>
      <h2 className="mb-2.5 text-[15px] font-bold tracking-tight">Urgent work</h2>
      <div className="space-y-2">
        {items.map((item, i) => {
          const href =
            item.kind === "waiting_conversation"
              ? `/dashboard/conversations/${item.conversationId}`
              : item.conversationId
                ? `/dashboard/conversations/${item.conversationId}`
                : "/dashboard/conversations";
          const key = item.kind === "waiting_conversation" ? item.conversationId : item.jobId;
          return (
            <Reveal key={key} index={i}>
              <Link href={href} className="group block">
                <motion.div
                  {...press}
                  className="flex items-center gap-3 rounded-2xl border-l-4 border-attention bg-attention/[0.06] p-4 pl-3.5 transition-shadow group-hover:shadow-sm"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-attention/15 text-attention">
                    {item.kind === "waiting_conversation" ? (
                      <MessageCircle className="h-4 w-4" />
                    ) : (
                      <Briefcase className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">
                      {item.kind === "waiting_conversation" ? item.name : item.customerName}
                    </p>
                    <p className="truncate text-[12.5px] text-muted-foreground">
                      {item.kind === "waiting_conversation"
                        ? `${item.reason} · waiting ${formatWaitingTime(item.minutes)}`
                        : `${item.jobTitle} · awaiting your approval`}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-attention transition-transform group-hover:translate-x-0.5" />
                </motion.div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </SettleCard>
  );
}
