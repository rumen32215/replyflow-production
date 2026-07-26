"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { DAY_KEYS, DAY_LABELS, type DayKey } from "@/lib/availability";
import { cn } from "@/lib/utils";

/**
 * Screen 4 — "When are you open?" The last of the one-minute setup's
 * five facts. Kept genuinely simple: one open/close time applied to
 * whichever days are toggled on, not per-day customisation — that
 * stays Booking Rules' job (already praised as the page that "already
 * does everything the redesign asked for"). This just seeds it.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function HoursStep() {
  const router = useRouter();
  const storedDays = useOnboardingStore((s) => s.openDays);
  const storedOpening = useOnboardingStore((s) => s.openingTime);
  const storedClosing = useOnboardingStore((s) => s.closingTime);
  const setField = useOnboardingStore((s) => s.setField);
  const setOpenDays = useOnboardingStore((s) => s.setOpenDays);

  const [days, setDays] = useState<string[]>(storedDays);
  const [opening, setOpening] = useState(storedOpening);
  const [closing, setClosing] = useState(storedClosing);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    setDays(storedDays);
    setOpening(storedOpening);
    setClosing(storedClosing);
  }, [storedDays, storedOpening, storedClosing]);

  function toggleDay(day: DayKey) {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    setDays(next);
    setOpenDays(next);
  }

  const canContinue = days.length > 0 && opening < closing;

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
      <h1 className="mb-8 text-[24px] font-extrabold leading-tight tracking-tight">When are you open?</h1>

      <div className="mb-6 grid grid-cols-4 gap-2 sm:grid-cols-7">
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
                on ? "border-primary bg-accent text-primary" : "border-border bg-background text-muted-foreground hover:border-muted-foreground/30"
              )}
            >
              {on && <Check className="h-3 w-3" strokeWidth={3} />}
              {DAY_LABELS[day].slice(0, 3)}
            </motion.button>
          );
        })}
      </div>

      <div className="mb-8 flex items-center gap-3">
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

      <motion.button
        type="button"
        onClick={next}
        disabled={!canContinue}
        whileHover={canContinue ? { y: -2 } : undefined}
        whileTap={canContinue ? { scale: 0.985 } : undefined}
        transition={{ type: "spring", stiffness: 400, damping: 24 }}
        animate={{ opacity: canContinue ? 1 : 0.45 }}
        className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-sm transition-shadow duration-300 enabled:hover:shadow-[0_10px_30px_-8px_rgba(37,99,235,0.55)] disabled:cursor-not-allowed"
      >
        Continue
        <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-enabled:group-hover:translate-x-1" />
      </motion.button>
    </motion.div>
  );
}
