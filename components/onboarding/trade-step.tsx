"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Wrench, Zap, Paintbrush, Hammer, Home, ArrowRight, type LucideIcon } from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { ONBOARDING_TRADES, ONBOARDING_TRADE_LABELS } from "@/lib/trades";

/**
 * Screen 2 — "What kind of work do you do?" V1 First-Run decision:
 * five trades, not eight, and no "Other" — the best receptionist for
 * five trades beats an average one for fifty (DOCS/SPECS/ReplyFlow-V1-
 * First-Run-Proposal.md). Existing businesses on a trade outside this
 * five are completely unaffected; lib/trades.ts's normalizeTrade still
 * recognises all eight plus a generic fallback.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

const TRADE_ICONS: Record<(typeof ONBOARDING_TRADES)[number], LucideIcon> = {
  plumbing: Wrench,
  electrical: Zap,
  painting: Paintbrush,
  building: Hammer,
  roofing: Home,
};

const TRADE_CARDS = ONBOARDING_TRADES.map((value) => ({
  value,
  label: ONBOARDING_TRADE_LABELS[value],
  icon: TRADE_ICONS[value],
}));

export function TradeStep() {
  const router = useRouter();
  const setField = useOnboardingStore((s) => s.setField);
  const storedTrade = useOnboardingStore((s) => s.trade);

  const [selected, setSelected] = useState<string | null>(null);

  // Re-hydrate a previous choice if the user came back to this screen.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !storedTrade) return;
    hydratedRef.current = true;
    if (TRADE_CARDS.some((t) => t.value === storedTrade)) setSelected(storedTrade);
  }, [storedTrade]);

  const canContinue = selected !== null;

  function next() {
    if (!canContinue || !selected) return;
    setField("trade", selected);
    router.push("/onboarding/service-area");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-3xl border border-border bg-card p-9 shadow-elevated sm:p-10"
    >
      <h1 className="mb-8 text-[24px] font-extrabold leading-tight tracking-tight">
        What kind of work do you do?
      </h1>

      <div className="mb-6 grid grid-cols-3 gap-2.5">
        {TRADE_CARDS.map((card, i) => {
          const isSelected = selected === card.value;
          return (
            <motion.button
              key={card.value}
              type="button"
              onClick={() => setSelected(card.value)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.08 + i * 0.05 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              aria-pressed={isSelected}
              className={
                "flex flex-col items-center gap-2.5 rounded-2xl border-2 p-4 transition-colors duration-200 " +
                (isSelected
                  ? "border-primary bg-accent shadow-[0_10px_28px_-12px_rgba(37,99,235,0.4)]"
                  : "border-border bg-background hover:border-muted-foreground/30")
              }
            >
              <span
                className={
                  "flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 " +
                  (isSelected ? "bg-primary text-primary-foreground" : "bg-accent text-primary")
                }
              >
                <card.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[12.5px] font-semibold leading-none">{card.label}</span>
            </motion.button>
          );
        })}
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
