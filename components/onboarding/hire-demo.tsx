"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";

/**
 * Screen 2 — the live customer conversation. The same four-message
 * script as before (it works), replayed with more considered motion:
 * a typing indicator precedes every receptionist reply, pauses scale
 * with message length, and bubbles settle with a soft spring instead
 * of a linear fade.
 *
 * When the conversation ends, the whole chat fades away and one line
 * remains — "This is how I'll help every customer." — before
 * the continue button appears. No feature grid, no bullet points.
 */

type Bubble = { from: "customer" | "replyflow"; text: string };

const SCRIPT: Bubble[] = [
  { from: "customer", text: "Hi, can you quote my kitchen?" },
  { from: "replyflow", text: "Absolutely. Could you send me a few photos?" },
  { from: "customer", text: "📷 3 photos sent" },
  { from: "replyflow", text: "Perfect — I've booked you in. The team will follow up shortly." },
];

const EASE = [0.22, 1, 0.36, 1] as const;

// Reading pause before a bubble appears, roughly scaled to how long
// the previous message takes to read + typing time for replies.
function delayBefore(index: number): number {
  if (index === 0) return 700;
  const prev = SCRIPT[index - 1];
  const current = SCRIPT[index];
  if (!prev || !current) return 700;
  const reading = Math.min(400 + prev.text.length * 28, 1600);
  const typing = current.from === "replyflow" ? 900 : 300;
  return reading + typing;
}

type Phase = "chat" | "booked" | "closing" | "sentence";

export function HireDemo() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("chat");
  const [showContinue, setShowContinue] = useState(false);

  // Advance the script one bubble at a time.
  useEffect(() => {
    if (phase !== "chat") return;
    if (visibleCount >= SCRIPT.length) {
      const t = setTimeout(() => setPhase("booked"), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisibleCount((c) => c + 1), delayBefore(visibleCount));
    return () => clearTimeout(t);
  }, [visibleCount, phase]);

  // Let "Appointment booked" land, then fade the whole scene out.
  useEffect(() => {
    if (phase !== "booked") return;
    const t = setTimeout(() => setPhase("closing"), 1800);
    return () => clearTimeout(t);
  }, [phase]);

  // After the sentence settles, bring the button in.
  useEffect(() => {
    if (phase !== "sentence") return;
    const t = setTimeout(() => setShowContinue(true), 1400);
    return () => clearTimeout(t);
  }, [phase]);

  const nextIsReply = SCRIPT[visibleCount]?.from === "replyflow";

  return (
    <div className="w-full">
      <AnimatePresence
        mode="wait"
        onExitComplete={() => setPhase("sentence")}
      >
        {(phase === "chat" || phase === "booked") && (
          <motion.div
            key="chat"
            exit={{ opacity: 0, scale: 0.97, filter: "blur(4px)" }}
            transition={{ duration: 0.7, ease: EASE }}
            className="rounded-3xl border border-border bg-card p-6 shadow-elevated"
          >
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {SCRIPT.slice(0, visibleCount).map((bubble, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    className={bubble.from === "customer" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed " +
                        (bubble.from === "customer"
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm bg-muted text-foreground")
                      }
                    >
                      {bubble.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator, only while the receptionist is "typing" */}
              <AnimatePresence>
                {phase === "chat" && nextIsReply && visibleCount > 0 && (
                  <motion.div
                    key="typing"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="flex justify-start"
                  >
                    <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50"
                          style={{ animationDelay: `${i * 140}ms`, animationDuration: "900ms" }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {phase === "booked" && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 20 }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="flex items-center gap-2 overflow-hidden rounded-xl bg-success/10 px-3.5 py-2.5 text-[12.5px] font-semibold text-success"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  Appointment booked
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "sentence" && (
        <div className="flex min-h-[300px] flex-col items-center justify-center px-2 text-center">
          <motion.p
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, ease: EASE }}
            className="text-[22px] font-extrabold leading-snug tracking-tight"
          >
            This is how I&apos;ll help every customer.
          </motion.p>

          <div className="mt-10 h-[52px] w-full max-w-[300px]">
            <AnimatePresence>
              {showContinue && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: EASE }}
                >
                  <Link href="/onboarding/business-name" className="group block">
                    <motion.span
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{ type: "spring", stiffness: 400, damping: 24 }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-sm transition-shadow duration-300 group-hover:shadow-[0_10px_30px_-8px_rgba(37,99,235,0.55)]"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                    </motion.span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
