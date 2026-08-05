"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench, Zap, Paintbrush, Hammer, Home, Check, type LucideIcon } from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { ONBOARDING_TRADES, ONBOARDING_TRADE_LABELS } from "@/lib/trades";
import { DAY_KEYS, DAY_LABELS, type DayKey } from "@/lib/availability";
import { ChipEditor } from "@/components/shared/chip-editor";
import { Bubble } from "@/components/shared/bubble";
import { PACE } from "@/components/shared/pacing";
import { EASE, press } from "@/components/shared/motion";
import { cn } from "@/lib/utils";
import {
  TRADE_VOCAB,
  hoursGuessLine,
  AREA_GUESS_LINE,
  AREA_LEAD_IN,
  customerTypeConsequence,
  selectDiscovery,
  closingLine,
} from "@/lib/onboarding-script";

/**
 * V21.6 — the scripted, behaviour-first encounter (doc 15, SPECS
 * implementation doc). One persistent view, one URL — unchanged from
 * V20's own collapse of the routed wizard. What changed is what
 * happens inside it: a fixed sequence (Meet, Learn, Understand, Widen,
 * Prepare, Discover, Close), every reaction stating a real
 * consequence, not just receipt, and pacing itself carrying most of
 * what used to be a visual-effects system. `PACE` bands (`components/
 * shared/pacing.ts`) are the only timing here — nothing below
 * hardcodes a duration inline.
 *
 * The identity mark stays, deliberately static — present throughout so
 * the owner always feels they're speaking with the same one, but with
 * none of V20's pulse/glow micro-interactions. Behaviour is the proof;
 * this is only ever the readout.
 */

type Step = "name" | "trade" | "customerType" | "area" | "hours" | "discovery" | "close";
type Sender = "assistant";

interface Line {
  id: string;
  sender: Sender;
  text: string;
}

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

function IdentityMark() {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="mb-6 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-success shadow-sm"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
        <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
      </svg>
    </motion.span>
  );
}

function formatTime12h(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return mStr === "00" ? `${h12}${period}` : `${h12}:${mStr}${period}`;
}

