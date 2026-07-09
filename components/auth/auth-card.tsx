"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Shared shell for every auth screen (login, signup, forgot-password,
 * verify-email). Keeps the fade/slide-in animation, card sizing, and
 * spacing identical across all four so the flow feels like one
 * continuous experience rather than four different forms.
 */
export function AuthCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "w-full max-w-[440px] rounded-3xl border border-border bg-card p-10 shadow-elevated",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
