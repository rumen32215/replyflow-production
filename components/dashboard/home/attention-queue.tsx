"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Briefcase, MessageCircle, Sparkles } from "lucide-react";
import { SettleCard, Reveal, press } from "@/components/shared/motion";
import { formatWaitingTime } from "@/lib/dashboard-signals";
import { attentionReason, type AttentionItem } from "@/lib/front-desk-signals";
import { cn } from "@/lib/utils";

/**
 * Needs Your Attention (Owner Experience 01) — the one real queue of
 * everything only the owner can unblock: a customer waiting for a
 * reply, a Work Card draft awaiting approval, or an AI-drafted reply
 * awaiting an OK. Deliberately one merged, urgency-sorted list rather
 * than three side-by-side boards that all say roughly "check me first"
 * — a single list the eye can scan top-to-bottom is what actually
 * guides attention from highest to lowest priority; three lists just
 * ask the owner to decide which one to read first.
 */
function nameFor(item: AttentionItem): string {
  switch (item.kind) {
    case "waiting_conversation":
      return item.name;
    case "draft_work_card":
      return item.customerName;
    case "pending_reply":
      return item.customerName;
  }
}

function hrefFor(item: AttentionItem): string {
  switch (item.kind) {
    case "waiting_conversation":
      return `/dashboard/conversations/${item.conversationId}`;
    case "draft_work_card":
      return item.conversationId ? `/dashboard/conversations/${item.conversationId}` : "/dashboard/conversations";
    case "pending_reply":
      return `/dashboard/conversations/${item.conversationId}`;
  }
}

function IconFor({ item }: { item: AttentionItem }) {
  if (item.kind === "waiting_conversation" && item.isEmergency) return <AlertTriangle className="h-4 w-4" />;
  if (item.kind === "waiting_conversation") return <MessageCircle className="h-4 w-4" />;
  if (item.kind === "draft_work_card") return <Briefcase className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
}

function isEmergencyItem(item: AttentionItem): boolean {
  return item.kind === "waiting_conversation" && item.isEmergency;
}

export function AttentionQueue({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;

  return (
    <SettleCard delay={0.06}>
      <h2 className="mb-2.5 text-[15px] font-bold tracking-tight">
        Needs your attention
        <span className="ml-1.5 font-semibold text-muted-foreground">({items.length})</span>
      </h2>
      <div className="space-y-2">
        {items.map((item, i) => {
          const key = item.kind === "waiting_conversation" ? item.conversationId : item.kind === "draft_work_card" ? item.workCardId : item.draftId;
          const emergency = isEmergencyItem(item);
          return (
            <Reveal key={key} index={i}>
              <Link href={hrefFor(item)} className="group block">
                <motion.div
                  {...press}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border-l-4 p-4 pl-3.5 transition-shadow group-hover:shadow-sm",
                    emergency ? "border-destructive bg-destructive/[0.06]" : "border-attention bg-attention/[0.06]"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      emergency ? "bg-destructive/15 text-destructive" : "bg-attention/15 text-attention"
                    )}
                  >
                    <IconFor item={item} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{nameFor(item)}</p>
                    <p className="truncate text-[12.5px] text-muted-foreground">
                      {attentionReason(item)}
                      {item.minutes > 0 && ` · waiting ${formatWaitingTime(item.minutes)}`}
                    </p>
                  </div>
                  <ArrowRight
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5",
                      emergency ? "text-destructive" : "text-attention"
                    )}
                  />
                </motion.div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </SettleCard>
  );
}
