"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { OnboardingCTA } from "@/components/onboarding/onboarding-cta";
import { EASE } from "@/components/shared/motion";
import { GradientText } from "@/components/shared/gradient-text";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";

/**
 * Screen 1 — the beautiful entrance. The receptionist speaks first
 * (Decision 004): the logo mark breathes in, one greeting, ONE
 * supporting sentence, one premium CTA. Nothing else — no feature
 * list, no inputs, no product pitch (Decision 003).
 */

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function WelcomeGreeting() {
  const router = useRouter();
  const reset = useOnboardingStore((s) => s.reset);

  // RC5: the onboarding draft persists to localStorage so a refresh or
  // accidental back-navigation mid-flow doesn't cost progress — but
  // that same persistence meant an abandoned earlier attempt on the
  // same browser (a different signup, a previous incomplete try) could
  // silently pre-fill a brand new one. Welcome is always the true
  // entry point of onboarding, so arriving here always means "start
  // fresh" — every field genuinely begins empty.
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-[440px]">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="rounded-3xl border border-border bg-card p-10 shadow-elevated"
      >
        {/* Logo animation: the mark scales in with a soft glow that
            settles, then keeps breathing — a quiet float, an ambient
            glow that never fully rests, and an occasional tiny pulse.
            The receptionist is already awake before a word is read. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.15 }}
          className="relative mb-8 h-16 w-16"
        >
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
            className="relative h-16 w-16"
          >
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.7, 0.35] }}
              transition={{ duration: 1.6, ease: "easeOut", delay: 0.3, times: [0, 0.5, 1] }}
              className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary to-success blur-xl"
            />
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.15, 0.45, 0.15] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.9 }}
              className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary to-success blur-xl"
            />
            <motion.div
              animate={{ scale: [1, 1.035, 1] }}
              transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 3.3, ease: "easeInOut", delay: 2.6 }}
              className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-success shadow-elevated"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8">
                <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
              </svg>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Time-of-day greeting is computed in the browser; the server
            render may disagree by an hour boundary, which is fine. */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.5 }}
          className="mb-2 text-[30px] font-extrabold leading-tight tracking-tight"
          suppressHydrationWarning
        >
          {greetingForNow()}.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.75 }}
          className="mb-2 text-[19px] font-semibold tracking-tight text-foreground"
        >
          Welcome to ReplyFlow.
        </motion.p>

        {/* One supporting sentence only. */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 1.05 }}
          className="mb-9 text-[15px] leading-relaxed text-muted-foreground"
        >
          Let&apos;s get you ready for your <GradientText>first customer</GradientText>.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 1.35 }}
        >
          <OnboardingCTA onClick={() => router.push("/onboarding/business-name")}>
            Let&apos;s begin
          </OnboardingCTA>
        </motion.div>
      </motion.div>
    </div>
  );
}
