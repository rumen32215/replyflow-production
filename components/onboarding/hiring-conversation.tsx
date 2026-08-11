"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench, Check, type LucideIcon } from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { ONBOARDING_TRADES, ONBOARDING_TRADE_LABELS } from "@/lib/trades";
import { DAY_KEYS, DAY_LABELS, type DayKey } from "@/lib/availability";
import { ChipEditor } from "@/components/shared/chip-editor";
import { GlowCard } from "@/components/shared/glow-card";
import { PACE } from "@/components/shared/pacing";
import { EASE, press } from "@/components/shared/motion";
import { MemoryCard } from "@/components/onboarding/memory-card";
import { Workstation } from "@/components/onboarding/workstation";
import { cn } from "@/lib/utils";
import {
  AREA_GUESS_LINE,
  hoursGuessLine,
  selectDiscovery,
  CARD_META,
  KNOWLEDGE_PROMPT,
  activationLine,
  ACTIVATION_SUBLINE,
} from "@/lib/onboarding-script";

/**
 * V22 — the receptionist is being built, not the form. Replaces
 * V21.6's Bubble-conversation transcript entirely: every completed
 * step now produces one real `MemoryCard` (the visible memory of the
 * encounter) and personalises one object on the `Workstation`, which
 * updates live, in the same beat, driven purely by props. Environment
 * is primary; conversation is secondary — a short question prompt,
 * then the card + workstation update *is* the acknowledgment. No
 * spoken "reaction" lines, no transcript to scroll.
 */

type Step = "name" | "trade" | "customerType" | "area" | "hours" | "discovery" | "knowledge" | "close";

interface CardData {
  id: string;
  label: string;
  status: string;
  lines: string[];
}

const TRADE_ICONS: Record<(typeof ONBOARDING_TRADES)[number], LucideIcon> = {
  plumbing: Wrench,
};

const TRADE_CARDS = ONBOARDING_TRADES.map((value) => ({
  value,
  label: ONBOARDING_TRADE_LABELS[value],
  icon: TRADE_ICONS[value],
}));

function formatTime12h(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return mStr === "00" ? `${h12}${period}` : `${h12}:${mStr}${period}`;
}

