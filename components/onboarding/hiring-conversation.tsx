"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench, Zap, Paintbrush, Hammer, Home, Check, MapPin, type LucideIcon } from "lucide-react";
import { useOnboardingStore } from "@/hooks/use-onboarding-store";
import { ONBOARDING_TRADES, ONBOARDING_TRADE_LABELS } from "@/lib/trades";
import { DAY_KEYS, DAY_LABELS, type DayKey } from "@/lib/availability";
import { ChipEditor } from "@/components/shared/chip-editor";
import { EASE, press, Reveal, GrowingCheck } from "@/components/shared/motion";
import { GradientText } from "@/components/shared/gradient-text";
import { TypingDots } from "@/components/shared/typed-message";
import { OnboardingCTA } from "@/components/onboarding/onboarding-cta";
import { cn } from "@/lib/utils";

/**
 * V20 — one continuous encounter, not a route per question. Business
 * name, trade, and service area all live inside this single component
 * at one URL (`/hire`); advancing between them is local state, never
 * `router.push`. Nothing already answered is ever unmounted — each
 * commit appends a permanent line to a visible stack (§C of the V20
 * plan) instead of a reaction that appears and disappears, so the
 * owner watches a real record build in front of them rather than
 * trusting it happened off-screen.
 *
 * Replaces business-name-step.tsx, trade-step.tsx, service-area-
 * step.tsx, and receptionist-presence.tsx — the last of those existed
 * specifically to survive a route change via Next.js layout
 * persistence, which no longer applies once there's no route change
 * to survive.
 *
 * No hardcoded pronoun anywhere below (doc 16 §3.14) — first person or
 * by name.
 */

type Step = "name" | "trade" | "area";
type PresetId = "default" | "early" | "everyday" | "custom";

