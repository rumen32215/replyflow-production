"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { OnboardingCTA } from "@/components/onboarding/onboarding-cta";
import { EASE, GentleSwap, GrowingCheck } from "@/components/shared/motion";
import { ONBOARDING_TRADE_LABELS, type ONBOARDING_TRADES } from "@/lib/trades";
import { DAY_KEYS, DAY_LABELS } from "@/lib/availability";

/**
 * Screen 5 — the first day starts. The real POST to
 * /api/onboarding/prepare creates the business row; this screen's
 * "Getting to know {businessName}" caption lasts exactly as long as
 * that real request takes, nothing scripted. There is no rehearsed
 * conversation here (Employment Philosophy v16 §3.5) — the first
 * exchange it has is a real one, on Meet Your Receptionist, with a
 * real customer message the owner types themselves. This screen's job
 * is only to show what's already known, then get out of the way.
 */

const FACT_GROUP_DWELL_MS = 2100;

function describeOpenDaysRange(days: string[]): string {
  const ordered = DAY_KEYS.filter((d) => days.includes(d));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (!first || !last) return "No days set yet";
  if (ordered.length === DAY_KEYS.length) return "Every day";
  const indices = ordered.map((d) => DAY_KEYS.indexOf(d));
  const isContiguous = indices.every((v, i) => i === 0 || v === (indices[i - 1] ?? -Infinity) + 1);
  if (isContiguous) {
    return ordered.length === 1 ? DAY_LABELS[first] : `${DAY_LABELS[first]}–${DAY_LABELS[last]}`;
  }
  return ordered.map((d) => DAY_LABELS[d]).join(", ");
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

/** One learned fact, revealing in a deliberate rhythm — a small pause,
 * the check animates, then the label and value gently fade in after it
 * — rather than everything appearing in the same instant. `delay` is
 * this fact's position within its group's reveal. */
function LearnedFact({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <div className="flex items-center gap-2.5 text-[13.5px]">
      <span aria-hidden>
        <GrowingCheck className="h-4 w-4 shrink-0" delay={delay} />
      </span>
      <motion.span
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.2, duration: 0.4, ease: EASE }}
        className="text-muted-foreground"
      >
        {label}:
      </motion.span>
      <motion.span
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.2, duration: 0.4, ease: EASE }}
        className="font-semibold text-foreground"
      >
        {value}
      </motion.span>
    </div>
  );
}

const PARTICLES = [
  { x: "18%", y: "22%", duration: 4.2, delay: 0 },
  { x: "78%", y: "30%", duration: 5, delay: 1.1 },
  { x: "30%", y: "72%", duration: 4.6, delay: 2.1 },
  { x: "70%", y: "68%", duration: 5.4, delay: 0.6 },
];

