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
  learning: "Learning...",
} as const;

/** A pool of natural, interchangeable acknowledgements — used instead
 * of one fixed phrase per field, since tapping the same chip several
 * times in a row and seeing the identical sentence every time reads
 * as robotic, not alive. Picked without repeating the last one shown. */
const ROTATING_ACKS = [
  "Got it.",
  "Perfect.",
  "Saved.",
  "I'll remember that.",
  "Thanks, that helps.",
  "Customers won't see this — but I will.",
  "I'll use that from now on.",
] as const;

let lastAckIndex = -1;
export function randomAck(): string {
  let index = Math.floor(Math.random() * ROTATING_ACKS.length);
  if (ROTATING_ACKS.length > 1 && index === lastAckIndex) {
    index = (index + 1) % ROTATING_ACKS.length;
  }
  lastAckIndex = index;
  return ROTATING_ACKS[index]!;
}

/** Errors never panic — no red banners, no technical language, and
 * never imply the owner's own words were lost (they weren't; the
 * field still holds them, only the save is retried). */
const SOFT_ERROR = "I'm having trouble saving this right now. Your text is still here.";

export function useAcknowledgement(holdMs = 2200) {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Call right before the actual save request goes out — never while
   * the owner is still typing (Motion Language: acknowledgements only
   * follow completed actions). Holds until acknowledge()/softError(). */
  const startSaving = useCallback((text: string = ACK.learning) => {
    if (timer.current) clearTimeout(timer.current);
    setIsError(false);
    setIsSaving(true);
    setMessage(text);
  }, []);

  const acknowledge = useCallback(
    (text: string = ACK.remember) => {
      if (timer.current) clearTimeout(timer.current);
      setIsError(false);
      setIsSaving(false);
      setMessage(text);
      timer.current = setTimeout(() => setMessage(null), holdMs);
    },
    [holdMs]
  );

  const softError = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setIsError(true);
    setIsSaving(false);
    setMessage(SOFT_ERROR);
    timer.current = setTimeout(() => setMessage(null), holdMs + 1200);
  }, [holdMs]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { message, isError, isSaving, startSaving, acknowledge, softError };
}

export function Acknowledgement({
  message,
  isError = false,
  isSaving = false,
  className,
}: {
  message: string | null;
  isError?: boolean;
  isSaving?: boolean;
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
          {isSaving ? (
            <motion.span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full bg-primary"
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : (
            !isError && <GrowingCheck className="h-4 w-4" />
          )}
          <span
            className={cn(
              "text-[13px] font-medium",
              isError || isSaving ? "text-muted-foreground" : "text-success"
            )}
          >
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
