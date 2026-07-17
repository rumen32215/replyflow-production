"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { SettleCard, EASE } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

/**
 * One topic in a teaching interview — its avatar, its question as a
 * received-message bubble, a check once it knows something here, and
 * a one-line summary in its own voice while collapsed. Shared by
 * Receptionist and Business Knowledge so "teaching the receptionist
 * something" is one interaction model with two sets of content, not
 * two bespoke UIs: it leads with the one thing it doesn't know yet,
 * and once a topic is answered it collapses into a compact, scannable
 * line — tapping it again reopens a short, focused exchange to change it.
 */
export function TeachingCard({
  index = 0,
  icon: Icon,
  avatarClass = "bg-slate-100 text-slate-600",
  bubbleClass = "bg-muted",
  question,
  known,
  summary,
  open,
  onToggle,
  className,
  children,
}: {
  index?: number;
  icon: LucideIcon;
  avatarClass?: string;
  bubbleClass?: string;
  question: string;
  known: boolean;
  summary: string | null;
  open: boolean;
  onToggle: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <SettleCard
      delay={0.04 * index}
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={{ scale: 0.99 }}
        aria-expanded={open}
        className="flex w-full items-start gap-2.5 px-4 py-3.5 text-left"
      >
        <div className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full", avatarClass)}>
          <Icon className="h-[15px] w-[15px]" />
          {known && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-card"
            >
              <Check className="h-2 w-2" strokeWidth={3.5} />
            </motion.span>
          )}
        </div>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className={cn("inline-block max-w-full rounded-2xl rounded-tl-sm px-3.5 py-2 text-[13px] leading-relaxed", bubbleClass)}>
            {question}
          </span>
          <span className="mt-1.5 block truncate text-[12px] text-muted-foreground">
            {summary ?? "I don't know this yet"}
          </span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="mt-1.5 shrink-0 text-muted-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-border py-4 pl-[46px] pr-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </SettleCard>
  );
}
