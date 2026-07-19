"use client";

import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * ReplyFlow Motion Language — the one place motion values live.
 *
 * "Motion is not decoration. Motion is communication." Every primitive
 * here maps to a rule in the Motion Language doc:
 *   - Cards never pop. Cards settle. (SettleCard)
 *   - Lists reveal top-to-bottom, like papers laid on a desk. (Reveal)
 *   - Buttons acknowledge touch: ~96% compression, no bounce. (press)
 *   - Nothing elastic, nothing exaggerated.
 */

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Tap acknowledgement, spread onto any motion element:
 *  <motion.button {...press}> */
export const press = {
  whileTap: { scale: 0.965 },
  transition: { type: "spring", stiffness: 500, damping: 30 },
} as const;

/** A card that settles into place: small upward movement, soft fade. */
export function SettleCard({
  className,
  delay = 0,
  children,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Sprint 7.7 — a card that settles into place only once it's actually
 * scrolled into view, instead of on mount. Same calm motion as
 * SettleCard (same distance, duration, easing) — the only difference
 * is *when* it fires. Reserved for content that can plausibly start
 * below the fold (the WhatsApp banner, AI Summary, Quick Actions);
 * content that's always in the initial viewport (the Greeting) stays
 * on SettleCard, since a scroll trigger there would just fire on
 * mount anyway and adds nothing but an extra concept to reason about.
 * `once: true` so it never re-triggers scrolling back up — motion
 * marks arrival, it doesn't repeat as decoration.
 */
export function ScrollReveal({
  className,
  delay = 0,
  children,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.4, ease: EASE, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Staggered list reveal — children appear one after another. */
export function Reveal({
  index = 0,
  className,
  children,
}: {
  index?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: 0.06 * index }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Content that leaves gently and is replaced without flashing —
 *  "never suddenly replace content." Key on what changed. */
export function GentleSwap({
  swapKey,
  className,
  children,
}: {
  swapKey: string | number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={swapKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: EASE }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** The success moment: check grows naturally with a soft green pulse.
 *  Satisfying, never celebratory. */
export function GrowingCheck({ className }: { className?: string }) {
  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 20 }}
      className={cn(
        "relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-success text-success-foreground",
        className
      )}
    >
      <motion.span
        aria-hidden
        initial={{ opacity: 0.5, scale: 1 }}
        animate={{ opacity: 0, scale: 1.9 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="absolute inset-0 rounded-full bg-success"
      />
      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" strokeWidth={3.5} stroke="currentColor">
        <motion.path
          d="M5 13l4 4L19 7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.08 }}
        />
      </svg>
    </motion.span>
  );
}
