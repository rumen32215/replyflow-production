"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

/**
 * Screen 1 — the beautiful entrance. The receptionist speaks first
 * (Decision 004): the logo mark breathes in, one greeting, ONE
 * supporting sentence, one premium CTA. Nothing else — no feature
 * list, no inputs, no product pitch (Decision 003).
 */

const EASE = [0.22, 1, 0.36, 1] as const;

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function WelcomeGreeting() {
  return (
    <div className="w-full max-w-[440px]">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="rounded-3xl border border-border bg-card p-10 shadow-elevated"
      >
        {/* Logo animation: the mark scales in with a soft glow that
            settles — the product feels alive before a word is read. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.15 }}
          className="relative mb-8 h-16 w-16"
        >
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.7, 0.35] }}
            transition={{ duration: 1.6, ease: "easeOut", delay: 0.3, times: [0, 0.5, 1] }}
            className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary to-success blur-xl"
          />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-success shadow-elevated">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8">
              <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
            </svg>
          </div>
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
          {greetingForNow()} 👋
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
          Let&apos;s get everything ready for your first customer.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 1.35 }}
        >
          <Link href="/onboarding/demo" className="group block">
            <motion.span
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-[15.5px] font-semibold text-primary-foreground shadow-sm transition-shadow duration-300 group-hover:shadow-[0_10px_30px_-8px_rgba(37,99,235,0.55)]"
            >
              Let&apos;s begin
              <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
            </motion.span>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
