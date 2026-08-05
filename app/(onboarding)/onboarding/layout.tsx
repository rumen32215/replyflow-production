"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { EASE } from "@/components/shared/motion";

/**
 * Shared chrome for screen 5 — the only route left under `/onboarding`
 * now that the three pre-account questions moved to `(hire)`. No
 * progress bar (v16 §3.3 — a step counter over one screen never made
 * sense, and it's banned outright regardless) and no "Save & exit"
 * (v16 §3.8, same reasoning as `(hire)/hire/layout.tsx`) — the logo
 * linking home is enough.
 *
 * EASE is ReplyFlow's one shared motion constant (components/shared/
 * motion.tsx) — the same curve every step component's own card
 * entrance and internal transitions use, and the same one the rest of
 * the dashboard already uses.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at 15% -10%, rgba(37,99,235,0.07), transparent 45%), radial-gradient(circle at 100% 110%, rgba(34,197,94,0.06), transparent 45%), hsl(var(--background))",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-6">
        <Link href="/">
          <Logo />
        </Link>
      </div>

      <div className="flex items-start justify-center px-5 pb-20 pt-4">
        <div className="w-full max-w-[460px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
