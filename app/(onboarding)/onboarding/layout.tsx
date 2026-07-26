"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { X } from "lucide-react";
import { Logo } from "@/components/shared/logo";

/**
 * Shared chrome for every onboarding step: topbar, gradient stage, and
 * the slide/fade transition between steps. Individual step pages only
 * render their form content
 * — this is what makes the steps feel like one continuous flow
 * instead of separate pages.
 *
 * EASE matches the curve every step component uses for its own card
 * entrance and internal transitions — one motion language throughout
 * onboarding, not a page-level easing that differs from what's inside it.
 */
const EASE = [0.22, 1, 0.36, 1] as const;
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
        <Logo />
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[13.5px] font-medium text-muted-foreground hover:text-foreground"
        >
          Save &amp; exit <X className="h-3.5 w-3.5" />
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
