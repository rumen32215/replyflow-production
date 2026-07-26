"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";

/**
 * Screen 3 — "Where do you cover?" One question, one field, kept
 * genuinely simple for V1: a single free-text answer ("Manchester",
 * "SW London"), not the fuller multi-area chip editor — that's
 * Teach's job later, once there's real value to build on. This is
 * only ever asked because she needs it to say anything real in "Meet
 * your receptionist" (DOCS/SPECS/ReplyFlow-V1-First-Run-Proposal.md).
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function ServiceAreaStep() {
  const router = useRouter();
  const storedArea = useOnboardingStore((s) => s.serviceArea);
  const setField = useOnboardingStore((s) => s.setField);

  const [area, setArea] = useState("");
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (storedArea) setArea(storedArea);
  }, [storedArea]);

  const trimmed = area.trim();
  const hasArea = trimmed.length >= 2;

  function update(value: string) {
    setArea(value);
    setField("serviceArea", value);
  }

  function next() {
    if (!hasArea) return;
    router.push("/onboarding/hours");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-3xl border border-border bg-card p-9 shadow-elevated sm:p-10"
    >
      <h1 className="mb-8 text-[24px] font-extrabold leading-tight tracking-tight">Where do you cover?</h1>

      <motion.div whileFocus={{ scale: 1.01 }} className="group relative mb-8">
        <input
          autoFocus
          value={area}
          onChange={(e) => update(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && next()}
          placeholder="e.g. Manchester, or SW London"
          maxLength={80}
          aria-label="Service area"
          className="h-16 w-full rounded-2xl border-2 border-border bg-background px-5 text-[19px] font-semibold tracking-tight outline-none transition-all duration-300 placeholder:font-normal placeholder:text-muted-foreground/40 focus:border-primary focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08),0_12px_32px_-12px_rgba(37,99,235,0.25)]"
        />
      </motion.div>

      <motion.button
        type="button"
        onClick={next}
        disabled={!hasArea}
        whileHover={hasArea ? { y: -2 } : undefined}
        whileTap={hasArea ? { scale: 0.985 } : undefined}
        transition={{ type: "spring", stiffness: 400, damping: 24 }}
        animate={{ opacity: hasArea ? 1 : 0.45 }}
        className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-sm transition-shadow duration-300 enabled:hover:shadow-[0_10px_30px_-8px_rgba(37,99,235,0.55)] disabled:cursor-not-allowed"
      >
        Continue
        <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-enabled:group-hover:translate-x-1" />
      </motion.button>
    </motion.div>
  );
}