export function PreparingReceptionist() {
  const router = useRouter();
  const businessName = useOnboardingStore((s) => s.businessName);
  const trade = useOnboardingStore((s) => s.trade);
  const serviceAreas = useOnboardingStore((s) => s.serviceAreas);
  const openDays = useOnboardingStore((s) => s.openDays);
  const openingTime = useOnboardingStore((s) => s.openingTime);
  const closingTime = useOnboardingStore((s) => s.closingTime);
  const resetStore = useOnboardingStore((s) => s.reset);

  const [stage, setStage] = useState<"working" | "ready" | "failed">("working");
  const [factGroupIndex, setFactGroupIndex] = useState(0);
  const startedRef = useRef(false);

  const tradeLabel = ONBOARDING_TRADE_LABELS[trade as (typeof ONBOARDING_TRADES)[number]] ?? trade;

  const facts = [
    { label: "Business name", value: businessName },
    { label: "Trade", value: tradeLabel },
    { label: "Service area", value: serviceAreas.join(", ") },
    { label: "Opening days", value: describeOpenDaysRange(openDays) },
    { label: "Opening hours", value: `${openingTime}–${closingTime}` },
  ];
  const factGroups = chunk(facts, 2);

  // Presented two at a time, in a deliberate rhythm, rather than all
  // five simultaneously — assembling knowledge, not a checklist.
  // Settles on the final group and stops, it doesn't loop.
  useEffect(() => {
    if (factGroupIndex >= factGroups.length - 1) return;
    const t = setTimeout(() => setFactGroupIndex((i) => i + 1), FACT_GROUP_DWELL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factGroupIndex]);

  async function provision() {
    setStage("working");
    try {
      const res = await fetch("/api/onboarding/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          trade: trade.trim(),
          serviceAreas,
          openDays,
          openingTime,
          closingTime,
        }),
      });
      if (!res.ok) throw new Error("prepare_failed");
      setStage("ready");
    } catch {
      setStage("failed");
    }
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void provision();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enterReceptionist() {
    resetStore(); // the first day has started — clear the persisted draft
    router.replace("/dashboard/receptionist/meet");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-3xl border border-border bg-card p-9 shadow-elevated sm:p-10"
    >
      {stage !== "failed" && (
        <>
          <div className="mb-6">
            <GentleSwap swapKey={stage} className="mb-2 text-[12px] font-semibold text-muted-foreground/80">
              {stage === "working" ? `Getting to know ${businessName || "your business"}` : "I know enough to get started."}
            </GentleSwap>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-success"
                animate={{
                  width: stage === "working" ? "12%" : "100%",
                  opacity: stage === "working" ? [0.55, 1, 0.55] : 1,
                }}
                transition={{
                  width: { duration: 0.6, ease: EASE },
                  opacity:
                    stage === "working"
                      ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.3 },
                }}
              />
            </div>
          </div>

          <h1 className="mb-5 text-[16px] font-bold tracking-tight text-foreground/85">
            What I&apos;ve already learned
          </h1>
          <GentleSwap swapKey={factGroupIndex} className="mb-6 min-h-[54px] space-y-2.5">
            {(factGroups[factGroupIndex] ?? []).map((fact, i) => (
              <LearnedFact key={fact.label} label={fact.label} value={fact.value} delay={0.15 + i * 0.55} />
            ))}
          </GentleSwap>
        </>
      )}

      <AnimatePresence mode="wait">
        {stage === "working" && (
          <motion.div
            key="working"
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="relative flex min-h-[120px] flex-col items-center justify-center overflow-hidden text-center"
          >
            {/* Ambient environment: a very slow light sweep and a few
                tiny drifting particles — anticipation, not a loader. */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -inset-y-10 left-0 w-1/3 -skew-x-12"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(37,99,235,0.05), rgba(34,197,94,0.05), transparent)",
              }}
              animate={{ x: ["-60%", "340%"] }}
              transition={{ duration: 5.5, repeat: Infinity, repeatDelay: 2.6, ease: "easeInOut" }}
            />
            {PARTICLES.map((p, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="pointer-events-none absolute h-1 w-1 rounded-full bg-primary/30"
                style={{ left: p.x, top: p.y }}
                animate={{ opacity: [0, 0.6, 0], y: [0, -16, -26] }}
                transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
              />
            ))}

            <div className="relative h-14 w-14">
              <motion.div
                animate={{ y: [0, -4, 0], scale: [1, 1.035, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="relative h-14 w-14"
              >
                <motion.div
                  aria-hidden
                  animate={{ opacity: [0.35, 0.75, 0.35] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary to-success blur-lg"
                />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-success shadow-elevated">
                  <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
                    <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
                  </svg>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {stage === "ready" && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <p className="mb-4 flex items-center gap-2 text-[17px] font-semibold tracking-tight text-foreground">
              <span aria-hidden>
                <GrowingCheck className="h-4 w-4" />
              </span>
              I know enough to get started.
            </p>
            <OnboardingCTA onClick={enterReceptionist}>Let&apos;s get to work</OnboardingCTA>
          </motion.div>
        )}

        {stage === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex min-h-[300px] w-full flex-col items-center justify-center text-center"
          >
            <p className="mb-2 text-[17px] font-semibold tracking-tight text-foreground">
              That didn&apos;t quite go through.
            </p>
            <p className="mb-7 text-[14px] leading-relaxed text-muted-foreground">
              Nothing&apos;s been lost. Let&apos;s try that again.
            </p>
            <OnboardingCTA onClick={() => void provision()}>Try again</OnboardingCTA>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
