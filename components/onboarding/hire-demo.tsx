"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { PhonePreview, type PreviewTurn } from "@/components/shared/phone-preview";

/**
 * Screen 2 — the live customer conversation.
 *
 * Sprint 8.6: this used to be its own bespoke chat UI (its own bubble
 * markup, its own colours, no phone chrome) — a third, visually
 * different "WhatsApp-style demonstration" alongside Receptionist's
 * and Business Knowledge's `PhonePreview`. There is now exactly one
 * canonical conversation preview in the product; this screen reuses it
 * rather than rendering its own. The script, pacing, and closing
 * sentence stay bespoke to onboarding's first-impression moment —
 * only the chat frame and bubbles are shared.
 */

const SCRIPT: PreviewTurn[] = [
  { from: "customer", text: "Hi, can you quote my kitchen?" },
  { from: "receptionist", text: "Absolutely. Could you send me a few photos?" },
  { from: "customer", text: "📷 3 photos sent" },
  { from: "receptionist", text: "Perfect — I've booked you in. The team will follow up shortly." },
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
  const typing = current.from === "receptionist" ? 900 : 300;
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

  // The revealed slice of the script, split into "already settled"
  // turns and the one currently live — the exact shape PhonePreview
  // already expects from Receptionist/Business Knowledge, so her
  // reply here gets the same typing-dots-then-type animation for free.
  const shown = SCRIPT.slice(0, visibleCount);
  const lastIsReply = shown.length > 0 && shown[shown.length - 1]?.from === "receptionist";
  const turns = lastIsReply ? shown.slice(0, -1) : shown;
  const liveReply = lastIsReply ? shown[shown.length - 1]!.text : "";

  return (
    <div className="w-full">
      <AnimatePresence mode="wait" onExitComplete={() => setPhase("sentence")}>
        {(phase === "chat" || phase === "booked") && (
          <motion.div
            key="chat"
            exit={{ opacity: 0, scale: 0.97, filter: "blur(4px)" }}
            transition={{ duration: 0.7, ease: EASE }}
            className="rounded-3xl border border-border bg-card p-6 shadow-elevated"
          >
            <PhonePreview businessName="Your Business" turns={turns} liveReply={liveReply} />

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
