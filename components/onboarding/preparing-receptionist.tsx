"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { OnboardingCTA } from "@/components/onboarding/onboarding-cta";
import { EASE, GentleSwap, GrowingCheck } from "@/components/shared/motion";
import { PhoneFrame, Bubble, type PreviewTurn } from "@/components/shared/phone-preview";
import { TypingDots, useTypedMessage } from "@/components/shared/typed-message";
import { ONBOARDING_TRADE_LABELS, type ONBOARDING_TRADES } from "@/lib/trades";
import { DAY_KEYS, DAY_LABELS } from "@/lib/availability";
import type { ConversationState } from "@/lib/reply-engine/understanding/state";

/**
 * Screen 5 — the emotional payoff before Meet Your Receptionist.
 *
 * Two genuinely different things happen here, and neither one fakes a
 * delay:
 *
 *  1. The real POST to /api/onboarding/prepare creates the business
 *     row. "Setting up your receptionist" lasts exactly as long as
 *     that real request takes — nothing scripted.
 *
 *  2. Once that row exists, this calls the exact same real reasoning
 *     pipeline production uses (lib/reply-engine/live-reply.ts, via
 *     /api/receptionist/live-reply). RC6: this now threads real
 *     conversation memory across the four demo exchanges — the same
 *     ConversationState/history a persisted conversation carries
 *     turn by turn, just held in this component instead of a
 *     database row. The four messages are written as one continuous,
 *     natural thread specifically so later turns depend on earlier
 *     ones (the customer never repeats what they already said) —
 *     proof the receptionist genuinely remembers, not a scripted
 *     imitation of remembering. Still one receptionist, one brain,
 *     one conversation engine; this screen is one more real caller of
 *     it, never a second, faked one.
 *
 * Because later replies now depend on earlier ones, the four calls are
 * necessarily sequential (memory can't be parallelised) — the only
 * fixed timings below (BETWEEN_EXCHANGE_PAUSE_MS, estimateTypeMs) are
 * choreography for content that has already arrived: how long a
 * reply's own type-out animation takes, and a breathing gap before the
 * next message. Never an invented wait for something to happen.
 */

const BETWEEN_EXCHANGE_PAUSE_MS = 750;
const FACT_GROUP_DWELL_MS = 2100;
/** Matches `demoMessages.length` inside `runProofConversation` below —
 * kept as a named constant since the progress bar's percentage needs
 * it before that array exists (render time, not just inside the async
 * function). */
const PROOF_EXCHANGE_COUNT = 4;
/** How soon the skip link can appear if the demo is unusually slow to
 * produce even its first reply — the other, usually-earlier gate is
 * "at least one full exchange has already happened" (see `canSkip`
 * below), so this is a ceiling, not the normal path. */
const SKIP_FALLBACK_MS = 4000;

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

/** A trade-appropriate opening problem — the customer states something
 * real up front so the rest of the thread has genuine context to carry
 * forward, instead of four disconnected trivia questions. */
const TRADE_ISSUE: Record<(typeof ONBOARDING_TRADES)[number], string> = {
  plumbing: "I've got a leak under the kitchen sink",
  electrical: "one of my sockets keeps tripping the fuse box",
  painting: "my living room walls need repainting, they're looking pretty tired",
  building: "I'm looking to get a small extension built at the back of the house",
  roofing: "I've noticed a few tiles missing after the storm last week",
};

interface DemoReply {
  replyText: string;
  conversationState: ConversationState;
}

async function fetchDemoReply(
  message: string,
  priorState: ConversationState | undefined,
  recentHistory: { direction: "inbound" | "outbound"; body: string }[]
): Promise<DemoReply | null> {
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
        priorState,
        recentHistory,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.replyText !== "string" || !data.replyText.trim()) return null;
    return { replyText: data.replyText, conversationState: data.conversationState };
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

const PREPARING_STAGE_LABEL: Record<"working" | "proof" | "ready" | "failed", string> = {
  working: "Setting up your receptionist",
  proof: "Learning your business",
  ready: "Receptionist ready",
  failed: "",
};

/** `working` holds at a small, deliberately non-zero sliver (paired
 * with the pulsing opacity in the bar itself) since there's no real
 * fraction-complete to report yet — genuinely indeterminate, not a
 * guess dressed up as one. `proof` is real: it tracks settled turns
 * against the fixed exchange count. */
