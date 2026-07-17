"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Headset } from "lucide-react";
import { SettleCard, GentleSwap, press } from "@/components/shared/motion";
import { Acknowledgement, ACK, useAcknowledgement } from "@/components/shared/acknowledgement";
import { PhonePreview } from "@/components/shared/phone-preview";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  BEHAVIOUR_OPTIONS,
  RULE_OPTIONS,
  ESCALATION_OPTIONS,
  PREVIEW_SCENARIOS,
  parseOptions,
  composeOptions,
  buildPreviewConversation,
  deriveScenarioStatus,
  type Tone,
  type TeachingOption,
} from "@/lib/receptionist";
import { greetingForNow } from "@/components/dashboard/home/home-experience";
import { cn } from "@/lib/utils";

/**
 * The signature experience (Receptionist V3): training an employee,
 * not filling in settings.
 *
 *   - She asks; the owner taps. Every topic is one of her chat turns,
 *     not a titled settings card — same underlying options and
 *     persisted columns, a conversation container instead of a panel.
 *   - The live customer preview is the hero: it comes first in the
 *     page (mobile never has to scroll past teaching to find it) and
 *     every change updates it instantly — pause, delete, think,
 *     retype (Motion Language).
 *   - There is no Save button and no Generate button. Changes persist
 *     quietly (debounced upsert) and she acknowledges:
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
  toneNotes: string;
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
  const { message, isError, isSaving, startSaving, acknowledge, softError } = useAcknowledgement();

  const parsed = useMemo(
    () => ({
      behaviours: parseOptions(initial.systemPrompt, BEHAVIOUR_OPTIONS),
      rules: parseOptions(initial.businessRules, RULE_OPTIONS),
      escalation: parseOptions(initial.escalationRules, ESCALATION_OPTIONS),
    }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [tone, setTone] = useState<Tone>(initial.tone);
  const [toneNotes, setToneNotes] = useState<string>(initial.toneNotes);
  const [behaviours, setBehaviours] = useState<Set<string>>(parsed.behaviours.selected);
  const [behavioursNotes, setBehavioursNotes] = useState<string>(parsed.behaviours.notes);
  const [rules, setRules] = useState<Set<string>>(parsed.rules.selected);
  const [rulesNotes, setRulesNotes] = useState<string>(parsed.rules.notes);
  const [escalation, setEscalation] = useState<Set<string>>(parsed.escalation.selected);
  const [escalationNotes, setEscalationNotes] = useState<string>(parsed.escalation.notes);
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
  const status = deriveScenarioStatus(scenario, { escalation });

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
      startSaving();
      const { error } = await supabase.from("ai_configurations").upsert(
        {
          business_id: businessId,
          tone,
          tone_notes: toneNotes,
          system_prompt: composeOptions(BEHAVIOUR_OPTIONS, behaviours, behavioursNotes),
          business_rules: composeOptions(RULE_OPTIONS, rules, rulesNotes),
          escalation_rules: composeOptions(ESCALATION_OPTIONS, escalation, escalationNotes),
        },
        { onConflict: "business_id" }
      );
      if (error) softError();
      else acknowledge(ackRef.current);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tone, toneNotes, behaviours, behavioursNotes, rules, rulesNotes, escalation, escalationNotes]);

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

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px] lg:items-start">
        {/* The live phone — the hero. First on mobile (never buried
         * below teaching), sticky in the right column on desktop. */}
        <div className="lg:order-2 lg:sticky lg:top-2 lg:self-start">
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
            <PhonePreview businessName={businessName} turns={turns} liveReply={liveReply} status={status} />
          </GentleSwap>

          <div className="mt-3 flex min-h-[24px] items-center justify-between">
            <p className="text-[11.5px] text-muted-foreground">This is exactly how I&apos;ll reply.</p>
            <Acknowledgement message={message} isError={isError} isSaving={isSaving} />
          </div>
        </div>

        {/* Teaching her — one topic per chat turn, not a settings
         * panel. Same underlying options as before; a conversation
         * container instead of titled cards. */}
        <div className="min-w-0 space-y-4 lg:order-1">
          <TeachingTurn delay={0.05} question="How should I sound when I answer?" learned>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => {
                const on = tone === t.value;
                return (
                  <motion.button
                    key={t.value}
                    {...press}
                    type="button"
                    onClick={() => {
                      ackRef.current = ACK.updated;
                      setTone(t.value);
                    }}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors",
                      on ? "border-primary bg-accent text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.label}
                  </motion.button>
                );
              })}
            </div>
            <OwnWordsInput
              value={toneNotes}
              onChange={(v) => {
                ackRef.current = ACK.updated;
                setToneNotes(v);
              }}
              placeholder="Or describe how I should sound, in your own words..."
              example={'e.g. "Talk like a friendly Yorkshire tradesman — casual, not corporate."'}
            />
          </TeachingTurn>

          <TeachingTurn
            delay={0.1}
            learned={behaviours.size > 0 || behavioursNotes.length > 0}
            question={
              behaviours.size > 0
                ? "Here's what I do when someone gets in touch — anything to add?"
                : "What should I always do when someone gets in touch?"
            }
          >
            <OptionChips options={BEHAVIOUR_OPTIONS} selected={behaviours} onToggle={(id) => toggle(behaviours, setBehaviours, id, ACK.remember)} />
            <OwnWordsInput
              value={behavioursNotes}
              onChange={(v) => {
                ackRef.current = ACK.remember;
                setBehavioursNotes(v);
              }}
              placeholder="Or tell me anything else I should always do..."
              example={'e.g. "Always ask if this has happened before."'}
            />
          </TeachingTurn>

          <TeachingTurn
            delay={0.15}
            learned={rules.size > 0 || rulesNotes.length > 0}
            question={rules.size > 0 ? "These are the house rules I never break — anything else?" : "Are there things I should never get wrong?"}
          >
            <OptionChips options={RULE_OPTIONS} selected={rules} onToggle={(id) => toggle(rules, setRules, id, ACK.useNextTime)} />
            <OwnWordsInput
              value={rulesNotes}
              onChange={(v) => {
                ackRef.current = ACK.useNextTime;
                setRulesNotes(v);
              }}
              placeholder="Or tell me a house rule in your own words..."
              example={'e.g. "Never agree to same-day emergency call-outs after 6pm."'}
            />
          </TeachingTurn>

          <TeachingTurn
            delay={0.2}
            learned={escalation.size > 0 || escalationNotes.length > 0}
            question={escalation.size > 0 ? "I'll come straight to you in these situations — anything to add?" : "When should I stop and come get you?"}
          >
            <OptionChips options={ESCALATION_OPTIONS} selected={escalation} onToggle={(id) => toggle(escalation, setEscalation, id, ACK.gotIt)} />
            <OwnWordsInput
              value={escalationNotes}
              onChange={(v) => {
                ackRef.current = ACK.gotIt;
                setEscalationNotes(v);
              }}
              placeholder="Or tell me another situation I should hand straight to you..."
              example={'e.g. "Come get me if someone mentions an insurance claim."'}
            />
          </TeachingTurn>
        </div>
      </div>
    </div>
  );
}