interface AckLine {
  id: Step;
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

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"];
const ALL_DAYS = [...DAY_KEYS];

const HOURS_PRESETS: { id: PresetId; label: string; days?: string[]; opening?: string; closing?: string }[] = [
  { id: "default", label: "Weekdays, 8am–5:30pm", days: WEEKDAYS, opening: "08:00", closing: "17:30" },
  { id: "early", label: "Weekdays, 7am–4pm", days: WEEKDAYS, opening: "07:00", closing: "16:00" },
  { id: "everyday", label: "Every day, 8am–5:30pm", days: ALL_DAYS, opening: "08:00", closing: "17:30" },
  { id: "custom", label: "Set exact hours…" },
];

/** Long enough for a commit's own acknowledgment to settle into the
 * stack before the next question (or the next screen) appears — not
 * an arbitrary pause. */
const ADVANCE_DELAY_MS = 550;
const SETTLE_DELAY_MS = 650;

function formatTime12h(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return mStr === "00" ? `${h12}${period}` : `${h12}:${mStr}${period}`;
}

function formatDaysLabel(days: string[]): string {
  const set = new Set(days);
  if (days.length === 5 && WEEKDAYS.every((d) => set.has(d))) return "weekdays";
  if (days.length === 7) return "every day";
  if (days.length === 0) return "no days yet";
  return days
    .slice()
    .sort((a, b) => DAY_KEYS.indexOf(a as DayKey) - DAY_KEYS.indexOf(b as DayKey))
    .map((d) => DAY_LABELS[d as DayKey])
    .join(", ");
}

function ackForName(name: string): string {
  return `Nice to meet you, ${name}. That's the name your customers already trust, so that's the name I'll answer with.`;
}
function ackForTrade(trade: string): string {
  const label = (ONBOARDING_TRADE_LABELS[trade as (typeof ONBOARDING_TRADES)[number]] ?? trade).toLowerCase();
  return `I'll sound like a ${label}, not a call centre.`;
}
const ACK_AREA = "Got it — I'll only ever promise work in the areas you've actually taught me.";

/** The one identity mark, present for the whole encounter. `pulseKey`
 * incrementing replays a brief scale-and-glow settle — the shared
 * "commit" micro-interaction every answer triggers, keyed so each
 * commit remounts (and therefore replays) the pulse cleanly with
 * plain declarative motion, no imperative animation controls needed. */
function IdentityMark({ pulseKey }: { pulseKey: number }) {
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
      <AnimatePresence>
        {pulseKey > 0 && (
          <motion.span
            key={pulseKey}
            aria-hidden
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 1.7 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-success"
          />
        )}
      </AnimatePresence>
      <motion.span
        key={`scale-${pulseKey}`}
        animate={{ scale: pulseKey > 0 ? [1, 1.14, 1] : 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-success shadow-sm"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
          <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
        </svg>
      </motion.span>
    </span>
  );
}

function commit() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(10);
    } catch {
      // Unsupported or blocked — the visual pulse still carries the moment.
    }
  }
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

  const [step, setStep] = useState<Step>("name");
  const [acks, setAcks] = useState<AckLine[]>([]);
  const [pulseKey, setPulseKey] = useState(0);

  const [name, setName] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);
  const [areas, setAreas] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>(storedDays);
  const [opening, setOpening] = useState(storedOpening);
  const [closing, setClosing] = useState(storedClosing);
  const [showHours, setShowHours] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetId>("default");

  const advancingRef = useRef(false);
  const hydratedRef = useRef(false);

  // A refresh, or arriving with progress already in the persisted
  // store from earlier this session — rebuild both the local fields
  // and the visible acknowledgment stack so nothing looks forgotten.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const rebuilt: AckLine[] = [];
    const trimmedName = storedName.trim();
    if (trimmedName.length >= 2) {
      setName(storedName);
      rebuilt.push({ id: "name", text: ackForName(trimmedName) });
    }
    if (storedTrade) {
      setSelectedTrade(storedTrade);
      rebuilt.push({ id: "trade", text: ackForTrade(storedTrade) });
    }
    if (storedAreas.length > 0) {
      setAreas(storedAreas);
      rebuilt.push({ id: "area", text: ACK_AREA });
    }
    setDays(storedDays);
    setOpening(storedOpening);
    setClosing(storedClosing);
    setAcks(rebuilt);
    if (storedTrade) setStep("area");
    else if (trimmedName.length >= 2) setStep("trade");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushAck(id: Step, text: string) {
    setAcks((prev) => [...prev, { id, text }]);
    setPulseKey((k) => k + 1);
    commit();
  }

  function updateName(value: string) {
    setName(value);
    setField("businessName", value);
  }

  const trimmedName = name.trim();
  const hasName = trimmedName.length >= 2;

  function confirmName() {
    if (!hasName) return;
    pushAck("name", ackForName(trimmedName));
    setTimeout(() => setStep("trade"), ADVANCE_DELAY_MS);
  }

  function selectTrade(value: string) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setSelectedTrade(value);
    setField("trade", value);
    pushAck("trade", ackForTrade(value));
    setTimeout(() => setStep("area"), ADVANCE_DELAY_MS);
  }

  function updateAreas(next: string[]) {
    setAreas(next);
    setServiceAreas(next);
  }

  function applyPreset(preset: (typeof HOURS_PRESETS)[number]) {
    setActivePreset(preset.id);
    if (preset.days) {
      setDays(preset.days);
      setOpenDays(preset.days);
    }
    if (preset.opening) {
      setOpening(preset.opening);
      setField("openingTime", preset.opening);
    }
    if (preset.closing) {
      setClosing(preset.closing);
      setField("closingTime", preset.closing);
    }
  }

  function toggleDay(day: DayKey) {
    setActivePreset("custom");
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    setDays(next);
    setOpenDays(next);
  }

  function updateOpening(value: string) {
    setActivePreset("custom");
    setOpening(value);
    setField("openingTime", value);
  }

  function updateClosing(value: string) {
    setActivePreset("custom");
    setClosing(value);
    setField("closingTime", value);
  }

  const canContinue = areas.length > 0 && days.length > 0 && opening < closing;

  function confirmArea() {
    if (!canContinue) return;
    pushAck("area", ACK_AREA);
    setTimeout(() => router.push("/signup"), SETTLE_DELAY_MS);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-3xl border border-border bg-card p-9 shadow-elevated sm:p-10"
    >
      <div className="mb-6 flex items-center gap-3">
        <IdentityMark pulseKey={pulseKey} />
      </div>

      {acks.length > 0 && (
        <div className="mb-7 space-y-2.5" aria-live="polite">
          {acks.map((ack, i) => (
            <Reveal key={ack.id} index={i}>
              <div className="flex items-start gap-2.5">
                <GrowingCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-[13.5px] leading-snug text-muted-foreground">{ack.text}</span>
              </div>
            </Reveal>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === "name" && (
          <motion.div
            key="name"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <h1 className="mb-8 text-[24px] font-extrabold leading-tight tracking-tight">
              What&apos;s your <GradientText>business</GradientText> called?
            </h1>
            <motion.div whileFocus={{ scale: 1.01 }} className="group relative mb-8">
              <input
                autoFocus
                value={name}
                onChange={(e) => updateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmName()}
                placeholder="Acme Services"
                maxLength={80}
                aria-label="Business name"
                className="h-16 w-full rounded-2xl border-2 border-border bg-background px-5 text-[19px] font-semibold tracking-tight outline-none transition-all duration-300 placeholder:font-normal placeholder:text-muted-foreground/40 focus:border-primary focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08),0_12px_32px_-12px_rgba(37,99,235,0.25)]"
              />
            </motion.div>
            <OnboardingCTA onClick={confirmName} disabled={!hasName}>
              On to your trade
            </OnboardingCTA>
          </motion.div>
        )}

        {step === "trade" && (
          <motion.div
            key="trade"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <h1 className="mb-8 text-[24px] font-extrabold leading-tight tracking-tight">
              What&apos;s your <GradientText>trade</GradientText>?
            </h1>
            <div className="grid grid-cols-3 gap-2.5">
              {TRADE_CARDS.map((card, i) => {
                const isSelected = selectedTrade === card.value;
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
                    className={cn(
                      "relative flex flex-col items-center gap-2.5 rounded-2xl border-2 p-4 transition-colors duration-200",
                      isSelected
                        ? "border-primary bg-accent shadow-[0_10px_28px_-12px_rgba(37,99,235,0.4)]"
                        : "border-border bg-background hover:border-muted-foreground/30"
                    )}
                  >
                    {isSelected && <GrowingCheck className="absolute -right-1.5 -top-1.5 h-5 w-5 shadow-sm" />}
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300",
                        isSelected ? "bg-success text-success-foreground" : "bg-accent text-primary"
                      )}
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
        )}

        {step === "area" && (
          <motion.div
            key="area"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <h1 className="mb-6 text-[24px] font-extrabold leading-tight tracking-tight">
              Where do you <GradientText>work</GradientText>?
            </h1>

            <div className="relative mb-5 overflow-hidden rounded-2xl border border-border/70 bg-background/40 p-4">
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full blur-2xl"
                style={{ background: "radial-gradient(circle, rgba(34,197,94,0.18), transparent 70%)" }}
                animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="relative z-10 mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                Service areas
              </span>
              <div className="relative z-10">
                <ChipEditor
                  suggestions={[]}
                  items={areas}
                  onChange={updateAreas}
                  addPlaceholder="Add a town, postcode, or area you cover"
                />
              </div>
            </div>

            <div className="mb-8 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
              <p className="text-[13.5px] font-medium text-muted-foreground">
                Open {formatDaysLabel(days)}, {formatTime12h(opening)} till {formatTime12h(closing)} — tell me if
                that&apos;s wrong.
              </p>
              <button
                type="button"
                onClick={() => setShowHours((v) => !v)}
                className="shrink-0 text-[13px] font-semibold text-primary hover:underline"
              >
                {showHours ? "Done" : "Change"}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {showHours && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="mb-6 flex flex-wrap gap-2">
                    {HOURS_PRESETS.map((preset) => {
                      const on = activePreset === preset.id;
                      return (
                        <motion.button
                          key={preset.id}
                          {...press}
                          type="button"
                          aria-pressed={on}
                          onClick={() => applyPreset(preset)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] transition-all",
                            on
                              ? "bg-blue-600 font-semibold text-white shadow-sm shadow-blue-600/25"
                              : "border border-border bg-card font-medium text-muted-foreground hover:border-blue-200 hover:text-foreground"
                          )}
                        >
                          {on && <Check className="h-3 w-3" strokeWidth={3} />}
                          {preset.label}
                        </motion.button>
                      );
                    })}
                  </div>

                  {activePreset === "custom" && (
                    <>
                      <div className="mb-6">
                        <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                          Days open
                        </span>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
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
                                  on
                                    ? "border-success text-primary"
                                    : "border-border text-muted-foreground hover:border-muted-foreground/30"
                                )}
                              >
                                <AnimatePresence mode="wait" initial={false}>
                                  {on ? (
                                    <motion.span
                                      key="on"
                                      initial={{ scale: 0.4, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0.4, opacity: 0 }}
                                      transition={{ type: "spring", stiffness: 500, damping: 26 }}
                                      className="text-success"
                                    >
                                      <Check className="h-3 w-3" strokeWidth={3} />
                                    </motion.span>
                                  ) : (
                                    <span className="h-3 w-3" aria-hidden />
                                  )}
                                </AnimatePresence>
                                {DAY_LABELS[day].slice(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mb-2">
                        <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                          Hours
                        </span>
                        <div className="flex items-center gap-3">
                          <label className="flex-1">
                            <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
                              Opens
                            </span>
                            <input
                              type="time"
                              value={opening}
                              onChange={(e) => updateOpening(e.target.value)}
                              aria-label="Opening time"
                              className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[15px] font-semibold outline-none transition-all duration-300 focus:border-success focus:shadow-[0_0_0_3px_rgba(34,197,94,0.10)]"
                            />
                          </label>
                          <span className="mt-5 text-muted-foreground">–</span>
                          <label className="flex-1">
                            <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
                              Closes
                            </span>
                            <input
                              type="time"
                              value={closing}
                              onChange={(e) => updateClosing(e.target.value)}
                              aria-label="Closing time"
                              className="h-12 w-full rounded-xl border-2 border-border bg-background px-3.5 text-[15px] font-semibold outline-none transition-all duration-300 focus:border-success focus:shadow-[0_0_0_3px_rgba(34,197,94,0.10)]"
                            />
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className={showHours ? "mt-6" : undefined}>
              <OnboardingCTA onClick={confirmArea} disabled={!canContinue}>
                I&apos;ve got everything I need
              </OnboardingCTA>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
