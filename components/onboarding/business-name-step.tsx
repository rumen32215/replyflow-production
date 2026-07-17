"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";

/**
 * Screen 3 — one question, nothing else. The title reacts to typing:
 * the moment a name exists it becomes "Nice to meet you, {name}." so
 * the screen feels like a conversation, not a form field.
 *
 * The name lives in the onboarding store (persisted to localStorage),
 * picked up again by the preparing step when the businesses row is
 * created.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function BusinessNameStep() {
  const router = useRouter();
  const storedName = useOnboardingStore((s) => s.businessName);
  const setField = useOnboardingStore((s) => s.setField);

  // Zustand's persist hydrates from localStorage after mount — keep a
  // local mirror so the input is responsive and SSR-safe.
  const [name, setName] = useState("");
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (storedName) setName(storedName);
  }, [storedName]);

  const trimmed = name.trim();
  const hasName = trimmed.length >= 2;

  function update(value: string) {
    setName(value);
    setField("businessName", value);
  }

  function next() {
    if (!hasName) return;
    router.push("/onboarding/trade");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-3xl border border-border bg-card p-9 shadow-elevated sm:p-10"
    >
      <div className="mb-8 min-h-[68px]">
        <AnimatePresence mode="wait" initial={false}>
          {hasName ? (
            <motion.h1
              key="greeting"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="text-[24px] font-extrabold leading-tight tracking-tight"
            >
              Nice to meet you,{" "}
              <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                {trimmed}
              </span>
              .
            </motion.h1>
          ) : (
            <motion.h1
              key="question"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="text-[24px] font-extrabold leading-tight tracking-tight"
            >
              What should I call your business?
            </motion.h1>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        whileFocus={{ scale: 1.01 }}
        className="group relative mb-8"
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => update(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && next()}
          placeholder="Acme Services"
          maxLength={80}
          aria-label="Business name"
          className="h-16 w-full rounded-2xl border-2 border-border bg-background px-5 text-[19px] font-semibold tracking-tight outline-none transition-all duration-300 placeholder:font-normal placeholder:text-muted-foreground/40 focus:border-primary focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08),0_12px_32px_-12px_rgba(37,99,235,0.25)]"
        />
      </motion.div>

      <motion.button
        type="button"
        onClick={next}
        disabled={!hasName}
        whileHover={hasName ? { y: -2 } : undefined}
        whileTap={hasName ? { scale: 0.985 } : undefined}
        transition={{ type: "spring", stiffness: 400, damping: 24 }}
        animate={{ opacity: hasName ? 1 : 0.45 }}
        className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-sm transition-shadow duration-300 enabled:hover:shadow-[0_10px_30px_-8px_rgba(37,99,235,0.55)] disabled:cursor-not-allowed"
      >
        Continue
        <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-out group-enabled:group-hover:translate-x-1" />
      </motion.button>
    </motion.div>
  );
}
