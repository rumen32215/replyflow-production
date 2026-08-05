"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Wrench, Zap, Paintbrush, Hammer, Home, type LucideIcon } from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { ONBOARDING_TRADES, ONBOARDING_TRADE_LABELS } from "@/lib/trades";
import { EASE, press, GrowingCheck } from "@/components/shared/motion";
import { GradientText } from "@/components/shared/gradient-text";
import { TypingDots } from "@/components/shared/typed-message";

/**
 * "What kind of work do you do?" V1 First-Run decision: five trades,
 * not eight, and no "Other" — the best receptionist for five trades
 * beats an average one for fifty (DOCS/SPECS/ReplyFlow-V1-First-Run-
 * Proposal.md). Existing businesses on a trade outside this five are
 * completely unaffected; lib/trades.ts's normalizeTrade still
 * recognises all eight plus a generic fallback.
 *
 * No Continue button (Employment Philosophy v16 §3.4, `DOCS/CONSTITUTION/
 * 15...md` §5) — a single tap is already a complete decision, so the
 * card highlighting, the receptionist presence reacting, and the
 * screen advancing all happen off the same tap rather than asking for
 * a second click to confirm what's already been decided. The store
 * write happens immediately on selection, not inside a `next()`
 * handler that no longer exists — `receptionist-presence.tsx` reads
 * the store directly and needs the value live to react in time.
 */

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

/** Long enough for the selection highlight and the receptionist's
 * reaction to both register before the screen moves on — not an
 * arbitrary pause, the same "let the acknowledgment land before
 * advancing" beat this codebase already uses elsewhere. */
const ADVANCE_DELAY_MS = 550;

export function TradeStep() {
  const router = useRouter();
  const setField = useOnboardingStore((s) => s.setField);
  const storedTrade = useOnboardingStore((s) => s.trade);

  const [selected, setSelected] = useState<string | null>(null);
  const advancingRef = useRef(false);

  // Re-hydrate a previous choice if the user came back to this screen.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !storedTrade) return;
    hydratedRef.current = true;
    if (TRADE_CARDS.some((t) => t.value === storedTrade)) setSelected(storedTrade);
  }, [storedTrade]);

  function selectTrade(value: string) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setSelected(value);
    setField("trade", value);
    setTimeout(() => router.push("/hire/area"), ADVANCE_DELAY_MS);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-3xl border border-border bg-card p-9 shadow-elevated sm:p-10"
    >
      <h1 className="mb-8 text-[24px] font-extrabold leading-tight tracking-tight">
        What&apos;s your <GradientText>trade</GradientText>?
      </h1>

      <div className="mb-6 grid grid-cols-3 gap-2.5">
        {TRADE_CARDS.map((card, i) => {
          const isSelected = selected === card.value;
          return (
            <motion.button
              key={card.value}
              type="button"
              onClick={() => selectTrade(card.value)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.08 + i * 0.05 }}
              whileHover={{ y: -3 }}
              whileTap={{ ...press.whileTap, transition: press.transition }}
              aria-pressed={isSelected}
              className={
                "relative flex flex-col items-center gap-2.5 rounded-2xl border-2 p-4 transition-colors duration-200 " +
                (isSelected
                  ? "border-primary bg-accent shadow-[0_10px_28px_-12px_rgba(37,99,235,0.4)]"
                  : "border-border bg-background hover:border-muted-foreground/30")
              }
            >
              {isSelected && <GrowingCheck className="absolute -right-1.5 -top-1.5 h-5 w-5 shadow-sm" />}
              <span
                className={
                  "flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 " +
                  (isSelected ? "bg-success text-success-foreground" : "bg-accent text-primary")
                }
              >
                <card.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[12.5px] font-semibold leading-none">{card.label}</span>
            </motion.button>
          );
        })}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.08 + TRADE_CARDS.length * 0.05 }}
          aria-disabled="true"
          title="More trades coming soon"
          className="flex cursor-not-allowed flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-border/70 bg-background/40 p-4 opacity-55"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50 text-muted-foreground">
            <TypingDots dotClassName="bg-success/60" />
          </span>
          <span className="text-center text-[11px] font-semibold leading-tight text-muted-foreground">
            More soon
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}
