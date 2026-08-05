"use client";

import { motion } from "framer-motion";
import { EASE } from "@/components/shared/motion";

/**
 * The one way the receptionist speaks, everywhere it speaks — extracted
 * from Meet Your Receptionist (V21.6) so onboarding's own encounter
 * uses the exact same primitive rather than a visually-similar one.
 * No icon, no avatar attached to each line: continuity comes from
 * reusing this component itself, not from matching two different
 * implementations by eye.
 */
export function Bubble({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay }}
      className="max-w-[560px] rounded-2xl rounded-bl-md bg-card px-4 py-3 text-[14.5px] leading-relaxed text-foreground shadow-sm border border-border"
    >
      {children}
    </motion.div>
  );
}
