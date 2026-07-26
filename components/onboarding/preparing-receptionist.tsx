"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { OnboardingCTA } from "@/components/onboarding/onboarding-cta";
import { EASE, Reveal, GrowingCheck } from "@/components/shared/motion";
import { PhonePreview, type PreviewTurn } from "@/components/shared/phone-preview";
import { ONBOARDING_TRADE_LABELS, type ONBOARDING_TRADES } from "@/lib/trades";
import { DAY_KEYS, DAY_LABELS } from "@/lib/availability";

/**
 * Screen 5 — the emotional payoff before Meet Your Receptionist (RC4).
 *
 * Two genuinely different things happen here, and neither one fakes a
 * delay:
 *
 *  1. The real POST to /api/onboarding/prepare creates the business
 *     row. The brief "Setting up your receptionist" moment lasts
 *     exactly as long as that real request takes — nothing scripted.
 *
 *  2. Once that row exists, this calls the exact same real reasoning
 *     pipeline production uses (lib/reply-engine/live-reply.ts, via
 *     /api/receptionist/live-reply — the same route and function
 *     Receptionist's own live coaching preview calls) with three
 *     genuine customer questions built from what was just entered.
 *     This is proof, not a scripted demo: there is still only one
 *     receptionist, one brain, one conversation engine — this screen
 *     is a new caller of it, not a second, faked one.
 *
 * The only fixed timing left (TYPE_SETTLE_MS) is how long the final
 * reply's existing type-out effect (borrowed unchanged from
 * PhonePreview, already used elsewhere) is given to finish before the
 * closing line appears — a choreography beat for content that has
 * already arrived, not a wait for something to happen. Advancing to
 * Meet Your Receptionist is always an explicit tap, never a timer, so
 * nothing about pacing is invented on the owner's behalf.
 */

const TYPE_SETTLE_MS = 2400;

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

async function fetchDemoReply(message: string): Promise<string | null> {
  try {
    const res = await fetch("/api/receptionist/live-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioMessage: message,
        tone: "friendly",
        behaviours: "",
        businessRules: "",
        escalationRules: "",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.replyText === "string" && data.replyText.trim() ? data.replyText : null;
  } catch {
    return null;
  }
}

export function PreparingReceptionist() {
  const router = useRouter();
  const businessName = useOnboardingStore((s) => s.businessName);
  const trade = useOnboardingStore((s) => s.trade);
  const serviceArea = useOnboardingStore((s) => s.serviceArea);
  const openDays = useOnboardingStore((s) => s.openDays);
  const openingTime = useOnboardingStore((s) => s.openingTime);
  const closingTime = useOnboardingStore((s) => s.closingTime);
  const resetStore = useOnboardingStore((s) => s.reset);

  const [stage, setStage] = useState<"working" | "proof" | "ready" | "failed">("working");
  const [turns, setTurns] = useState<PreviewTurn[]>([]);
  const [liveReply, setLiveReply] = useState("");
  const startedRef = useRef(false);

  const tradeLabel = ONBOARDING_TRADE_LABELS[trade as (typeof ONBOARDING_TRADES)[number]] ?? trade;

  const facts = [
    { label: "Business name", value: businessName },
    { label: "Trade", value: tradeLabel },
    { label: "Service area", value: serviceArea },
    { label: "Opening days", value: describeOpenDaysRange(openDays) },
    { label: "Opening hours", value: `${openingTime}–${closingTime}` },
  ];

  async function runProofConversation() {
    const demoMessages = [
      "Hi, are you free tomorrow?",
      `Do you cover ${serviceArea}?`,
      `Are you a ${tradeLabel.toLowerCase()}?`,
    ];
    // Fired together so the total wait is roughly one call's latency,
    // not the sum of three — but revealed in order, so the thread
    // always reads as one natural conversation.
    const pending = demoMessages.map((message) => ({ message, promise: fetchDemoReply(message) }));

    const committed: PreviewTurn[] = [];
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      if (!item) continue;

      committed.push({ from: "customer", text: item.message });
      setTurns([...committed]);
      setLiveReply("");

      const reply = await item.promise;
      if (!reply) break; // a real hiccup — never let a nice-to-have block reaching Meet

      if (i < pending.length - 1) {
        committed.push({ from: "receptionist", text: reply });
        setTurns([...committed]);
      } else {
        setLiveReply(reply);
        await new Promise((resolve) => setTimeout(resolve, TYPE_SETTLE_MS));
      }
    }
    setStage("ready");
  }

  async function provision() {
    setStage("working");
    try {
      const res = await fetch("/api/onboarding/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          trade: trade.trim(),
          serviceArea: serviceArea.trim(),
          openDays,
          openingTime,
          closingTime,
        }),
      });
      if (!res.ok) throw new Error("prepare_failed");
      setStage("proof");
      void runProofConversation();
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
    resetStore(); // onboarding is over — clear the persisted draft
    router.replace("/dashboard/receptionist/meet");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-3xl border border-border bg-card p-9 shadow-elevated sm:p-10"
    >
      <AnimatePresence mode="wait">
        {stage === "working" && (
          <motion.div
            key="working"
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex min-h-[300px] flex-col items-center justify-center text-center"
          >
            <div className="relative mb-7 h-14 w-14">
              <motion.div
                aria-hidden
                animate={{ opacity: [0.35, 0.7, 0.35] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary to-success blur-lg"
              />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-success shadow-elevated">
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
                  <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
                </svg>
              </div>
            </div>
            <p className="text-[16.5px] font-semibold tracking-tight text-foreground">
              Setting up your receptionist
            </p>
          </motion.div>
        )}

        {(stage === "proof" || stage === "ready") && (
          <motion.div
            key="proof"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <h1 className="mb-5 text-[16px] font-bold tracking-tight text-foreground/85">
              What I&apos;ve already learned
            </h1>

            <div className="mb-6 space-y-2.5">
              {facts.map((fact, i) => (
                <Reveal key={fact.label} index={i} className="flex items-center gap-2.5 text-[13.5px]">
                  <span aria-hidden>
                    <GrowingCheck className="h-4 w-4 shrink-0" />
                  </span>
                  <span className="text-muted-foreground">{fact.label}:</span>
                  <span className="font-semibold text-foreground">{fact.value}</span>
                </Reveal>
              ))}
            </div>

            <PhonePreview businessName={businessName || "Your business"} turns={turns} liveReply={liveReply} />

            <AnimatePresence>
              {stage === "ready" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="mt-6"
                >
                  <p className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-foreground">
                    <span aria-hidden>
                      <GrowingCheck className="h-4 w-4" />
                    </span>
                    Receptionist ready.
                  </p>
                  <OnboardingCTA onClick={enterReceptionist}>Meet your receptionist</OnboardingCTA>
                </motion.div>
              )}
            </AnimatePresence>
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
