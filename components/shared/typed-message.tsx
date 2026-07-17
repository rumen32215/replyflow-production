"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The living preview (Motion Language: Phone Preview).
 *
 * When knowledge changes, the preview never instantly swaps text.
 * It pauses. Deletes. Thinks. Retypes — exactly like somebody
 * rewriting a real message. The owner should feel like ReplyFlow is
 * learning, not refreshing.
 *
 * The whole sequence is driven by `targetText`: each change cancels
 * any in-flight timers (via effect cleanup) and begins
 * pause -> delete -> think -> type from whatever is currently visible.
 */
export function useTypedMessage(targetText: string) {
  const [display, setDisplay] = useState("");
  const [phase, setPhase] = useState<"idle" | "deleting" | "thinking" | "typing">("thinking");
  const displayRef = useRef(display);
  displayRef.current = display;

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    async function run() {
      const current = displayRef.current;
      if (current === targetText) {
        setPhase("idle");
        return;
      }

      // Pause — a person notices before they react.
      await wait(current ? 350 : 150);
      if (cancelled) return;

      // Delete — quickly, in small chunks, like holding backspace.
      if (current.length > 0) {
        setPhase("deleting");
        let remaining = current;
        while (remaining.length > 0) {
          remaining = remaining.slice(0, Math.max(0, remaining.length - 3));
          setDisplay(remaining);
          await wait(14);
          if (cancelled) return;
        }
      }

      // Think — the typing indicator breathes for a moment.
      setPhase("thinking");
      await wait(520);
      if (cancelled) return;

      // Retype — fast enough to feel responsive, slow enough to read.
      setPhase("typing");
      const total = Math.min(1500, Math.max(650, targetText.length * 14));
      const step = Math.max(9, total / Math.max(1, targetText.length));
      for (let i = 1; i <= targetText.length; i++) {
        setDisplay(targetText.slice(0, i));
        await wait(step);
        if (cancelled) return;
      }
      setPhase("idle");
    }

    void run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [targetText]);

  return { display, isThinking: phase === "thinking", isBusy: phase !== "idle" };
}

/** Three soft dots — never a spinner, never an infinite loader. */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-label="typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}
