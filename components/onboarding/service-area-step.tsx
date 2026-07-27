"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, MapPin } from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { DAY_KEYS, DAY_LABELS, type DayKey } from "@/lib/availability";
import { OnboardingCTA } from "@/components/onboarding/onboarding-cta";
import { EASE, press } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

/**
 * Screen 4 — opening days, opening hours, and service area, together on
 * one screen. These were two separate steps; merged so the last stretch
 * of the one-minute setup keeps its momentum instead of asking for one
 * more click. Kept genuinely simple for V1: a single free-text area and
 * one open/close time applied to whichever days are toggled on — the
 * fuller multi-area, per-day editor stays Booking Rules' job later.
 *
 * RC4: days now lead (the owner is teaching availability, and days
 * naturally come before hours), the heading is a quiet section label
 * rather than a dominant hero line so the controls read as the focus,
 * and the service area lives in its own bordered "slot" — no map
 * today, but a natural place for one later without restructuring.
 */

export function ServiceAreaStep() {
  const router = useRouter();
  const storedArea = useOnboardingStore((s) => s.serviceArea);
  const storedDays = useOnboardingStore((s) => s.openDays);
  const storedOpening = useOnboardingStore((s) => s.openingTime);
  const storedClosing = useOnboardingStore((s) => s.closingTime);
  const setField = useOnboardingStore((s) => s.setField);
  const setOpenDays = useOnboardingStore((s) => s.setOpenDays);

  const [area, setArea] = useState("");
  const [days, setDays] = useState<string[]>(storedDays);
  const [opening, setOpening] = useState(storedOpening);
  const [closing, setClosing] = useState(storedClosing);

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (storedArea) setArea(storedArea);
    setDays(storedDays);
    setOpening(storedOpening);
    setClosing(storedClosing);
  }, [storedArea, storedDays, storedOpening, storedClosing]);

  const trimmedArea = area.trim();
  const hasArea = trimmedArea.length >= 2;
  const canContinue = hasArea && days.length > 0 && opening < closing;

  function updateArea(value: string) {
    setArea(value);
    setField("serviceArea", value);
  }

  function toggleDay(day: DayKey) {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    setDays(next);
    setOpenDays(next);
  }

  function next() {
    if (!canContinue) return;
    setField("openingTime", opening);
    setField("closingTime", closing);
    router.push("/onboarding/preparing");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-3xl border border-border bg-card p-9 shadow-elevated sm:p-10"
    >
      <h1 className="mb-6 text-[16px] font-bold tracking-tight text-foreground/85">
        A little about how you work
      </h1>

      <div className="mb-6">
        <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-wide text-muted-foreground/80">
          Days open
        </span>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {DAY_KEYS.map((day, i) => {
            const on = days.includes(day);
            return (
              <motion.button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE, delay: 0.05 + i * 0.04 }}
                whileTap={{ ...press.whileTap, transition: press.transition }}
                aria-pressed={on}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-[12.5px] font-semibold transition-colors duration-300",
                  on
                    ? "border-success bg-success/10 text-success"
                    : "border-border bg-background text-muted-foreground hover:border-muted-foreground/30"
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {on ? (
                    <motion.span
                      key="on"
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 26 }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </motion.span>
                  ) : (
                    <span className="h-3 w-3" aria-hidden />
                  )}
                </AnimatePresence>
                {DAY_LABELS[day].slice(0, 3)}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="mb-7">
        <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-wide text-muted-foreground/80">
          Hours
        </span>
        <div className="flex items-center gap-3">
          <label className="flex-1">
            <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">Opens</span>
            <input
              type="time"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              aria-label="Opening time"
              className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[15px] font-semibold outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08),0_12px_32px_-12px_rgba(37,99,235,0.25)]"
            />
          </label>
          <span className="mt-5 text-muted-foreground">–</span>
          <label className="flex-1">
            <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">Closes</span>
            <input
              type="time"
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
              aria-label="Closing time"
              className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[15px] font-semibold outline-none transition-all duration-300 focus:border-primary focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08),0_12px_32px_-12px_rgba(37,99,235,0.25)]"
            />
          </label>
        </div>
      </div>

      {/* A self-contained "location slot" — a faint contour-line texture
          (the same inline-gradient technique PhoneFrame already uses)
          signals "this is where she learns where you work" without a
          real map — the same card is where an interactive one could
          land later without reshaping this screen. */}
      <div
        className="mb-8 overflow-hidden rounded-2xl border border-border/70 bg-background/40 p-4"
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at 90% 8%, rgba(37,99,235,0.06) 0px, rgba(37,99,235,0.06) 1px, transparent 1px, transparent 16px)",
        }}
      >
        <span className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground/80">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          Service area
        </span>
        <motion.div whileFocus={{ scale: 1.01 }} className="group relative">
          <input
            autoFocus
            value={area}
            onChange={(e) => updateArea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && next()}
            placeholder="e.g. Manchester, or SW London"
            maxLength={80}
            aria-label="Service area"
            className="h-14 w-full rounded-xl border-2 border-border bg-card px-4 text-[16px] font-semibold tracking-tight outline-none transition-all duration-300 placeholder:font-normal placeholder:text-muted-foreground/40 focus:border-primary focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08),0_12px_32px_-12px_rgba(37,99,235,0.25)]"
          />
        </motion.div>
      </div>

      <OnboardingCTA onClick={next} disabled={!canContinue}>
        Continue
      </OnboardingCTA>
    </motion.div>
  );
}