/**
 * One turn of her teaching conversation: her avatar, her question (a
 * received-message bubble), and the quick-reply options beneath it —
 * the same chip/pill interactions as before, in a chat container
 * instead of a titled settings card. The small check badge marks a
 * topic she's already learned something about.
 */
function TeachingTurn({
  question,
  delay,
  learned,
  children,
}: {
  question: string;
  delay: number;
  learned: boolean;
  children: ReactNode;
}) {
  return (
    <SettleCard delay={delay} className="flex items-start gap-2.5">
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
        <Headset className="h-[15px] w-[15px]" />
        {learned && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-background"
          >
            <Check className="h-2 w-2" strokeWidth={3.5} />
          </motion.span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-[13.5px] leading-relaxed">
          {question}
        </div>
        {children}
      </div>
    </SettleCard>
  );
}

/**
 * "Or tell me in your own words" — every teaching topic accepts free
 * text alongside its chips, not instead of them (Receptionist V3.1:
 * she should learn custom rules beyond the predefined options). The
 * small purple dot marks this as a "learning" moment in the same
 * semantic-colour vocabulary as the preview's status pills.
 */
function OwnWordsInput({
  value,
  onChange,
  placeholder,
  example,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  example: string;
}) {
  return (
    <div className="space-y-1.5 pt-0.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-600">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
        Or tell me in your own words
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="min-h-[64px] text-[13px]"
      />
      <p className="text-[11.5px] text-muted-foreground">{example}</p>
    </div>
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
