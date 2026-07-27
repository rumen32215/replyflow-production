"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { OnboardingCTA } from "@/components/onboarding/onboarding-cta";
import { EASE, Reveal, GentleSwap, GrowingCheck } from "@/components/shared/motion";
import { PhoneFrame, Bubble, type PreviewTurn } from "@/components/shared/phone-preview";
import { TypingDots, useTypedMessage } from "@/components/shared/typed-message";
import { ONBOARDING_TRADE_LABELS, type ONBOARDING_TRADES } from "@/lib/trades";
import { DAY_KEYS, DAY_LABELS } from "@/lib/availability";

/**
 * Screen 5 — the emotional payoff before Meet Your Receptionist.
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
 *     Receptionist's own live coaching preview calls) with four
 *     genuine customer questions built from what was just entered
 *     (availability, service area, trade, and a forward-moving "what's
 *     next" question). This is proof, not a scripted demo: there is
 *     still only one receptionist, one brain, one conversation engine.
 *
 * RC5: every reply now types itself in turn (not just the last one),
 * with a short natural pause between exchanges — the earlier version
 * committed most replies instantly and only animated the final one,
 * which read as mechanical. The only fixed timings below
 * (BETWEEN_EXCHANGE_PAUSE_MS, estimateTypeMs) are choreography beats
 * for content that has already arrived — how long a reply's own
 * type-out animation takes, and a breathing gap before the next
 * message — never an invented wait for something to happen.
 */

const BETWEEN_EXCHANGE_PAUSE_MS = 650;

function estimateTypeMs(text: string): number {
  const pause = 150;
  const think = 520;
  const type = Math.min(1500, Math.max(650, text.length * 14));
  return pause + think + type;
}

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

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

/** One exchange's receptionist reply, typing itself exactly once — a
 * fresh mount per exchange (keyed by the customer message upstream),
 * so there's never a previous message to visually "delete" mid-type. */
function TypedReply({ text }: { text: string }) {
  const { display, isThinking } = useTypedMessage(text);
  return (
    <Bubble from="receptionist" className="min-h-[34px]">
      {isThinking || display.length === 0 ? (
        <TypingDots className="px-1 py-1" />
      ) : (
        <span>{display}</span>
      )}
    </Bubble>
  );
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
  const [settledTurns, setSettledTurns] = useState<PreviewTurn[]>([]);
  const [activeExchange, setActiveExchange] = useState<{ customerText: string; replyText: string | null } | null>(
    null
  );
  const [factGroupIndex, setFactGroupIndex] = useState(0);
  const startedRef = useRef(false);

  const tradeLabel = ONBOARDING_TRADE_LABELS[trade as (typeof ONBOARDING_TRADES)[number]] ?? trade;

  const facts = [
    { label: "Business name", value: businessName },
    { label: "Trade", value: tradeLabel },
    { label: "Service area", value: serviceArea },
    { label: "Opening days", value: describeOpenDaysRange(openDays) },
    { label: "Opening hours", value: `${openingTime}–${closingTime}` },
  ];
  const factGroups = chunk(facts, 2);

  // RC5: presented two at a time rather than all five simultaneously —
  // "watching her assemble knowledge" instead of "reading a checklist".
  // Purely a presentational stagger over already-known facts; settles
  // on the final group and stops, it doesn't loop.
  useEffect(() => {
    if (stage !== "proof" && stage !== "ready") return;
    if (factGroupIndex >= factGroups.length - 1) return;
    const t = setTimeout(() => setFactGroupIndex((i) => i + 1), 1150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, factGroupIndex]);

  async function runProofConversation() {
    const demoMessages = [
      "Hi, are you free tomorrow?",
      `Do you cover ${serviceArea}?`,
      `Are you a ${tradeLabel.toLowerCase()}?`,
      "That sounds great — what's the next step?",
    ];
    // Fired together so the total wait is roughly one call's latency,
    // not the sum of four — but revealed one exchange at a time, each
    // typing itself out, so the thread reads as one natural
    // conversation rather than a burst of bubbles.
    const pending = demoMessages.map((message) => ({ message, promise: fetchDemoReply(message) }));

    const settled: PreviewTurn[] = [];
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      if (!item) continue;

      setActiveExchange({ customerText: item.message, replyText: null });

      const reply = await item.promise;
      if (!reply) {
        setActiveExchange(null);
        break; // a real hiccup — never let a nice-to-have block reaching Meet
      }

      setActiveExchange({ customerText: item.message, replyText: reply });
      await new Promise((resolve) => setTimeout(resolve, estimateTypeMs(reply)));

      settled.push({ from: "customer", text: item.message }, { from: "receptionist", text: reply });
      setSettledTurns([...settled]);
      setActiveExchange(null);

      await new Promise((resolve) => setTimeout(resolve, BETWEEN_EXCHANGE_PAUSE_MS));
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
            <motion.div
              className="relative mb-7 h-14 w-14"
              animate={{ y: [0, -4, 0], scale: [1, 1.035, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
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

            <GentleSwap swapKey={factGroupIndex} className="mb-6 min-h-[54px] space-y-2.5">
              {(factGroups[factGroupIndex] ?? []).map((fact, i) => (
                <Reveal key={fact.label} index={i} className="flex items-center gap-2.5 text-[13.5px]">
                  <span aria-hidden>
                    <GrowingCheck className="h-4 w-4 shrink-0" />
                  </span>
                  <span className="text-muted-foreground">{fact.label}:</span>
                  <span className="font-semibold text-foreground">{fact.value}</span>
                </Reveal>
              ))}
            </GentleSwap>

            <PhoneFrame businessName={businessName || "Your business"}>
              {settledTurns.map((turn, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <Bubble from={turn.from}>{turn.text}</Bubble>
                </motion.div>
              ))}
              {activeExchange && (
                <>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    <Bubble from="customer">{activeExchange.customerText}</Bubble>
                  </motion.div>
                  <TypedReply key={activeExchange.customerText} text={activeExchange.replyText ?? ""} />
                </>
              )}
            </PhoneFrame>

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
