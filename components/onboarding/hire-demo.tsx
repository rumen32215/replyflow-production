"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Camera, TrendingUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type Bubble = { from: "customer" | "replyflow"; text: string };

const SCRIPT: Bubble[] = [
  { from: "customer", text: "Hi, can you quote my kitchen?" },
  { from: "replyflow", text: "Absolutely. Could you send me a few photos?" },
  { from: "customer", text: "📷 3 photos sent" },
  { from: "replyflow", text: "Perfect — I've booked you in. The team will follow up shortly." },
];

const CARDS = [
  { icon: Zap, label: "Reply instantly" },
  { icon: Camera, label: "Collect photos" },
  { icon: TrendingUp, label: "Book more work" },
];

/**
 * Plays the four-message script once on mount, one bubble every 1.1s,
 * fully cleaned up on unmount. This is deliberately simpler than the
 * character-by-character typing built for the AI Receptionist preview
 * (lib usage there is tied to live form state that can change mid-type
 * — this script never changes, so a stepped reveal is all it needs).
 */
function useScriptedReveal(script: Bubble[], stepMs: number) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= script.length) return;
    const timer = setTimeout(() => setVisibleCount((c) => c + 1), stepMs);
    return () => clearTimeout(timer);
  }, [visibleCount, script.length, stepMs]);

  return visibleCount;
}

export function HireDemo() {
  const visibleCount = useScriptedReveal(SCRIPT, 1100);
  const done = visibleCount >= SCRIPT.length;

  return (
    <div className="w-full">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-elevated">
        <div className="mb-5 space-y-2.5">
          <AnimatePresence initial={false}>
            {SCRIPT.slice(0, visibleCount).map((bubble, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
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

          {!done && (
            <div className="flex justify-start">
              <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50"
                    style={{ animationDelay: `${i * 120}ms`, animationDuration: "900ms" }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2 overflow-hidden rounded-xl bg-success/10 px-3.5 py-2.5 text-[12.5px] font-semibold text-success"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              Appointment booked
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 text-center">
        <h2 className="mb-5 text-[19px] font-extrabold tracking-tight">Here&apos;s what I&apos;ll do for you.</h2>
        <div className="mb-8 grid grid-cols-3 gap-2.5">
          {CARDS.map((card) => (
            <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
              <span className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-primary">
                <card.icon className="h-4 w-4" />
              </span>
              <p className="text-[12px] font-semibold leading-snug">{card.label}</p>
            </div>
          ))}
        </div>

        <Link href="/dashboard">
          <Button variant="primary" size="lg" className="w-full">
            Connect WhatsApp
          </Button>
        </Link>
      </div>
    </div>
  );
}
