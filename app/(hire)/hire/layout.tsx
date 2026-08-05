"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { EASE } from "@/components/shared/motion";
import { ReceptionistPresence } from "@/components/onboarding/receptionist-presence";

/**
 * Shared chrome for the three real questions asked before an account
 * exists — business name, trade, service area (Employment Philosophy
 * v16 §4, `DOCS/SPECS/ReplyFlow-Onboarding-Implementation-Architecture.md`
 * §3.1). Deliberately outside `/onboarding`, `/dashboard`, and `/admin`
 * — the three prefixes `middleware.ts` actually protects — so no
 * change to that file was needed; these routes are unauthenticated by
 * the same existing logic that already leaves `/signup` and `/login`
 * open.
 *
 * No progress indicator (v16 §3.3 bans step counters outright), no
 * "Save & exit" (v16 §3.8 — a document metaphor, and there's nothing
 * to lose pre-account; the logo linking home is enough, the same
 * minimalism `(auth)/layout.tsx` already uses). `ReceptionistPresence`
 * sits outside the per-route `AnimatePresence` for the same reason the
 * old progress bar did — it's the one thing meant to persist across
 * the transition rather than reset with it.
 */
export default function HireLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="aurora-layer" aria-hidden="true">
        <div className="aurora-blob aurora-blob-primary" />
        <div className="aurora-blob aurora-blob-success" />
      </div>
      <div className="relative mx-auto flex max-w-5xl items-center justify-between px-8 py-6">
        <Link href="/">
          <Logo />
        </Link>
      </div>

      <div className="relative flex items-start justify-center px-5 pb-20 pt-6">
        <div className="w-full max-w-[460px]">
          <ReceptionistPresence />
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
