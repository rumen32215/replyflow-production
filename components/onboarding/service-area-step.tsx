"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { DAY_KEYS, DAY_LABELS, type DayKey } from "@/lib/availability";
import { OnboardingCTA } from "@/components/onboarding/onboarding-cta";
import { cn } from "@/lib/utils";

/**
 * Screen 4 — service area, opening days, and opening hours, together on
 * one screen. These were two separate steps; merged so the last stretch
 * of the one-minute setup keeps its momentum instead of asking for one
 * more click. Kept genuinely simple for V1: a single free-text area and
 * one open/close time applied to whichever days are toggled on — the
 * fuller multi-area, per-day editor stays Booking Rules' job later.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

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
      <h1 className="mb-8 text-[24px] font-extrabold leading-tight tracking-tight">
        Where and when can customers reach you?
      </h1>

      <div className="mb-7">
        <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-wide text-muted-foreground/80">
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
            className="h-16 w-full rounded-2xl border-2 border-border bg-background px-5 text-[19px] font-semibold tracking-tight outline-none transition-all duration-300 placeholder:font-normal placeholder:text-muted-foreground/40 focus:border-primary focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08),0_12px_32px_-12px_rgba(37,99,235,0.25)]"
          />
        </motion.div>
      </div>

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
                whileTap={{ scale: 0.95 }}
                aria-pressed={on}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-[12.5px] font-semibold transition-colors duration-200",
                  on
                    ? "border-primary bg-accent text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-muted-foreground/30"
                )}
              >
                {on && <Check className="h-3 w-3" strokeWidth={3} />}
                {DAY_LABELS[day].slice(0, 3)}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
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
              className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[15px] font-semibold outline-none transition-colors focus:border-primary"
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
              className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[15px] font-semibold outline-none transition-colors focus:border-primary"
            />
          </label>
        </div>
      </div>

      <OnboardingCTA onClick={next} disabled={!canContinue}>
        Continue
      </OnboardingCTA>
    </motion.div>
  );
}