function preparingProgressPct(stage: "working" | "proof" | "ready" | "failed", settledCount: number): number {
  if (stage === "working") return 12;
  if (stage === "proof") return 12 + Math.min(1, settledCount / (PROOF_EXCHANGE_COUNT * 2)) * 78;
  return 100;
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
  const [canSkip, setCanSkip] = useState(false);
  const startedRef = useRef(false);
  // V18: the skip link (below) can send someone to the dashboard while
  // `runProofConversation`'s loop is still mid-`await` — this stops
  // that in-flight loop from calling setState on a component that's
  // about to navigate away, without needing an AbortController for
  // what's otherwise a fire-and-forget demo call.
  const cancelledRef = useRef(false);

  const tradeLabel = ONBOARDING_TRADE_LABELS[trade as (typeof ONBOARDING_TRADES)[number]] ?? trade;

  const facts = [
    { label: "Business name", value: businessName },
    { label: "Trade", value: tradeLabel },
    { label: "Service area", value: serviceArea },
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

  // V18: "at least one full exchange has demonstrated real memory, so
  // the feature still gets to make its point before offering the
  // exit" — the primary gate is a completed exchange (2 settled
  // turns); `SKIP_FALLBACK_MS` is only a ceiling for the unlikely case
  // where even the first reply is slow to arrive.
  useEffect(() => {
    if (stage !== "proof") return;
    if (settledTurns.length >= 2) {
      setCanSkip(true);
      return;
    }
    const t = setTimeout(() => setCanSkip(true), SKIP_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [stage, settledTurns.length]);

  async function runProofConversation() {
    const issue = TRADE_ISSUE[trade as (typeof ONBOARDING_TRADES)[number]] ?? "I need some work done";
    const demoMessages = [
      `Hi, ${issue}`,
      "Would tomorrow work?",
      `Do you cover ${serviceArea}?`,
      "Great — what do I need to do now?",
    ];

    let priorState: ConversationState | undefined;
    let history: { direction: "inbound" | "outbound"; body: string }[] = [];
    const settled: PreviewTurn[] = [];

    for (let i = 0; i < demoMessages.length; i++) {
      if (cancelledRef.current) return;
      const message = demoMessages[i];
      if (!message) continue;

      setActiveExchange({ customerText: message, replyText: null });

      const result = await fetchDemoReply(message, priorState, history);
      if (cancelledRef.current) return;
      if (!result) {
        setActiveExchange(null);
        break; // a real hiccup — never let a nice-to-have block reaching Meet
      }

      setActiveExchange({ customerText: message, replyText: result.replyText });
      await new Promise((resolve) => setTimeout(resolve, estimateTypeMs(result.replyText)));
      if (cancelledRef.current) return;

      settled.push({ from: "customer", text: message }, { from: "receptionist", text: result.replyText });
      setSettledTurns([...settled]);
      setActiveExchange(null);

      priorState = result.conversationState;
      history = [
        ...history,
        { direction: "inbound", body: message },
        { direction: "outbound", body: result.replyText },
      ];

      await new Promise((resolve) => setTimeout(resolve, BETWEEN_EXCHANGE_PAUSE_MS));
      if (cancelledRef.current) return;
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
      const data: { alreadyCompleted?: boolean } = await res.json().catch(() => ({}));

      // Master Execution Plan 0.2 — onboarding was already completed
      // for this business before this mount (a refresh, or navigating
      // back to this screen). The proof conversation is a one-time
      // reveal: replaying it would re-spend real OpenAI calls to show
      // the exact same kind of thing again, for no one's benefit. Skip
      // straight to ready — the learned facts still animate in.
      if (data.alreadyCompleted) {
        setStage("ready");
        return;
      }

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
    cancelledRef.current = true; // stop any in-flight proof-conversation loop from setState-ing after this
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
      {/* V18: one continuous narrative spanning "working" and "proof"
       * instead of two disconnected loading states — the bar and the
       * facts panel both live outside the stage-switch below, so they
       * persist (rather than remount and re-animate) across the
       * working -> proof -> ready transition. Facts start revealing
       * during "working" too: the five values already sit in the
       * store with zero network dependency, so idle spinner time
       * becomes real content instead of nothing. */}
      {stage !== "failed" && (
        <>
          <div className="mb-6">
            <GentleSwap swapKey={stage} className="mb-2 text-[12px] font-semibold text-muted-foreground/80">
              {PREPARING_STAGE_LABEL[stage]}
            </GentleSwap>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-success"
                animate={{
                  width: `${preparingProgressPct(stage, settledTurns.length)}%`,
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
                tiny drifting particles — anticipation, not a loader.
                No text of its own now — the label above already says
                "Setting up your receptionist"; this is pure atmosphere. */}
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

        {(stage === "proof" || stage === "ready") && (
          <motion.div
            key="proof"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
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

            {/* Only offered once at least one full exchange has already
             * demonstrated real memory (or, rarely, after a fallback
             * delay if even the first reply is slow) — the demo gets to
             * make its point before anyone's offered the exit. Safe to
             * leave any time after: `onboarding_completed` is already
             * true by the time this stage is reached. */}
            {stage === "proof" && canSkip && (
              <motion.button
                type="button"
                onClick={enterReceptionist}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="mt-4 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
              >
                Skip ahead to my receptionist
              </motion.button>
            )}

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
