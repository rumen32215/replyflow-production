"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { EASE, press } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

/**
 * One Booking Rule, collapsed to its name and current value by
 * default — reduces eight simultaneously-visible controls (chips,
 * toggles, time pickers) down to one at a time, the real fix for the
 * "settings page" visual fatigue Diary had. Deliberately lighter than
 * `TeachingCard` (no avatar, no chat bubble): a rule isn't a question
 * she's asking, it's a behaviour the owner is editing, so this reuses
 * only the collapse mechanics, not the interview visual model.
 */
export function CollapsibleRule({
  label,
  summary,
  open,
  onToggle,
  children,
}: {
  label: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="py-0.5">
      <motion.button
        {...press}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/40"
      >
        <span className="text-[13.5px] font-semibold">{label}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-[12px] text-muted-foreground">{summary}</span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className={cn("text-muted-foreground", open && "text-foreground")}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </span>
      </motion.button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2.5 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
