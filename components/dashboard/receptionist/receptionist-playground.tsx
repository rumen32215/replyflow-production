"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { SettleCard, GentleSwap, press } from "@/components/shared/motion";
import { Acknowledgement, ACK, useAcknowledgement } from "@/components/shared/acknowledgement";
import { PhonePreview } from "@/components/shared/phone-preview";
import { createClient } from "@/lib/supabase/client";
import {
  BEHAVIOUR_OPTIONS,
  RULE_OPTIONS,
  ESCALATION_OPTIONS,
  PREVIEW_SCENARIOS,
  parseOptions,
  composeOptions,
  buildPreviewConversation,
  type Tone,
  type TeachingOption,
} from "@/lib/receptionist";
import { greetingForNow } from "@/components/dashboard/home/home-experience";
import { cn } from "@/lib/utils";

/**
 * The signature experience (Receptionist Experience V2): a live
 * training session, never a settings page.
 *
 *   - Owners teach behaviours; ReplyFlow writes the conversation.
 *   - Every change updates the phone preview instantly — the reply
 *     pauses, deletes, thinks and retypes (Motion Language).
 *   - There is no Save button and no Generate button. Changes persist
 *     quietly (debounced upsert) and the receptionist acknowledges:
 *     "Perfect. I'll remember that."
 *
 * The persisted shape is unchanged from before this redesign
 * (ai_configurations: tone + three plain-text columns), so everything
 * an owner taught previously is parsed back into toggles losslessly.
 */

const TONES: { value: Tone; label: string; description: string }[] = [
  { value: "friendly", label: "Friendly", description: "Warm and personal" },
  { value: "professional", label: "Professional", description: "Polished and courteous" },
  { value: "concise", label: "Concise", description: "Short and to the point" },
];

interface SavedConfig {
  tone: Tone;
  systemPrompt: string;
  businessRules: string;
  escalationRules: string;
}

