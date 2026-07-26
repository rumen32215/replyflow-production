"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { OnboardingCTA } from "@/components/onboarding/onboarding-cta";

/**
 * Screen 5 — the handoff into the finished product. Deliberately built
 * with the same bright card chrome as every other onboarding screen, not
 * a separate dark "AI thinking" scene: the owner should feel like they're
 * arriving somewhere finished, not waiting on a machine.
 *
 * There is no scripted sequence of lines and no fixed multi-second pacing
 * — the only work happening is the real POST to /api/onboarding/prepare,
 * and the UI reflects that honestly. The single fixed delay in this file
 * (CONFIRM_HOLD_MS) exists only so the success checkmark is perceivable
 * for a beat before navigating — never to manufacture the appearance of
 * work that isn't happening.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const CONFIRM_HOLD_MS = 550;

export function PreparingReceptionist() {
  const router = useRouter();
  const businessName = useOnboardingStore((s) => s.businessName);
  const trade = useOnboardingStore((s) => s.trade);
  const serviceArea = useOnboardingStore((s) => s.serviceArea);
  const openDays = useOnboardingStore((s) => s.openDays);
  const openingTime = useOnboardingStore((s) => s.openingTime);
  const closingTime = useOnboardingStore((s) => s.closingTime);
  const resetStore = useOnboardingStore((s) => s.reset);

  const [status, setStatus] = useState<"working" | "ready" | "failed">("working");
  const startedRef = useRef(false);

  async function provision() {
    setStatus("working");
    try {
      const res = await fetch("/api/onboarding/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          trade: trade.trim(),
          serviceArea: serviceArea.trim(),
          openDays,
          openingTime,
          closingTime,
        }),
      });
      if (!res.ok) throw new Error("prepare_failed");
      setStatus("ready");
    } catch {
      setStatus("failed");
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

  // V1 First-Run redesign: onboarding hands straight to Meet Your
  // Receptionist, not Front Desk — she already knows enough to say
  // something real the instant setup finishes.
  useEffect(() => {
    if (status !== "ready") return;
    const t = setTimeout(() => {
      resetStore(); // onboarding is over — clear the persisted draft
      router.replace("/dashboard/receptionist/meet");
    }, CONFIRM_HOLD_MS);
    return () => clearTimeout(t);
  }, [status, resetStore, router]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-border bg-card p-9 text-center shadow-elevated sm:p-10"
    >
      <AnimatePresence mode="wait">
        {status === "working" && (
          <motion.div
            key="working"
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex flex-col items-center"
          >
            <div className="relative mb-7 h-14 w-14">
              <motion.div
                aria-hidden
                animate={{ opacity: [0.35, 0.7, 0.35] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary to-success blur-lg"
              />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-success shadow-elevated">
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
                  <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
                </svg>
              </div>
            </div>
            <p className="text-[16.5px] font-semibold tracking-tight text-foreground">
              Setting up your receptionist
            </p>
          </motion.div>
        )}

        {status === "ready" && (
          <motion.div key="ready" className="flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-success shadow-[0_10px_30px_-8px_rgba(34,197,94,0.5)]"
            >
              <Check className="h-7 w-7 text-white" strokeWidth={3} />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
              className="text-[19px] font-semibold tracking-tight text-foreground"
            >
              You&apos;re all set.
            </motion.h1>
          </motion.div>
        )}

        {status === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex w-full max-w-[320px] flex-col items-center"
          >
            <p className="mb-2 text-[17px] font-semibold tracking-tight text-foreground">
              That didn&apos;t quite go through.
            </p>
            <p className="mb-7 text-[14px] leading-relaxed text-muted-foreground">
              Nothing&apos;s been lost. Let&apos;s try that again.
            </p>
            <OnboardingCTA onClick={() => void provision()}>Try again</OnboardingCTA>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
