"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { GentleSwap, EASE } from "@/components/shared/motion";
import { ONBOARDING_TRADE_LABELS, type ONBOARDING_TRADES } from "@/lib/trades";

/**
 * Employment Philosophy v16 §4.1–2: every real answer is acknowledged,
 * specifically, as her — not a checkmark confirming the click
 * registered. Lives in the shared layout for the three real-question
 * routes, so it's the same non-remounted instance across all three
 * (the layout's own tree persists across a route-segment swap; only
 * this component's *content* changes per pathname) — one presence
 * getting to know the owner, not three independent widgets that
 * happen to look alike. Full acknowledgment here is correct, not a
 * v16 §5 violation: this is day one, the newest the relationship ever
 * is, and §5's decay curve governs the *rest* of the product over
 * months, not this five-minute window.
 *
 * Reads the store directly rather than a prop passed down from the
 * step pages — this component is a sibling of `children` inside the
 * layout, not their parent, so a controlled prop would need new
 * Context plumbing for no benefit the store doesn't already provide.
 */
export function ReceptionistPresence() {
  const pathname = usePathname();
  const businessName = useOnboardingStore((s) => s.businessName);
  const trade = useOnboardingStore((s) => s.trade);
  const serviceArea = useOnboardingStore((s) => s.serviceArea);
  const openingTime = useOnboardingStore((s) => s.openingTime);
  const closingTime = useOnboardingStore((s) => s.closingTime);
  const openDays = useOnboardingStore((s) => s.openDays);

  let reaction: string | null = null;
  if (pathname === "/hire/name" && businessName.trim().length >= 2) {
    reaction = "Business learned.";
  } else if (pathname === "/hire/trade" && trade) {
    const label = (ONBOARDING_TRADE_LABELS[trade as (typeof ONBOARDING_TRADES)[number]] ?? trade).toLowerCase();
    reaction = `Trade understood — I'll sound like a ${label}, not a call centre.`;
  } else if (
    pathname === "/hire/area" &&
    serviceArea.trim().length >= 2 &&
    openingTime < closingTime &&
    openDays.length > 0
  ) {
    reaction = "Availability remembered. Service area mapped.";
  }

  return (
    <div className="mb-5 flex min-h-[22px] items-center gap-2" aria-live="polite">
      <motion.span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-success"
        animate={{ opacity: reaction ? 1 : 0.3 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
          <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
        </svg>
      </motion.span>
      <GentleSwap swapKey={reaction ?? "idle"} className="text-[13px] font-medium text-muted-foreground">
        {reaction}
      </GentleSwap>
    </div>
  );
}
