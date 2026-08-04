"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EASE } from "@/components/shared/motion";

/**
 * V7 founder review (2026-08-04): the previous CTA transition lived
 * entirely inside `Hero` — a full-screen overlay that unmounted the
 * instant `router.push` swapped routes, since Hero itself unmounts on
 * navigation. That made the handoff a hard cut behind the overlay's
 * back, which read as "a separate screen," not a single continuous
 * motion into sign-up ("remove the full-screen intermediary view...
 * smooth morph into the sign-up form").
 *
 * The fix is structural, not cosmetic: this provider lives in the root
 * layout, which persists across every route change (only the nested
 * segment swaps). The overlay it renders therefore survives the
 * `/signup` navigation instead of vanishing with Hero, holds briefly
 * so the new page has time to paint underneath it, then fades away —
 * a genuine crossfade handoff instead of a wash-then-cut.
 */

const EXPAND_MS = 500;
/** When the caller should actually fire `router.push` — timed so the
 * circle has fully covered the viewport before the route swaps. */
export const TRANSITION_NAVIGATE_MS = 550;
/** Total overlay lifetime — outlives the navigate call by enough for
 * the incoming page to paint, then fades out over its own tail. */
const TOTAL_LIFETIME_MS = 800;

interface Origin {
  x: number;
  y: number;
}

const TransitionContext = createContext<((origin: Origin) => void) | null>(null);

/** Fires the shared full-screen brand transition, expanding outward
 * from the given viewport-percentage origin (typically the pressed
 * CTA's own position) — call this, then separately trigger navigation
 * at `TRANSITION_NAVIGATE_MS` so the two stay in sync without this
 * provider needing to know about routing. */
export function useLaunchTransition(): (origin: Origin) => void {
  const launch = useContext(TransitionContext);
  if (!launch) throw new Error("useLaunchTransition must be used within PageTransitionProvider");
  return launch;
}

export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [origin, setOrigin] = useState<Origin>({ x: 50, y: 100 });
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const launch = useCallback((point: Origin) => {
    setOrigin(point);
    setActive(true);
    if (dismissRef.current) clearTimeout(dismissRef.current);
    dismissRef.current = setTimeout(() => setActive(false), TOTAL_LIFETIME_MS);
  }, []);

  return (
    <TransitionContext.Provider value={launch}>
      {children}
      <AnimatePresence>{active && <TransitionOverlay origin={origin} />}</AnimatePresence>
    </TransitionContext.Provider>
  );
}

/** The ReplyFlow mark itself (`logo.tsx`'s own icon path), not a
 * generic checkmark — this is meant to read as "opening the app," not
 * "task complete." A soft light burst behind it stands in for the
 * "subtle particles" ingredient without a full particle system, which
 * would fight the Apple-restraint bar set in the previous pass. */
function TransitionOverlay({ origin }: { origin: Origin }) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-primary to-success"
      initial={{ clipPath: `circle(0% at ${origin.x}% ${origin.y}%)` }}
      animate={{ clipPath: `circle(150% at ${origin.x}% ${origin.y}%)` }}
      exit={{ opacity: 0, transition: { duration: 0.3, ease: EASE } }}
      transition={{ duration: EXPAND_MS / 1000, ease: EASE }}
    >
      <motion.div
        aria-hidden
        className="absolute h-36 w-36 rounded-full bg-white/25 blur-2xl"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1.5, opacity: [0, 0.7, 0] }}
        transition={{ duration: 0.9, ease: EASE }}
      />
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.18, duration: 0.28, ease: EASE }}
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8">
          <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
        </svg>
      </motion.div>
    </motion.div>
  );
}
