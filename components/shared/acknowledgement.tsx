"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EASE, GrowingCheck } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

/**
 * The receptionist's micro-moments — "✓ Perfect. I'll remember that."
 *
 * These replace every Saved toast, every confirmation dialog, every
 * "Update complete." They appear, they reassure, they disappear.
 * (Motion Language: Success / Micro Moments; One Thought Ahead:
 * "Did that save?" is answered before the owner asks.)
 */

export const ACK = {
  remember: "Perfect. I'll remember that.",
  helpful: "That's helpful.",
  updated: "I've updated how I'll answer.",
  gotIt: "Got it.",
  nice: "Nice.",
  useNextTime: "I'll use that next time.",
  diary: "I've updated the diary.",
  ready: "I'm ready.",
} as const;

const SOFT_ERROR = "I couldn't save that just yet. Let's try again.";

export function useAcknowledgement(holdMs = 2200) {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const acknowledge = useCallback(
    (text: string = ACK.remember) => {
      if (timer.current) clearTimeout(timer.current);
      setIsError(false);
      setMessage(text);
      timer.current = setTimeout(() => setMessage(null), holdMs);
    },
    [holdMs]
  );

  /** Errors never panic — no red banners, no technical language. */
  const softError = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setIsError(true);
    setMessage(SOFT_ERROR);
    timer.current = setTimeout(() => setMessage(null), holdMs + 1200);
  }, [holdMs]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { message, isError, acknowledge, softError };
}

export function Acknowledgement({
  message,
  isError = false,
  className,
}: {
  message: string | null;
  isError?: boolean;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3, ease: EASE }}
          className={cn("flex items-center gap-2", className)}
          role="status"
          aria-live="polite"
        >
          {!isError && <GrowingCheck className="h-4 w-4" />}
          <span
            className={cn(
              "text-[13px] font-medium",
              isError ? "text-muted-foreground" : "text-success"
            )}
          >
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
