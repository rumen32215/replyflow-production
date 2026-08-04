"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { X } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { EASE } from "@/components/shared/motion";
import { OnboardingProgress, ONBOARDING_STEP_MAP, ONBOARDING_TOTAL_STEPS } from "@/components/onboarding/onboarding-progress";

/**
 * Shared chrome for every onboarding step: topbar, gradient stage, and
 * the slide/fade transition between steps. Individual step pages only
 * render their form content
 * — this is what makes the steps feel like one continuous flow
 * instead of separate pages.
 *
 * EASE is ReplyFlow's one shared motion constant (components/shared/
 * motion.tsx) — the same curve every step component's own card
 * entrance and internal transitions use, and the same one the rest of
 * the dashboard already uses. One motion language, sourced from one
 * place, not a page-level easing that happens to match by coincidence.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const step = ONBOARDING_STEP_MAP[pathname];

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
          {/* Lives outside the per-step AnimatePresence below — the
           * track itself is persistent across steps (only its fill
           * width animates), which is what makes it read as "how far
           * through one flow" rather than resetting/transitioning like
           * the step content does. */}
          {step !== undefined && <OnboardingProgress step={step} total={ONBOARDING_TOTAL_STEPS} />}
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
