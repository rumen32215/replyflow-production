"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";

/**
 * Screen 5 — "Preparing your receptionist". The most considered moment
 * in onboarding: a full-bleed dark scene with soft light, no spinners,
 * no progress bars. Four calm lines cross-fade one after another while
 * the account is provisioned in the background.
 *
 * Two things run in parallel:
 *   1. The staged sequence (fixed pacing, purely presentational).
 *   2. POST /api/onboarding/prepare with the business name and trade
 *      collected on the previous two screens — this creates the
 *      `businesses` row (idempotent; never overwrites an existing one).
 *
 * Only when BOTH complete does the green confirmation appear —
 * "Your receptionist is ready." — and the dashboard opens by itself
 * about a second later. No button, no extra click: the journey is
 * already complete, so we simply open the door.
 *
 * If provisioning fails, the scene stays dark and calm and offers a
 * single retry — never a redirect into a dashboard that would bounce.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

const LINES = [
  "Preparing your front desk",
  "Learning your business",
  "Getting ready for today's customers",
  "Opening today's diary",
];

const LINE_MS = 1600; // each line holds the stage for 1.6s
const READY_HOLD_MS = 1100; // "ready" moment breathes, then the dashboard opens

export function PreparingReceptionist() {
  const router = useRouter();
  const businessName = useOnboardingStore((s) => s.businessName);
  const trade = useOnboardingStore((s) => s.trade);
  const resetStore = useOnboardingStore((s) => s.reset);

  const [lineIndex, setLineIndex] = useState(0);
  const [sequenceDone, setSequenceDone] = useState(false);
  const [serverDone, setServerDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const startedRef = useRef(false);

  async function provision() {
    setFailed(false);
    try {
      const res = await fetch("/api/onboarding/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          trade: trade.trim(),
        }),
      });
      if (!res.ok) throw new Error("prepare_failed");
      setServerDone(true);
    } catch {
      setFailed(true);
    }
  }

  // Fire the server call once. (Guarded against Strict Mode's dev
  // double-invoke; the endpoint is idempotent regardless.)
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void provision();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Walk through the lines. If the server hasn't confirmed by the time
  // the last line finishes, hold on the final line until it does.
  useEffect(() => {
    if (sequenceDone) return;
    const t = setTimeout(() => {
      if (lineIndex < LINES.length - 1) {
        setLineIndex((i) => i + 1);
      } else {
        setSequenceDone(true);
      }
    }, LINE_MS);
    return () => clearTimeout(t);
  }, [lineIndex, sequenceDone]);

  const ready = sequenceDone && serverDone && !failed;

  // The premium ending: no button. One beat after "ready", onboarding
  // hands over naturally to the Receptionist — the owner meets their
  // new employee, they don't land on a dashboard. (Final Brief:
  // "The onboarding should end naturally by introducing the
  // Receptionist. Not simply redirecting to the dashboard.")
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      resetStore(); // onboarding is over — clear the persisted draft
      router.replace("/dashboard/receptionist?welcome=1");
    }, READY_HOLD_MS);
    return () => clearTimeout(t);
  }, [ready, resetStore, router]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#080d17]">
      {/* Soft lighting: two slow-breathing glows, no hard edges */}
      <motion.div
        aria-hidden
        animate={{ opacity: [0.5, 0.85, 0.5], scale: [1, 1.08, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-1/2 top-[38%] h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.16), transparent 62%)" }}
      />
      <motion.div
        aria-hidden
        animate={{ opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        className="pointer-events-none absolute bottom-[-160px] right-[-120px] h-[480px] w-[480px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(34,197,94,0.10), transparent 60%)" }}
      />

      {/* The dashboard's light theme arrives as a deliberate scene
       * change, not a jarring reload — this fades toward it during
       * the same beat the "ready" moment already holds for, so the
       * cut from this dark stage to the light dashboard feels like
       * one continuous handoff. */}
      {ready && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: READY_HOLD_MS / 1000, ease: EASE }}
          className="pointer-events-none absolute inset-0 z-10 bg-background"
        />
      )}

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <AnimatePresence mode="wait">
          {!ready && !failed && (
            <motion.div
              key="sequence"
              exit={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}
              transition={{ duration: 0.6, ease: EASE }}
              className="flex flex-col items-center"
            >
              {/* A quiet pulse of light in place of any loader */}
              <motion.div
                animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.12, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="mb-12 h-3 w-3 rounded-full bg-white shadow-[0_0_28px_10px_rgba(147,180,255,0.35)]"
              />

              <div className="relative h-10 w-full max-w-[420px]">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={lineIndex}
                    initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
                    transition={{ duration: 0.55, ease: EASE }}
                    className="absolute inset-x-0 text-[21px] font-semibold tracking-tight text-white/90"
                  >
                    {LINES[lineIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {ready && (
            <motion.div key="ready" className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-success shadow-[0_0_60px_14px_rgba(34,197,94,0.35)]"
              >
                <Check className="h-9 w-9 text-white" strokeWidth={3} />
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
                className="text-[26px] font-extrabold tracking-tight text-white"
              >
                Your receptionist is ready.
              </motion.h1>
            </motion.div>
          )}

          {failed && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="flex max-w-[380px] flex-col items-center"
            >
              <p className="mb-3 text-[19px] font-semibold tracking-tight text-white/90">
                One moment — that didn&apos;t quite go through.
              </p>
              <p className="mb-8 text-[14px] leading-relaxed text-white/50">
                Nothing&apos;s been lost. Let&apos;s try that again.
              </p>
              <motion.button
                type="button"
                onClick={() => void provision()}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                className="rounded-xl bg-white px-8 py-3.5 text-[14.5px] font-semibold text-[#080d17] shadow-sm transition-shadow duration-300 hover:shadow-[0_10px_34px_-8px_rgba(255,255,255,0.35)]"
              >
                Try again
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
