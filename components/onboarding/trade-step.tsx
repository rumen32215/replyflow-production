"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wrench,
  Zap,
  Trees,
  Hammer,
  Sparkles,
  Flame,
  Home,
  Paintbrush,
  MoreHorizontal,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";

/**
 * Screen 4 — "What kind of work do you do?" Nine large cards, staggered
 * in, one tap to select. "Other" reveals a small animated input.
 *
 * Stored values deliberately line up with the slugs the schema and
 * dashboard already know (plumbing / electrical / roofing / landscaping
 * from lib/constants.ts TRADES); the new ones are plain lowercase
 * words — the `trade` column is free text with a default, so nothing
 * schema-side changes.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

const TRADE_CARDS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "plumbing", label: "Plumber", icon: Wrench },
  { value: "electrical", label: "Electrician", icon: Zap },
  { value: "landscaping", label: "Landscaper", icon: Trees },
  { value: "building", label: "Builder", icon: Hammer },
  { value: "cleaning", label: "Cleaning", icon: Sparkles },
  { value: "heating", label: "Heating", icon: Flame },
  { value: "roofing", label: "Roofing", icon: Home },
  { value: "painting", label: "Painter", icon: Paintbrush },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

export function TradeStep() {
  const router = useRouter();
  const setField = useOnboardingStore((s) => s.setField);
  const storedTrade = useOnboardingStore((s) => s.trade);

  const [selected, setSelected] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const otherInputRef = useRef<HTMLInputElement>(null);

  // Re-hydrate a previous choice if the user came back to this screen.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !storedTrade) return;
    hydratedRef.current = true;
    const known = TRADE_CARDS.some((t) => t.value === storedTrade && t.value !== "other");
    if (known) {
      setSelected(storedTrade);
    } else if (storedTrade !== "plumbing") {
      setSelected("other");
      setOtherText(storedTrade);
    }
  }, [storedTrade]);

  // Focus the "Other" input the moment it finishes animating in.
  useEffect(() => {
    if (selected !== "other") return;
    const t = setTimeout(() => otherInputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [selected]);

  const otherTrimmed = otherText.trim();
  const canContinue = selected !== null && (selected !== "other" || otherTrimmed.length >= 2);

  function next() {
    if (!canContinue || !selected) return;
    const trade = selected === "other" ? otherTrimmed.toLowerCase() : selected;
    setField("trade", trade);
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

      <AnimatePresence>
        {selected === "other" && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <input
              ref={otherInputRef}
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && next()}
              placeholder="Tell me your trade"
              maxLength={60}
              aria-label="Your trade"
              className="h-14 w-full rounded-2xl border-2 border-border bg-background px-5 text-[16px] font-semibold tracking-tight outline-none transition-all duration-300 placeholder:font-normal placeholder:text-muted-foreground/40 focus:border-primary focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08),0_12px_32px_-12px_rgba(37,99,235,0.25)]"
            />
          </motion.div>
        )}
      </AnimatePresence>

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