let lineCounter = 0;
function nextId(): string {
  lineCounter += 1;
  return `line-${lineCounter}`;
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

  const [step, setStep] = useState<Step>("name");
  const [lines, setLines] = useState<Line[]>([]);
  const [awaitingInput, setAwaitingInput] = useState(false);

  const [name, setName] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);
  const [areas, setAreas] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>(storedDays);
  const [opening, setOpening] = useState(storedOpening);
  const [closing, setClosing] = useState(storedClosing);
  const [correctingHours, setCorrectingHours] = useState(false);
  const [areaPhase, setAreaPhase] = useState<"guess" | "input">("guess");

  const advancingRef = useRef(false);
  const hydratedRef = useRef(false);
  // Gates the *effect* of a pending say(), not the timer itself — React
  // 18 Strict Mode's dev-only mount→cleanup→remount double-invoke would
  // otherwise clear the very timeout the hydration effect just
  // scheduled, before it can ever fire (hydratedRef, a ref, survives
  // the double-invoke and blocks the effect body from running a second
  // time, so nothing would ever re-schedule it). Checking "still
  // mounted" at fire time instead of cancelling the timer outright
  // means a Strict Mode remount (mountedRef back to true by the time
  // the timeout actually fires, since setTimeout is always async) still
  // completes correctly, while a genuine unmount safely no-ops.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function say(text: string, afterMs: number, then?: () => void) {
    setTimeout(() => {
      if (!mountedRef.current) return;
      setLines((prev) => [...prev, { id: nextId(), sender: "assistant", text }]);
      then?.();
    }, afterMs);
  }

  // A refresh, or arriving with progress already in the persisted store
  // from earlier this session — resume at the right step rather than
  // replaying the whole transcript (nothing here reconstructs old
  // lines; resuming quietly on the right question is enough).
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
      setLines([{ id: nextId(), sender: "assistant", text: AREA_GUESS_LINE }]);
      setAwaitingInput(true);
    } else if (trimmedName.length >= 2) {
      setStep("trade");
      setLines([{ id: nextId(), sender: "assistant", text: "Right — what's your trade?" }]);
      setAwaitingInput(true);
    } else {
      say("I don't know anything about you yet — let's fix that.", 0, () => {
        say("What should I call your business?", PACE.acknowledge, () => setAwaitingInput(true));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function confirmName() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || advancingRef.current) return;
    advancingRef.current = true;
    setField("businessName", trimmed);
    setAwaitingInput(false);
    say("Got it. That's how I'll introduce myself when someone gets in touch.", PACE.acknowledge, () => {
      say("Right — what's your trade?", PACE.acknowledge, () => {
        setStep("trade");
        advancingRef.current = false;
        setAwaitingInput(true);
      });
    });
  }

  function selectTrade(value: string) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setSelectedTrade(value);
    setField("trade", value);
    setAwaitingInput(false);
    const label = ONBOARDING_TRADE_LABELS[value as (typeof ONBOARDING_TRADES)[number]] ?? value;
    say(`${label} — good.`, PACE.recognition, () => {
      say(`That changes what I'll listen for — ${TRADE_VOCAB[value as (typeof ONBOARDING_TRADES)[number]]}`, PACE.acknowledge, () => {
        say("One thing, out of curiosity — mostly homes, or commercial work too?", PACE.acknowledge, () => {
          setStep("customerType");
          advancingRef.current = false;
          setAwaitingInput(true);
        });
      });
    });
  }

  function answerCustomerType(answer: "domestic" | "both" | null) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setWorksCommercial(answer);
    setAwaitingInput(false);
    const consequence = customerTypeConsequence(answer);
    const advance = () => {
      say(AREA_GUESS_LINE, PACE.acknowledge, () => {
        setStep("area");
        advancingRef.current = false;
        setAwaitingInput(true);
      });
    };
    if (consequence) {
      say(consequence, PACE.acknowledge, advance);
    } else {
      advance();
    }
  }

  function answerAreaGuess(accepted: boolean) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setAwaitingInput(false);
    say(accepted ? AREA_LEAD_IN.accepted : AREA_LEAD_IN.corrected, PACE.acknowledge, () => {
      advancingRef.current = false;
      setAreaPhase("input");
      setAwaitingInput(true);
    });
  }

  function updateAreas(next: string[]) {
    setAreas(next);
    setServiceAreas(next);
  }

  function confirmAreas() {
    if (areas.length === 0 || advancingRef.current) return;
    advancingRef.current = true;
    setAwaitingInput(false);
    say(hoursGuessLine(selectedTrade ?? ""), PACE.acknowledge, () => {
      setStep("hours");
      advancingRef.current = false;
      setAwaitingInput(true);
    });
  }

  function afterHoursSet() {
    say(
      "Good — so outside that, I'll let people know they've been heard, without promising someone's coming out.",
      PACE.acknowledge,
      () => {
        const discovery = selectDiscovery({
          trade: selectedTrade ?? "",
          businessName: name.trim() || storedName,
          serviceAreas: areas,
        });
        if (!discovery) {
          setStep("close");
          advancingRef.current = false;
          runClose();
          return;
        }
        say(discovery.question({ trade: selectedTrade ?? "", businessName: name.trim() || storedName, serviceAreas: areas }), PACE.discovery, () => {
          setStep("discovery");
          advancingRef.current = false;
          setAwaitingInput(true);
        });
      }
    );
  }

  function answerHoursGuess(accepted: boolean) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setAwaitingInput(false);
    if (accepted) {
      setField("openingTime", opening);
      setField("closingTime", closing);
      setOpenDays(days);
      afterHoursSet();
      return;
    }
    say("Tell me the actual hours.", PACE.acknowledge, () => {
      setCorrectingHours(true);
      advancingRef.current = false;
      setAwaitingInput(true);
    });
  }

  function confirmCorrectedHours() {
    if (advancingRef.current || days.length === 0 || !(opening < closing)) return;
    advancingRef.current = true;
    setField("openingTime", opening);
    setField("closingTime", closing);
    setOpenDays(days);
    setAwaitingInput(false);
    setCorrectingHours(false);
    afterHoursSet();
  }

  function answerDiscovery(accepted: boolean) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setDiscoveryAccepted(accepted);
    setAwaitingInput(false);
    say(accepted ? "Good — I'll remember that." : "Fair enough — I'll keep it simple.", PACE.acknowledge, () => {
      setStep("close");
      advancingRef.current = false;
      runClose();
    });
  }

  function runClose() {
    say(closingLine(name.trim() || storedName), PACE.acknowledge, () => {
      say("Send me something a customer would actually send — let's see if I've been paying attention.", PACE.acknowledge, () => {
        setAwaitingInput(true); // gates the final CTA
      });
    });
  }

  function toggleDay(day: DayKey) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function goToSignup() {
    setTimeout(() => router.push("/signup"), PACE.acknowledge);
  }

  // As the transcript grows across a two-minute encounter, the newest
  // line or the newly-revealed input can end up below the fold —
  // keeps whichever just appeared in view rather than asking the owner
  // to go find it.
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length, awaitingInput, step, areaPhase, correctingHours]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-3xl border border-border bg-card p-9 shadow-elevated sm:p-10"
    >
      <IdentityMark />

      <div className="flex flex-col gap-3">
        {lines.map((line) => (
          <Bubble key={line.id}>{line.text}</Bubble>
        ))}
      </div>

      {/* Name */}
      {step === "name" && awaitingInput && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="mt-4">
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
        </motion.div>
      )}

      {/* Trade */}
      {step === "trade" && awaitingInput && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="mt-4 grid grid-cols-3 gap-2.5">
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
        </motion.div>
      )}

      {/* Customer type */}
      {step === "customerType" && awaitingInput && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="mt-4 flex flex-wrap gap-2.5">
          <button type="button" onClick={() => answerCustomerType("domestic")} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
            Mostly homes
          </button>
          <button type="button" onClick={() => answerCustomerType("both")} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
            Both
          </button>
          <button type="button" onClick={() => answerCustomerType(null)} className="px-2 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
            Skip
          </button>
        </motion.div>
      )}

      {/* Area */}
      {step === "area" && awaitingInput && areaPhase === "guess" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="mt-4 flex flex-wrap gap-2.5">
          <button type="button" onClick={() => answerAreaGuess(true)} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
            About right
          </button>
          <button type="button" onClick={() => answerAreaGuess(false)} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
            Wider than that
          </button>
        </motion.div>
      )}
      {step === "area" && awaitingInput && areaPhase === "input" && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="mt-4">
          <ChipEditor suggestions={[]} items={areas} onChange={updateAreas} addPlaceholder="Add a town, postcode, or area you cover" />
          <button
            type="button"
            onClick={confirmAreas}
            disabled={areas.length === 0}
            className="mt-4 rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-sm disabled:opacity-40"
          >
            That&apos;s everywhere I cover
          </button>
        </motion.div>
      )}

      {/* Hours */}
      {step === "hours" && awaitingInput && !correctingHours && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="mt-4 flex flex-wrap gap-2.5">
          <button type="button" onClick={() => answerHoursGuess(true)} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
            Close enough
          </button>
          <button type="button" onClick={() => answerHoursGuess(false)} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
            Not quite
          </button>
        </motion.div>
      )}
      {step === "hours" && awaitingInput && correctingHours && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="mt-4">
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
              <input
                type="time"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[15px] font-semibold outline-none focus:border-success"
              />
            </label>
            <span className="mt-5 text-muted-foreground">–</span>
            <label className="flex-1">
              <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">Closes</span>
              <input
                type="time"
                value={closing}
                onChange={(e) => setClosing(e.target.value)}
                className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[15px] font-semibold outline-none focus:border-success"
              />
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
        </motion.div>
      )}

      {/* Discovery */}
      {step === "discovery" && awaitingInput && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="mt-4 flex flex-wrap gap-2.5">
          <button type="button" onClick={() => answerDiscovery(true)} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
            Yes, do that
          </button>
          <button type="button" onClick={() => answerDiscovery(false)} className="rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold hover:border-primary">
            Keep it simple
          </button>
        </motion.div>
      )}

      {/* Close */}
      {step === "close" && awaitingInput && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="mt-4">
          <AnimatePresence>
            <motion.button
              key="cta"
              {...press}
              type="button"
              onClick={goToSignup}
              className="rounded-full bg-primary px-6 py-3 text-[14.5px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Let&apos;s find out
            </motion.button>
          </AnimatePresence>
        </motion.div>
      )}
      <div ref={bottomRef} />
    </motion.div>
  );
}
