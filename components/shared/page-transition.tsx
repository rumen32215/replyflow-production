"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * V7 founder review (2026-08-04): the original CTA transition lived
 * entirely inside `Hero` — a full-screen overlay that unmounted the
 * instant `router.push` swapped routes, since Hero itself unmounts on
 * navigation. The fix was structural: this provider lives in the root
 * layout, which persists across every route change (only the nested
 * segment swaps), so whatever it renders survives the `/signup`
 * navigation instead of vanishing with Hero.
 *
 * V8 founder review (2026-08-04): the *content* of that overlay was
 * then rebuilt from scratch. The V7 version — an opaque brand-gradient
 * circle washing over the entire viewport, held until the new page
 * painted underneath — was "technically correct but emotionally
 * flat," and explicitly named as reading like a loading screen no
 * matter how it was skinned. The brief pointed at Face ID, Dynamic
 * Island, Wallet, ElevenLabs — small, anchored, springy, translucent
 * motion, never a curtain over the whole screen.
 *
 * So this version never covers the page. It's a soft, blurred bloom
 * anchored at wherever the button actually was, plus a few small
 * sparks and a quick spring-scaled brand mark — all `pointer-events-
 * none`, all translucent, all gone within ~650ms. Because nothing is
 * opaque, there's nothing to "hide the swap" behind, which is exactly
 * why the old version had to coordinate its own dismissal with the
 * route finishing — this one doesn't have to; it just plays its own
 * short, fixed-length burst of delight in parallel with a fast
 * navigation, and the two are never required to line up frame-perfectly
 * for it to still look right.
 */

const NAVIGATE_MS = 200;
/** Total time the burst is mounted for — well past its own visible
 * motion (~500ms) so it never gets cut off mid-fade. */
const LIFETIME_MS = 650;

/** Fires shortly after the burst starts — early enough that arriving
 * feels immediate, late enough that the click's own reward has
 * already registered first. */
export const TRANSITION_NAVIGATE_MS = NAVIGATE_MS;

interface Origin {
  x: number;
  y: number;
}

const TransitionContext = createContext<((origin: Origin) => void) | null>(null);

/** Fires the shared brand "delight burst," anchored to the given
 * viewport-percentage origin (typically the pressed CTA's own
 * position) — call this, then separately trigger navigation at
 * `TRANSITION_NAVIGATE_MS` so the two stay in sync without this
 * provider needing to know about routing. */
export function useLaunchTransition(): (origin: Origin) => void {
  const launch = useContext(TransitionContext);
  if (!launch) throw new Error("useLaunchTransition must be used within PageTransitionProvider");
  return launch;
}

export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [origin, setOrigin] = useState<Origin>({ x: 50, y: 50 });
  const [burstId, setBurstId] = useState(0);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const launch = useCallback((point: Origin) => {
    setOrigin(point);
    setActive(true);
    setBurstId((n) => n + 1);
    if (dismissRef.current) clearTimeout(dismissRef.current);
    dismissRef.current = setTimeout(() => setActive(false), LIFETIME_MS);
  }, []);

  return (
    <TransitionContext.Provider value={launch}>
      {children}
      <AnimatePresence>{active && <TransitionBurst key={burstId} origin={origin} />}</AnimatePresence>
    </TransitionContext.Provider>
  );
}

/** A handful of small brand-coloured sparks, flung outward from the
 * origin at slightly randomised angles/distances — the "subtle
 * particles" ingredient, kept genuinely subtle (small, few, quick). */
function Sparks({ seed }: { seed: number }) {
  const sparks = useMemo(() => {
    const colors = ["#2563EB", "#22C55E", "#2563EB", "#22C55E", "#0EA5A4", "#22C55E"];
    return Array.from({ length: 6 }, (_, i) => {
      // Deterministic per-burst pseudo-randomness (no hydration risk —
      // this only ever renders client-side, after a click), spread
      // evenly around the origin with a little jitter so it reads as
      // a burst, not a ring.
      const angle = (i / 6) * Math.PI * 2 + seed * 0.7;
      const distance = 46 + ((i * 37 + seed * 13) % 26);
      return {
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        color: colors[i]!,
      };
    });
  }, [seed]);

  return (
    <>
      {sparks.map((s) => (
        <motion.span
          key={s.id}
          aria-hidden
          className="absolute h-1.5 w-1.5 rounded-full"
          style={{ background: s.color }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={{ x: s.x, y: s.y, opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </>
  );
}

function TransitionBurst({ origin }: { origin: Origin }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2, ease: "easeOut" } }}
    >
      <div className="absolute" style={{ left: `${origin.x}%`, top: `${origin.y}%` }}>
        {/* Soft blurred bloom — translucent throughout, never a solid
         * wash, so the page underneath stays visible the entire time. */}
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{
            width: 260,
            height: 260,
            background: "radial-gradient(circle, rgba(37,99,235,0.5), rgba(34,197,94,0.35) 55%, transparent 75%)",
          }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 1.15, 1.5], opacity: [0, 0.6, 0] }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />

        <div className="absolute -translate-x-1/2 -translate-y-1/2">
          <Sparks seed={Math.round(origin.x * 3 + origin.y * 7)} />
        </div>

        {/* The brand mark itself, not a checkmark — reads as "opening
         * the app," not "task complete." Spring physics, not eased
         * duration, for the liquid, Dynamic-Island-ish snap the brief
         * asked for. */}
        <motion.div
          className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_8px_24px_-6px_rgba(37,99,235,0.45)] ring-1 ring-black/5"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: [0.3, 1.12, 1, 0.85], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.35, 0.7, 1] }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path
              d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z"
              fill="url(#rf-transition-gradient)"
            />
            <defs>
              <linearGradient id="rf-transition-gradient" x1="4" y1="4" x2="20" y2="20">
                <stop offset="0" stopColor="#2563EB" />
                <stop offset="1" stopColor="#22C55E" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
      </div>
    </motion.div>
  );
}
