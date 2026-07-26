"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one primary-button behaviour for every onboarding screen — Welcome,
 * Business name, Trade, Service area & hours. A single shared component so
 * the "alive" feel (lift on hover, press on tap, a slow light sweep) reads
 * as one consistent product decision rather than a per-screen effect.
 *
 * The sweep is intentionally slow and infrequent (a few seconds of rest
 * between passes) — enough to read as quality, never enough to distract
 * from the question on screen.
 */

const SPRING = { type: "spring", stiffness: 400, damping: 24 } as const;

export function OnboardingCTA({
  onClick,
  disabled,
  children,
  type = "button",
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  type?: "button" | "submit";
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      transition={SPRING}
      animate={{ opacity: disabled ? 0.45 : 1 }}
      className={cn(
        "group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-sm transition-shadow duration-300",
        "disabled:cursor-not-allowed",
        !disabled && "hover:shadow-[0_10px_30px_-8px_rgba(37,99,235,0.55)]"
      )}
    >
      {!disabled && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/4 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/25 to-transparent"
          initial={{ x: "-140%" }}
          animate={{ x: "440%" }}
          transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 3.2 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {children}
        <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
      </span>
    </motion.button>
  );
}
