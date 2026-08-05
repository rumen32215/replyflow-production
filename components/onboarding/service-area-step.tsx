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
 * The last pre-account question — where do you work? Hours and days
 * are real facts too, but asking for them as a third equal-weight
 * field would make this feel like a form again (Employment Philosophy
 * v16 §3.2). So they're stated as a default she'll assume ("Open
 * weekdays, 8am till 5:30pm") with a plain-language correction, not a
 * grid the owner has to fill in — the existing day-grid and time
 * pickers still exist, just disclosed on request instead of always on
 * screen. Area stays the one always-visible input.
 *
 * `openDays`/`openingTime`/`closingTime` already write to the store
 * live (toggleDay and the time inputs' onChange), same as the area
 * text — so `receptionist-presence.tsx`, which reads the store
 * directly, always sees the true current state, default or corrected.
 */

function formatTime12h(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return mStr === "00" ? `${h12}${period}` : `${h12}:${mStr}${period}`;
}

function formatDaysLabel(days: string[]): string {
  const set = new Set(days);
  const weekdays: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];
  if (days.length === 5 && weekdays.every((d) => set.has(d))) return "weekdays";
  if (days.length === 7) return "every day";
  if (days.length === 0) return "no days yet";
  return days
    .slice()
    .sort((a, b) => DAY_KEYS.indexOf(a as DayKey) - DAY_KEYS.indexOf(b as DayKey))
    .map((d) => DAY_LABELS[d as DayKey])
    .join(", ");
}

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
  const [showHours, setShowHours] = useState(false);

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

  function updateOpening(value: string) {
    setOpening(value);
    setField("openingTime", value);
  }

  function updateClosing(value: string) {
    setClosing(value);
    setField("closingTime", value);
  }

  function next() {
    if (!canContinue) return;
    router.push("/signup");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-3xl border border-border bg-card p-9 shadow-elevated sm:p-10"
    >
      <h1 className="mb-8 text-[24px] font-extrabold leading-tight tracking-tight">
        Where do you <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">work</span>?
      </h1>

      {/* A self-contained "location slot" — an ambient, almost-imperceptible
          map feeling (soft breathing glow + layered contour lines, never a
          literal map) signals "this is where she learns where you work"
          — the same card is where an interactive one could land later
          without reshaping this screen. */}
      <div className="relative mb-5 overflow-hidden rounded-2xl border border-border/70 bg-background/40 p-4">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full blur-2xl"
          style={{ background: "radial-gradient(circle, rgba(34,197,94,0.18), transparent 70%)" }}
          animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-radial-gradient(circle at 88% 6%, rgba(34,197,94,0.10) 0px, rgba(34,197,94,0.10) 1px, transparent 1px, transparent 18px), repeating-radial-gradient(circle at 10% 100%, rgba(37,99,235,0.05) 0px, rgba(37,99,235,0.05) 1px, transparent 1px, transparent 26px)",
          }}
        />
        <span className="relative z-10 mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground/80">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          Service area
        </span>
        <motion.div whileFocus={{ scale: 1.01 }} className="group relative z-10">
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

      <div className="mb-8 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
        <p className="text-[13.5px] font-medium text-muted-foreground">
          Open {formatDaysLabel(days)}, {formatTime12h(opening)} till {formatTime12h(closing)} — tell me if that&apos;s wrong.
        </p>
        <button
          type="button"
          onClick={() => setShowHours((v) => !v)}
          className="shrink-0 text-[13px] font-semibold text-primary hover:underline"
        >
          {showHours ? "Done" : "Change"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showHours && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mb-6">
              <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                Days open
              </span>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {DAY_KEYS.map((day) => {
                  const on = days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      aria-pressed={on}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border-2 bg-background py-3 text-[12.5px] font-semibold transition-colors duration-300",
                        on
                          ? "border-success text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/30"
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
                            className="text-success"
                          >
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </motion.span>
                        ) : (
                          <span className="h-3 w-3" aria-hidden />
                        )}
                      </AnimatePresence>
                      {DAY_LABELS[day].slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-2">
              <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                Hours
              </span>
              <div className="flex items-center gap-3">
                <label className="flex-1">
                  <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">Opens</span>
                  <input
                    type="time"
                    value={opening}
                    onChange={(e) => updateOpening(e.target.value)}
                    aria-label="Opening time"
                    className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[15px] font-semibold outline-none transition-all duration-300 focus:border-success focus:shadow-[0_0_0_3px_rgba(34,197,94,0.10)]"
                  />
                </label>
                <span className="mt-5 text-muted-foreground">–</span>
                <label className="flex-1">
                  <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">Closes</span>
                  <input
                    type="time"
                    value={closing}
                    onChange={(e) => updateClosing(e.target.value)}
                    aria-label="Closing time"
                    className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[15px] font-semibold outline-none transition-all duration-300 focus:border-success focus:shadow-[0_0_0_3px_rgba(34,197,94,0.10)]"
                  />
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={showHours ? "mt-6" : undefined}>
        <OnboardingCTA onClick={next} disabled={!canContinue}>
          She&apos;s got what she needs
        </OnboardingCTA>
      </div>
    </motion.div>
  );
}