export function HiringConversation() {
  const router = useRouter();
  const storedName = useOnboardingStore((s) => s.businessName);
  const storedTrade = useOnboardingStore((s) => s.trade);
  const storedAreas = useOnboardingStore((s) => s.serviceAreas);
  const storedOpening = useOnboardingStore((s) => s.openingTime);
  const storedClosing = useOnboardingStore((s) => s.closingTime);
  const storedDays = useOnboardingStore((s) => s.openDays);
  const setField = useOnboardingStore((s) => s.setField);
  const setServiceAreas = useOnboardingStore((s) => s.setServiceAreas);
  const setOpenDays = useOnboardingStore((s) => s.setOpenDays);
  const setWorksCommercial = useOnboardingStore((s) => s.setWorksCommercial);
  const setDiscoveryAccepted = useOnboardingStore((s) => s.setDiscoveryAccepted);
  const setFirstMemoryAnswer = useOnboardingStore((s) => s.setFirstMemoryAnswer);

  const [step, setStep] = useState<Step>("name");
  const [pending, setPending] = useState(false);
  const [cards, setCards] = useState<CardData[]>([]);

  const [name, setName] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);
  const [customerType, setCustomerType] = useState<"domestic" | "both" | null>(null);
  const [areas, setAreas] = useState<string[]>([]);
  const [areaPhase, setAreaPhase] = useState<"guess" | "input">("guess");
  const [days, setDays] = useState<string[]>(storedDays);
  const [opening, setOpening] = useState(storedOpening);
  const [closing, setClosing] = useState(storedClosing);
  const [correctingHours, setCorrectingHours] = useState(false);
  const [committedHours, setCommittedHours] = useState<{ opening: string; closing: string } | null>(null);
  const [discoveryNote, setDiscoveryNote] = useState<string | null>(null);
  const [memoryAnswer, setMemoryAnswer] = useState("");
  const [activated, setActivated] = useState(false);

  const advancingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const trimmedName = storedName.trim();
    if (trimmedName.length >= 2) setName(storedName);
    if (storedTrade) setSelectedTrade(storedTrade);
    if (storedAreas.length > 0) setAreas(storedAreas);
    setDays(storedDays);
    setOpening(storedOpening);
    setClosing(storedClosing);
    if (storedTrade) {
      setStep("area");
    } else if (trimmedName.length >= 2) {
      setStep("trade");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Every step advance shares this shape: commit the fact, hold for a
   * short, honest processing beat (the founder's own "a short loading
   * state appears"), then the card materialises and the next question
   * replaces this one. No timers own this — a single delayed callback
   * per transition, gated on whether the component is still mounted. */
  function advance(after: () => void, ms: number = PACE.acknowledge) {
    setPending(true);
    setTimeout(() => {
      if (!mountedRef.current) return;
      setPending(false);
      after();
    }, ms);
  }

  function addCard(card: CardData) {
    setCards((prev) => [...prev, card]);
  }

  function confirmName() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || advancingRef.current) return;
    advancingRef.current = true;
    setField("businessName", trimmed);
    advance(() => {
      addCard({ id: "identity", label: CARD_META.identity.label, status: CARD_META.identity.status, lines: [trimmed] });
      setStep("trade");
      advancingRef.current = false;
    });
  }

  function selectTrade(value: string) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setSelectedTrade(value);
    setField("trade", value);
    advance(() => {
      setStep("customerType");
      advancingRef.current = false;
    }, PACE.recognition);
  }

  function answerCustomerType(answer: "domestic" | "both" | null) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setCustomerType(answer);
    setWorksCommercial(answer);
    const tradeLabel = ONBOARDING_TRADE_LABELS[selectedTrade as (typeof ONBOARDING_TRADES)[number]] ?? selectedTrade ?? "";
    const secondary = answer === "domestic" ? "Domestic jobs" : answer === "both" ? "Domestic & commercial" : null;
    advance(() => {
      addCard({
        id: "trade",
        label: CARD_META.trade.label,
        status: CARD_META.trade.status,
        lines: secondary ? [tradeLabel, secondary] : [tradeLabel],
      });
      setStep("area");
      advancingRef.current = false;
    });
  }

  function answerAreaGuess(accepted: boolean) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    advance(() => {
      setAreaPhase("input");
      advancingRef.current = false;
    }, PACE.inference);
    void accepted; // framing only — both branches lead to the same chip input (doc: no postcode to derive a radius from)
  }

  function updateAreas(next: string[]) {
    setAreas(next);
    setServiceAreas(next);
  }

  function confirmAreas() {
    if (areas.length === 0 || advancingRef.current) return;
    advancingRef.current = true;
    advance(() => {
      addCard({ id: "coverage", label: CARD_META.coverage.label, status: CARD_META.coverage.status, lines: areas });
      setStep("hours");
      advancingRef.current = false;
    });
  }

  function commitHours(o: string, c: string) {
    setField("openingTime", o);
    setField("closingTime", c);
    setOpenDays(days);
    setCommittedHours({ opening: o, closing: c });
    advance(() => {
      addCard({
        id: "hours",
        label: CARD_META.hours.label,
        status: CARD_META.hours.status,
        lines: [`${formatTime12h(o)} – ${formatTime12h(c)}`],
      });
      const discovery = selectDiscovery({ trade: selectedTrade ?? "", businessName: name.trim() || storedName, serviceAreas: areas });
      if (!discovery) {
        setStep("knowledge");
        advancingRef.current = false;
        return;
      }
      setStep("discovery");
      advancingRef.current = false;
    });
  }

  function answerHoursGuess(accepted: boolean) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    if (accepted) {
      commitHours(opening, closing);
      return;
    }
    advance(() => {
      setCorrectingHours(true);
      advancingRef.current = false;
    }, PACE.recognition);
  }

  function confirmCorrectedHours() {
    if (advancingRef.current || days.length === 0 || !(opening < closing)) return;
    advancingRef.current = true;
    setCorrectingHours(false);
    commitHours(opening, closing);
  }

  function answerDiscovery(accepted: boolean) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setDiscoveryAccepted(accepted);
    if (accepted) {
      const discovery = selectDiscovery({ trade: selectedTrade ?? "", businessName: name.trim() || storedName, serviceAreas: areas });
      setDiscoveryNote(discovery ? "Flags anything urgent, even outside hours" : null);
    }
    advance(() => {
      setStep("knowledge");
      advancingRef.current = false;
    }, PACE.discovery);
  }

  function submitMemory() {
    const trimmed = memoryAnswer.trim();
    if (trimmed.length === 0 || advancingRef.current) return;
    advancingRef.current = true;
    setFirstMemoryAnswer(trimmed);
    advance(() => {
      addCard({
        id: "knowledge",
        label: CARD_META.knowledge.label,
        status: CARD_META.knowledge.status,
        lines: discoveryNote ? [trimmed, discoveryNote] : [trimmed],
      });
      setStep("close");
      advancingRef.current = false;
    });
  }

  function toggleDay(day: DayKey) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function activate() {
    setActivated(true);
    setTimeout(() => router.push("/signup"), PACE.acknowledge);
  }

  const displayName = name.trim() || storedName;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Workstation
        businessName={displayName || null}
        trade={selectedTrade}
        areas={areas}
        hours={committedHours}
        hasMemory={cards.some((c) => c.id === "knowledge")}
        activated={activated}
      />

      {cards.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {cards.map((card, i) => (
            <MemoryCard key={card.id} label={card.label} status={card.status} lines={card.lines} delay={i === cards.length - 1 ? 0.05 : 0} />
          ))}
        </div>
      )}

      <div className="mt-6">
        <AnimatePresence mode="wait">
          {pending ? (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-6">
              <motion.span
                aria-hidden
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                className="h-2 w-2 rounded-full bg-primary"
              />
            </motion.div>
          ) : (
            <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }}>
              {step === "name" && (
                <GlowCard className="p-6">
                  <h1 className="mb-4 text-[19px] font-bold tracking-tight">What&apos;s your business called?</h1>
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmName()}
                    placeholder="Acme Services"
                    maxLength={80}
                    aria-label="Business name"
                    className="h-14 w-full rounded-2xl border-2 border-border bg-background px-4 text-[16px] font-semibold tracking-tight outline-none transition-all duration-300 placeholder:font-normal placeholder:text-muted-foreground/40 focus:border-primary focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)]"
                  />
                  <button
                    type="button"
                    onClick={confirmName}
                    disabled={name.trim().length < 2}
                    className="mt-3 rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-sm transition-opacity disabled:opacity-40"
                  >
                    Tell them
                  </button>
                </GlowCard>
              )}

              {step === "trade" && (
                <GlowCard className="p-6">
                  {/* ReplyFlow V4 (P0.C) — one trade, one card: honest
                   * about what ReplyFlow actually is right now rather
                   * than presenting a choice that implies breadth the
                   * AI can't back up (lib/trades.ts's own comment). */}
                  <h1 className="mb-4 text-[19px] font-bold tracking-tight">ReplyFlow is built for UK plumbers</h1>
                  <div className={cn("grid gap-2.5", TRADE_CARDS.length === 1 ? "max-w-[150px] grid-cols-1" : "grid-cols-3")}>
                    {TRADE_CARDS.map((card) => (
                      <motion.button
                        key={card.value}
                        type="button"
                        onClick={() => selectTrade(card.value)}
                        whileHover={{ y: -3 }}
                        whileTap={{ ...press.whileTap, transition: press.transition }}
                        aria-pressed={selectedTrade === card.value}
                        className={cn(
                          "flex flex-col items-center gap-2.5 rounded-2xl border-2 p-4 transition-colors duration-200",
                          selectedTrade === card.value ? "border-primary bg-accent" : "border-border bg-background hover:border-muted-foreground/30"
                        )}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-primary">
                          <card.icon className="h-[18px] w-[18px]" />
                        </span>
                        <span className="text-[12.5px] font-semibold leading-none">{card.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </GlowCard>
              )}

              {step === "customerType" && (
                <GlowCard className="p-6">
                  <h1 className="mb-4 text-[19px] font-bold tracking-tight">Mostly homes, or commercial work too?</h1>
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" onClick={() => answerCustomerType("domestic")} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
                      Mostly homes
                    </button>
                    <button type="button" onClick={() => answerCustomerType("both")} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
                      Both
                    </button>
                    <button type="button" onClick={() => answerCustomerType(null)} className="px-2 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
                      Skip
                    </button>
                  </div>
                </GlowCard>
              )}

              {step === "area" && areaPhase === "guess" && (
                <GlowCard className="p-6">
                  <h1 className="mb-4 text-[19px] font-bold tracking-tight leading-snug">{AREA_GUESS_LINE}</h1>
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" onClick={() => answerAreaGuess(true)} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
                      About right
                    </button>
                    <button type="button" onClick={() => answerAreaGuess(false)} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
                      Wider than that
                    </button>
                  </div>
                </GlowCard>
              )}
              {step === "area" && areaPhase === "input" && (
                <GlowCard className="p-6">
                  <h1 className="mb-4 text-[19px] font-bold tracking-tight">Where exactly?</h1>
                  <ChipEditor suggestions={[]} items={areas} onChange={updateAreas} addPlaceholder="Add a town, postcode, or area you cover" />
                  <button
                    type="button"
                    onClick={confirmAreas}
                    disabled={areas.length === 0}
                    className="mt-4 rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-sm disabled:opacity-40"
                  >
                    That&apos;s everywhere I cover
                  </button>
                </GlowCard>
              )}

              {step === "hours" && !correctingHours && (
                <GlowCard className="p-6">
                  <h1 className="mb-4 text-[19px] font-bold tracking-tight leading-snug">{hoursGuessLine(selectedTrade ?? "")}</h1>
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" onClick={() => answerHoursGuess(true)} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
                      Close enough
                    </button>
                    <button type="button" onClick={() => answerHoursGuess(false)} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
                      Not quite
                    </button>
                  </div>
                </GlowCard>
              )}
              {step === "hours" && correctingHours && (
                <GlowCard className="p-6">
                  <h1 className="mb-4 text-[19px] font-bold tracking-tight">Tell me the actual hours.</h1>
                  <div className="mb-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {DAY_KEYS.map((day) => {
                      const on = days.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          aria-pressed={on}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-xl border-2 bg-background py-3 text-[12.5px] font-semibold transition-colors duration-300",
                            on ? "border-success text-primary" : "border-border text-muted-foreground hover:border-muted-foreground/30"
                          )}
                        >
                          {on ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className="h-3 w-3" aria-hidden />}
                          {DAY_LABELS[day].slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex-1">
                      <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">Opens</span>
                      <input type="time" value={opening} onChange={(e) => setOpening(e.target.value)} className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[15px] font-semibold outline-none focus:border-success" />
                    </label>
                    <span className="mt-5 text-muted-foreground">–</span>
                    <label className="flex-1">
                      <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">Closes</span>
                      <input type="time" value={closing} onChange={(e) => setClosing(e.target.value)} className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[15px] font-semibold outline-none focus:border-success" />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={confirmCorrectedHours}
                    disabled={days.length === 0 || !(opening < closing)}
                    className="mt-4 rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-sm disabled:opacity-40"
                  >
                    That&apos;s right — {formatTime12h(opening)} till {formatTime12h(closing)}
                  </button>
                </GlowCard>
              )}

              {step === "discovery" && (
                <GlowCard className="p-6">
                  <h1 className="mb-4 text-[19px] font-bold tracking-tight leading-snug">
                    {selectDiscovery({ trade: selectedTrade ?? "", businessName: displayName, serviceAreas: areas })?.question({
                      trade: selectedTrade ?? "",
                      businessName: displayName,
                      serviceAreas: areas,
                    })}
                  </h1>
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" onClick={() => answerDiscovery(true)} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
                      Yes, do that
                    </button>
                    <button type="button" onClick={() => answerDiscovery(false)} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
                      Keep it simple
                    </button>
                  </div>
                </GlowCard>
              )}

              {step === "knowledge" && (
                <GlowCard className="p-6">
                  <h1 className="mb-4 text-[19px] font-bold tracking-tight">{KNOWLEDGE_PROMPT}</h1>
                  <input
                    autoFocus
                    value={memoryAnswer}
                    onChange={(e) => setMemoryAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitMemory()}
                    placeholder="We always wear shoe covers."
                    maxLength={140}
                    aria-label="What makes your business different"
                    className="h-14 w-full rounded-2xl border-2 border-border bg-background px-4 text-[16px] font-semibold tracking-tight outline-none transition-all duration-300 placeholder:font-normal placeholder:text-muted-foreground/40 focus:border-primary focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)]"
                  />
                  <button
                    type="button"
                    onClick={submitMemory}
                    disabled={memoryAnswer.trim().length === 0}
                    className="mt-3 rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-sm disabled:opacity-40"
                  >
                    Remember that
                  </button>
                </GlowCard>
              )}

              {step === "close" && (
                <GlowCard className="p-6 text-center">
                  <h1 className="mb-1.5 text-[21px] font-bold tracking-tight">{activationLine(displayName)}</h1>
                  <p className="mb-5 text-[14px] text-muted-foreground">{ACTIVATION_SUBLINE}</p>
                  <motion.button
                    {...press}
                    type="button"
                    onClick={activate}
                    className="rounded-full bg-gradient-to-r from-primary to-success px-6 py-3 text-[14.5px] font-semibold text-white shadow-sm"
                  >
                    Let&apos;s find out
                  </motion.button>
                </GlowCard>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
