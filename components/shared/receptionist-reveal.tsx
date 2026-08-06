"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { DeviceFrame } from "@/components/marketing/device-frame";
import { EASE } from "@/components/shared/motion";

/**
 * V8 architectural reset — the final moment of the receptionist
 * creation experience. Nothing new appears from nowhere: the
 * "Receptionist Online" tile itself, exactly where it's sitting on
 * screen, grows into the phone and becomes the real ReplyFlow app.
 *
 * Deliberately NOT built on framer-motion's automatic cross-tree
 * `layoutId` matching — the source tile (deep inside `PeaceOfMind`)
 * and this overlay (mounted at the root layout, same structural
 * reason `PageTransitionProvider` lives there — it must survive the
 * navigation that unmounts everything below it) are far apart in the
 * tree, and this is the single highest-stakes animation in the whole
 * flow, shipping straight to production with no preview pass. An
 * explicit rect-to-fullscreen transform, driven by real
 * `getBoundingClientRect()` coordinates captured at the moment of
 * activation, is more code than a shared layoutId but fully
 * predictable — nothing here depends on framer-motion's internal
 * cross-component bookkeeping behaving a particular way.
 *
 * The overlay covers the screen for as long as it genuinely takes —
 * not a fixed guessed duration. It waits for the real Next.js
 * navigation to actually land (`usePathname` matching the requested
 * destination) before it ever starts dismissing, so a slow server
 * render never gets cut off mid-load with the real page flashing in
 * unfinished. This is the same "provider that outlives the route
 * change" structure `page-transition.tsx` already established.
 */

interface RevealRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface RevealContextValue {
  reveal: (rect: RevealRect, destination: string) => void;
}

const RevealContext = createContext<RevealContextValue | null>(null);

export function useReceptionistReveal(): RevealContextValue {
  const ctx = useContext(RevealContext);
  if (!ctx) throw new Error("useReceptionistReveal must be used within ReceptionistRevealProvider");
  return ctx;
}

const MIN_COVER_MS = 900;

export function ReceptionistRevealProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [origin, setOrigin] = useState<RevealRect | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const landedAtRef = useRef<number | null>(null);

  const reveal = useCallback(
    (rect: RevealRect, dest: string) => {
      setOrigin(rect);
      setDestination(dest);
      setDismissing(false);
      landedAtRef.current = null;
      // Two rAFs: the overlay must paint at the tile's exact rect
      // first (origin state), then get one more frame to settle
      // before the expand transition starts — otherwise the browser
      // can coalesce the initial paint and the expand into a single
      // frame, and the "grows from here" feeling is lost entirely.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setExpanded(true));
      });
      router.push(dest);
    },
    [router]
  );

  // Fires once the real navigation has actually landed (not a guessed
  // timeout) — then holds the cover for one more fixed beat so the
  // destination has visibly settled before it's revealed.
  useEffect(() => {
    if (!destination || pathname !== destination || landedAtRef.current) return;
    landedAtRef.current = Date.now();
    const t = setTimeout(() => setDismissing(true), MIN_COVER_MS);
    return () => clearTimeout(t);
  }, [pathname, destination]);

  const active = origin !== null;

  return (
    <RevealContext.Provider value={{ reveal }}>
      {children}
      <AnimatePresence>
        {active && !dismissing && (
          <motion.div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[200]"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5, ease: EASE } }}
          >
            <motion.div
              className="fixed"
              initial={false}
              animate={
                expanded
                  ? { top: 0, left: 0, width: "100vw", height: "100vh" }
                  : { top: origin!.top, left: origin!.left, width: origin!.width, height: origin!.height }
              }
              transition={{ duration: 0.85, ease: EASE }}
              style={{ borderRadius: expanded ? 0 : 20 }}
            >
              <div className="flex h-full w-full items-center justify-center bg-background">
                <motion.div
                  animate={{ opacity: expanded ? 1 : 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="h-full w-full max-w-none sm:h-[94vh] sm:w-auto sm:aspect-[9/18]"
                >
                  <DeviceFrame className="h-full w-full max-w-none [&>div]:rounded-none sm:[&>div]:rounded-[46px]">
                    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-background to-card px-8 text-center">
                      <motion.div
                        animate={{ opacity: [0.35, 0.85, 0.35] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-success shadow-elevated"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                          <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
                        </svg>
                      </motion.div>
                      <p className="text-[12.5px] font-semibold text-muted-foreground">Getting to know your business…</p>
                    </div>
                  </DeviceFrame>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </RevealContext.Provider>
  );
}