export function ReceptionistPlayground({
  businessId,
  businessName,
  offersEmergency,
  chargesCalloutFee,
  calloutFeeAmount,
  initial,
  justHired,
}: {
  businessId: string;
  businessName: string;
  offersEmergency: boolean;
  chargesCalloutFee: boolean;
  calloutFeeAmount: string | null;
  initial: SavedConfig;
  justHired: boolean;
}) {
  const supabase = createClient();
  const { message, isError, acknowledge, softError } = useAcknowledgement();

  const parsed = useMemo(
    () => ({
      behaviours: parseOptions(initial.systemPrompt, BEHAVIOUR_OPTIONS),
      rules: parseOptions(initial.businessRules, RULE_OPTIONS),
      escalation: parseOptions(initial.escalationRules, ESCALATION_OPTIONS),
    }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [tone, setTone] = useState<Tone>(initial.tone);
  const [behaviours, setBehaviours] = useState<Set<string>>(parsed.behaviours.selected);
  const [rules, setRules] = useState<Set<string>>(parsed.rules.selected);
  const [escalation, setEscalation] = useState<Set<string>>(parsed.escalation.selected);
  const [scenarioId, setScenarioId] = useState<string>(PREVIEW_SCENARIOS[0]?.id ?? "problem");

  const scenario = PREVIEW_SCENARIOS.find((s) => s.id === scenarioId) ?? PREVIEW_SCENARIOS[0]!;
  const { turns, liveReply } = buildPreviewConversation(
    {
      businessName,
      tone,
      behaviours,
      rules,
      escalation,
      offersEmergency,
      chargesCalloutFee,
      calloutFeeAmount,
    },
    scenario
  );

  /* ------------------------- quiet persistence ------------------------- */
  // Debounced upsert: the owner never presses Save; the receptionist
  // simply remembers. First render never writes.
  const firstRender = useRef(true);
  const ackRef = useRef<string>(ACK.remember);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const { error } = await supabase.from("ai_configurations").upsert(
        {
          business_id: businessId,
          tone,
          system_prompt: composeOptions(BEHAVIOUR_OPTIONS, behaviours, parsed.behaviours.notes),
          business_rules: composeOptions(RULE_OPTIONS, rules, parsed.rules.notes),
          escalation_rules: composeOptions(ESCALATION_OPTIONS, escalation, parsed.escalation.notes),
        },
        { onConflict: "business_id" }
      );
      if (error) softError();
      else acknowledge(ackRef.current);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tone, behaviours, rules, escalation]);

  function toggle(set: Set<string>, apply: (s: Set<string>) => void, id: string, ack: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    ackRef.current = ack;
    apply(next);
  }

  /* ------------------------------ layout ------------------------------- */

  return (
    <div className="mx-auto max-w-5xl">
      {/* Arrival — one calm sentence, no technical language. */}
      <SettleCard className="mb-6">
        <h1 className="text-[24px] font-extrabold tracking-tight md:text-[26px]" suppressHydrationWarning>
          {justHired ? `Hello, ${businessName}.` : `${greetingForNow()}, ${businessName}.`}
        </h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          {justHired
            ? "I'm your new receptionist. Teach me how you like things done — I'll show you exactly how I'll speak to your customers."
            : "Let's make sure I'm ready for today's customers."}
        </p>
      </SettleCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Teaching cards — one behaviour per card, no long forms. */}
        <div className="min-w-0 space-y-4">
          <TeachingCard delay={0.05} title="How should I sound?" subtitle="Customers hear this in every reply.">
            <div className="grid grid-cols-3 gap-2">
              {TONES.map((t) => (
                <motion.button
                  key={t.value}
                  {...press}
                  type="button"
                  onClick={() => {
                    ackRef.current = ACK.updated;
                    setTone(t.value);
                  }}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    tone === t.value
                      ? "border-primary bg-accent"
                      : "border-border bg-card hover:bg-muted/50"
                  )}
                >
                  <p className={cn("text-[13px] font-semibold", tone === t.value && "text-primary")}>{t.label}</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{t.description}</p>
                </motion.button>
              ))}
            </div>
          </TeachingCard>

          <TeachingCard delay={0.1} title="When someone gets in touch" subtitle="Tap what I should always do.">
            <OptionChips options={BEHAVIOUR_OPTIONS} selected={behaviours} onToggle={(id) => toggle(behaviours, setBehaviours, id, ACK.remember)} />
          </TeachingCard>

          <TeachingCard delay={0.15} title="House rules" subtitle="Things I'll never get wrong.">
            <OptionChips options={RULE_OPTIONS} selected={rules} onToggle={(id) => toggle(rules, setRules, id, ACK.useNextTime)} />
          </TeachingCard>

          <TeachingCard delay={0.2} title="When I should come and get you" subtitle="I'll stop and hand the conversation straight to you.">
            <OptionChips options={ESCALATION_OPTIONS} selected={escalation} onToggle={(id) => toggle(escalation, setEscalation, id, ACK.gotIt)} />
          </TeachingCard>
        </div>

        {/* The live phone — always alive, never refreshed. */}
        <div className="lg:sticky lg:top-2 lg:self-start">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {PREVIEW_SCENARIOS.map((s) => (
              <motion.button
                key={s.id}
                {...press}
                type="button"
                onClick={() => setScenarioId(s.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition-colors",
                  scenarioId === s.id
                    ? "border-primary bg-accent text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
              </motion.button>
            ))}
          </div>

          <GentleSwap swapKey={scenarioId}>
            <PhonePreview businessName={businessName} turns={turns} liveReply={liveReply} />
          </GentleSwap>

          <div className="mt-3 flex min-h-[24px] items-center justify-between">
            <p className="text-[11.5px] text-muted-foreground">This is exactly how I&apos;ll reply.</p>
            <Acknowledgement message={message} isError={isError} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TeachingCard({
  title,
  subtitle,
  delay,
  children,
}: {
  title: string;
  subtitle: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <SettleCard delay={delay} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
      <p className="mb-3.5 mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>
      {children}
    </SettleCard>
  );
}

function OptionChips({
  options,
  selected,
  onToggle,
}: {
  options: readonly TeachingOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = selected.has(option.id);
        return (
          <motion.button
            key={option.id}
            {...press}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(option.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors",
              on
                ? "border-primary bg-accent text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border"
              )}
            >
              {on && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
            </span>
            {option.label}
          </motion.button>
        );
      })}
    </div>
  );
}
