"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Briefcase, Check, Headset, ListChecks, ShieldCheck, Smile, Zap, type LucideIcon } from "lucide-react";
import { SettleCard, GentleSwap, press } from "@/components/shared/motion";
import { Acknowledgement, ACK, randomAck, useAcknowledgement } from "@/components/shared/acknowledgement";
import { PhonePreview } from "@/components/shared/phone-preview";
import { TeachingCard } from "@/components/shared/teaching-card";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import { InsightList } from "@/components/shared/insight";
import { buildBrain } from "@/lib/intelligence";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  BEHAVIOUR_OPTIONS,
  RULE_OPTIONS,
  ESCALATION_OPTIONS,
  scenariosForTrade,
  parseOptions,
  composeOptions,
  buildPreviewConversation,
  deriveScenarioStatus,
  type Tone,
  type TeachingOption,
} from "@/lib/receptionist";
import type { Availability } from "@/lib/availability";
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

type TopicId = "behaviours" | "rules" | "escalation";

/** One-line collapsed summary in her voice — labels she's already
 * ticked, plus any free-text notes, never the raw persisted string. */
function summariseTopic(selected: Set<string>, notes: string, options: readonly TeachingOption[]): string | null {
  const parts = [...options.filter((o) => selected.has(o.id)).map((o) => o.label)];
  if (notes.trim()) parts.push(notes.trim());
  if (parts.length === 0) return null;
  return parts.length <= 2 ? parts.join(", ") : `${parts.slice(0, 2).join(", ")} + ${parts.length - 2} more`;
}

const TONES: { value: Tone; label: string; description: string; icon: LucideIcon; accent: string }[] = [
  { value: "friendly", label: "Friendly", description: "Warm and personal", icon: Smile, accent: "bg-purple-500 shadow-purple-500/25" },
  { value: "professional", label: "Professional", description: "Polished and courteous", icon: Briefcase, accent: "bg-blue-600 shadow-blue-600/25" },
  { value: "concise", label: "Concise", description: "Short and to the point", icon: Zap, accent: "bg-slate-700 shadow-slate-700/25" },
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
  trade,
  offersEmergency,
  chargesCalloutFee,
  calloutFeeAmount,
  availability,
  receptionistName,
  initial,
  justHired,
  initialTopic = null,
}: {
  businessId: string;
  businessName: string;
  trade: string | null;
  offersEmergency: boolean;
  chargesCalloutFee: boolean;
  calloutFeeAmount: string | null;
  availability: Availability;
  receptionistName: string | null;
  initial: SavedConfig;
  justHired: boolean;
  /** Sprint 8.6: set when arriving from a Recommendations "Teach me"
   * link (?topic=) — see the identical pattern and rationale in
   * business-memory.tsx. Already validated by the Server Component page. */
  initialTopic?: string | null;
}) {
  const supabase = createClient();
  const scenarios = useMemo(() => scenariosForTrade(trade), [trade]);
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
  const [scenarioId, setScenarioId] = useState<string>(scenarios[0]?.id ?? "problem");

  // She leads the interview: only the next thing she doesn't know yet
  // is open. Behaviours, rules, and escalation are asked one at a
  // time — not three permanent panels — and once every topic here is
  // taught, the default view becomes a compact, browsable summary
  // (all three collapsed, tap any to reopen). Tone stays permanently
  // visible above these: it always has a value, so it's never part of
  // the "what don't I know yet" queue. Driven by the same shared Brain
  // (lib/intelligence.ts) Business Knowledge and Front Desk read from
  // — this used to be a wholly separate, locally-computed concept.
  const brain = buildBrain({
    receptionist: {
      behavioursTaught: behaviours.size > 0 || behavioursNotes.length > 0,
      rulesTaught: rules.size > 0 || rulesNotes.length > 0,
      escalationTaught: escalation.size > 0 || escalationNotes.length > 0,
    },
  });
  const receptionistTopics = brain.topics.filter((t) => t.domain === "receptionist");
  const topicDone = (id: TopicId): boolean => receptionistTopics.find((t) => t.id === id)?.done ?? false;
  const nextTopicId = (brain.gaps.find((g) => g.domain === "receptionist")?.id as TopicId | undefined) ?? null;
  const [open, setOpen] = useState<TopicId | null>((initialTopic as TopicId | null) ?? null);
  const prevNextTopicId = useRef<TopicId | null | undefined>(undefined);
  // Typing the very first character into a topic's own-words field
  // flips that topic from "not taught" to "taught" mid-keystroke,
  // which used to auto-collapse the card the owner was actively
  // typing in — unmounting the field and losing focus/cursor after
  // one character. While a field is focused, defer the advance;
  // catch up on blur instead, once the owner has actually finished.
  const typingRef = useRef(false);
  useEffect(() => {
    if (prevNextTopicId.current === undefined) {
      if (!initialTopic) setOpen(nextTopicId);
    } else if (nextTopicId !== prevNextTopicId.current && !typingRef.current) {
      setOpen((current) => (current === prevNextTopicId.current ? nextTopicId : current));
    }
    prevNextTopicId.current = nextTopicId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextTopicId]);

  function handleNotesFocus() {
    typingRef.current = true;
  }
  function handleNotesBlur() {
    typingRef.current = false;
    setOpen((current) => (nextTopicId && current !== nextTopicId ? nextTopicId : current));
  }

  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0]!;
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
    scenario,
    { availability }
  );
  const status = deriveScenarioStatus(scenario, { escalation });

  /* ------------------------- quiet persistence ------------------------- */
  // Debounced upsert: the owner never presses Save; the receptionist
  // simply remembers. First render never writes.
  const firstRender = useRef(true);
  const ackRef = useRef<string>(ACK.remember);
  // Bug fix: two edits close together (e.g. tapping Tone right after
  // editing a notes field) can leave two saves in flight at once. If
  // they resolve out of order, an older, slower request could finish
  // last and show its own result — sometimes a stale, misleading
  // "trouble saving" — even though the newest edit actually saved
  // fine. requestId makes only the most recent save allowed to touch
  // the acknowledgement UI; anything older is silently ignored.
  const requestId = useRef(0);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const thisRequest = ++requestId.current;
      startSaving();
      try {
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
        if (thisRequest !== requestId.current) return;
        if (error) softError();
        else acknowledge(ackRef.current);
      } catch {
        // A thrown exception (network blip, client error) never
        // reaches this UI as a false "nothing happened" silence — it
        // gets the same honest, recoverable message as a resolved
        // Supabase error.
        if (thisRequest === requestId.current) softError();
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tone, toneNotes, behaviours, behavioursNotes, rules, rulesNotes, escalation, escalationNotes]);

  // A real, rare celebration — not another reassurance on every edit.
  // ackRef is read lazily by the debounced save above when its timeout
  // fires, so setting it here (synchronously, in the same render pass
  // as the edit that crossed the threshold) reliably overrides that
  // save's routine acknowledgement for this one milestone moment.
  const receptionistPercent = brain.percentFor("receptionist");
  const celebratedPercentRef = useRef(receptionistPercent);
  useEffect(() => {
    const prev = celebratedPercentRef.current;
    if (prev < 100 && receptionistPercent >= 100) {
      ackRef.current = "I know exactly how you like things run.";
    } else if (prev < 50 && receptionistPercent >= 50) {
      ackRef.current = "Getting there — I'm learning how you like things run.";
    }
    celebratedPercentRef.current = receptionistPercent;
  }, [receptionistPercent]);

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
            ? receptionistName
              ? `I'm ${receptionistName}, your new receptionist. Teach me how you like things done — I'll show you exactly how I'll speak to your customers.`
              : "I'm your new receptionist. Teach me how you like things done — I'll show you exactly how I'll speak to your customers."
            : "Let's make sure I'm ready for today's customers."}
        </p>
      </SettleCard>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px] lg:items-start">
        {/* The live phone — the hero. First on mobile (never buried
         * below teaching), sticky in the right column on desktop. */}
        <div className="lg:order-2 lg:sticky lg:top-2 lg:self-start">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {scenarios.map((s) => (
              <motion.button
                key={s.id}
                {...press}
                type="button"
                onClick={() => setScenarioId(s.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-all",
                  scenarioId === s.id
                    ? "bg-purple-500 text-white shadow-sm shadow-purple-500/25"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground"
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
        <div className="min-w-0 space-y-5 lg:order-1">
          {/* Growth, made persistent rather than a one-off toast — and
           * whatever the Brain (lib/intelligence.ts) is thinking right
           * now, in the exact same voice Front Desk already uses. This
           * page only ever passes its own domain in, so it only ever
           * claims to know its own domain — never Business Knowledge's
           * or the diary's. */}
          <SettleCard delay={0.03} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <ConfidenceBar
              title="How well I know your style"
              percent={receptionistPercent}
              caption={`${receptionistPercent}% of how you like things run`}
            />
            <InsightList observations={brain.observations} limit={1} className="mt-3.5" />
          </SettleCard>

          <TeachingTurn delay={0.05} question="How should I sound when I answer?" learned>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => {
                const on = tone === t.value;
                const Icon = t.icon;
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
                      "flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] transition-all",
                      on
                        ? cn("text-white shadow-sm", t.accent)
                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span className={on ? "font-semibold" : "font-medium"}>{t.label}</span>
                  </motion.button>
                );
              })}
            </div>
            <p className="text-[11.5px] italic text-muted-foreground">
              {tone === "professional" && "“Hello, thanks for contacting your business. How can we help today?”"}
              {tone === "concise" && "“Your business here — what's the issue?”"}
              {tone === "friendly" && "“Hi there! Thanks for getting in touch. How can I help?”"}
            </p>
            <OwnWordsInput
              value={toneNotes}
              onChange={(v) => {
                ackRef.current = ACK.updated;
                setToneNotes(v);
              }}
              label="Describe my personality more specifically"
              placeholder="What should I sound like beyond friendly, professional, or concise?"
              example={'e.g. "Talk like a friendly Yorkshire tradesman — casual, not corporate."'}
            />
          </TeachingTurn>

          <TeachingCard
            index={1}
            icon={ListChecks}
            avatarClass="bg-purple-100 text-purple-600"
            bubbleClass="bg-purple-50/70"
            question={
              behaviours.size > 0
                ? "Here's what I do when someone gets in touch — anything to add?"
                : "What should I always do when someone gets in touch?"
            }
            known={topicDone("behaviours")}
            summary={summariseTopic(behaviours, behavioursNotes, BEHAVIOUR_OPTIONS)}
            open={open === "behaviours"}
            onToggle={() => setOpen(open === "behaviours" ? null : "behaviours")}
          >
            <OptionChips options={BEHAVIOUR_OPTIONS} selected={behaviours} onToggle={(id) => toggle(behaviours, setBehaviours, id, randomAck())} />
            <OwnWordsInput
              value={behavioursNotes}
              onChange={(v) => {
                ackRef.current = randomAck();
                setBehavioursNotes(v);
              }}
              label="Add a habit that's not listed above"
              placeholder="What should I always do that isn't covered by those options?"
              example={'e.g. "Always ask if this has happened before."'}
              onFocus={handleNotesFocus}
              onBlur={handleNotesBlur}
            />
          </TeachingCard>

          <TeachingCard
            index={2}
            icon={ShieldCheck}
            avatarClass="bg-slate-200 text-slate-700"
            bubbleClass="bg-slate-100"
            question={rules.size > 0 ? "These are the house rules I never break — anything else?" : "Are there things I should never get wrong?"}
            known={topicDone("rules")}
            summary={summariseTopic(rules, rulesNotes, RULE_OPTIONS)}
            open={open === "rules"}
            onToggle={() => setOpen(open === "rules" ? null : "rules")}
          >
            <RuleList options={RULE_OPTIONS} selected={rules} onToggle={(id) => toggle(rules, setRules, id, randomAck())} />
            <OwnWordsInput
              value={rulesNotes}
              onChange={(v) => {
                ackRef.current = randomAck();
                setRulesNotes(v);
              }}
              label="Add a rule that's not listed above"
              placeholder="What's a hard rule I should never break?"
              example={'e.g. "Never agree to same-day emergency call-outs after 6pm."'}
              onFocus={handleNotesFocus}
              onBlur={handleNotesBlur}
            />
          </TeachingCard>

          <TeachingCard
            index={3}
            icon={AlertTriangle}
            avatarClass="bg-amber-100 text-amber-700"
            bubbleClass="bg-amber-50"
            className="border-amber-200/70"
            question={escalation.size > 0 ? "I'll come straight to you in these situations — anything to add?" : "When should I stop and come get you?"}
            known={topicDone("escalation")}
            summary={summariseTopic(escalation, escalationNotes, ESCALATION_OPTIONS)}
            open={open === "escalation"}
            onToggle={() => setOpen(open === "escalation" ? null : "escalation")}
          >
            {!offersEmergency && (
              <p className="mb-3 rounded-lg bg-amber-100/60 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                You told me you don&apos;t take emergency call-outs — I already won&apos;t promise a visit. This is just about
                which situations are still serious enough to bring you in personally.
              </p>
            )}
            <OptionChips options={ESCALATION_OPTIONS} selected={escalation} onToggle={(id) => toggle(escalation, setEscalation, id, randomAck())} accent="amber" />
            <OwnWordsInput
              value={escalationNotes}
              onChange={(v) => {
                ackRef.current = randomAck();
                setEscalationNotes(v);
              }}
              label="Add a situation that's not listed above"
              placeholder="When else should I stop and bring you in personally?"
              example={'e.g. "Come get me if someone mentions an insurance claim."'}
              onFocus={handleNotesFocus}
              onBlur={handleNotesBlur}
            />
          </TeachingCard>
        </div>
      </div>
    </div>
  );
}

type TurnAccent = "warm" | "slate" | "amber";

/** Receptionist's own personality is warm/conversational (Visual
 * Language: each section has its own subtle voice) — purple, not the
 * app's usual blue. Rules get a firmer slate tone; escalation gets
 * amber, the same "hand this to the owner" colour used everywhere
 * else in the product, so its meaning is consistent, not decorative. */
const TURN_ACCENT: Record<TurnAccent, { avatar: string; bubble: string }> = {
  warm: { avatar: "bg-purple-100 text-purple-600", bubble: "bg-purple-50/70" },
  slate: { avatar: "bg-slate-200 text-slate-700", bubble: "bg-slate-100" },
  amber: { avatar: "bg-amber-100 text-amber-700", bubble: "bg-amber-50" },
};

/**
 * One turn of her teaching conversation: her avatar, her question (a
 * received-message bubble), and the quick-reply options beneath it —
 * the same chip/pill interactions as before, in a chat container
 * instead of a titled settings card. The small check badge marks a
 * topic she's already learned something about. `boxed` gives a turn
 * its own bordered moment rather than sitting flush with the page —
 * reserved for escalation, the one topic that's genuinely a different
 * kind of decision than the others.
 */
function TeachingTurn({
  question,
  delay,
  learned,
  accent = "warm",
  boxed = false,
  children,
}: {
  question: string;
  delay: number;
  learned: boolean;
  accent?: TurnAccent;
  boxed?: boolean;
  children: ReactNode;
}) {
  const style = TURN_ACCENT[accent];
  return (
    <SettleCard
      delay={delay}
      className={cn(
        "flex items-start gap-2.5",
        boxed && "rounded-2xl border border-amber-200/70 bg-amber-50/30 p-3.5"
      )}
    >
      <div className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full", style.avatar)}>
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
        <div className={cn("inline-block max-w-full rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13.5px] leading-relaxed", style.bubble)}>
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
  label,
  placeholder,
  example,
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  example: string;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <div className="space-y-1.5 pt-0.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-600">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
        {label}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={2}
        className="min-h-[64px] text-[13px]"
      />
      <p className="text-[11.5px] text-muted-foreground">{example}</p>
    </div>
  );
}

const CHIP_ACCENT: Record<TurnAccent, string> = {
  warm: "bg-purple-500 shadow-purple-500/25",
  slate: "bg-slate-600 shadow-slate-600/25",
  amber: "bg-amber-500 shadow-amber-500/25",
};

function OptionChips({
  options,
  selected,
  onToggle,
  accent = "warm",
}: {
  options: readonly TeachingOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  accent?: TurnAccent;
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
              "flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] transition-all",
              on
                ? cn("text-white shadow-sm", CHIP_ACCENT[accent])
                : "border border-border bg-card font-medium text-muted-foreground hover:text-foreground"
            )}
          >
            {on && <Check className="h-3 w-3" strokeWidth={3} />}
            <span className={on ? "font-semibold" : undefined}>{option.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/**
 * House rules get a different rhythm on purpose — a checklist, not a
 * row of chips. Rules are firmer than a casual preference, so tapping
 * feels like ticking a policy, not picking a vibe.
 */
function RuleList({
  options,
  selected,
  onToggle,
}: {
  options: readonly TeachingOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      {options.map((option, i) => {
        const on = selected.has(option.id);
        return (
          <motion.button
            key={option.id}
            {...press}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(option.id)}
            className={cn(
              "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[12.5px] transition-colors",
              i > 0 && "border-t border-slate-200",
              on ? "bg-slate-100 font-semibold text-slate-800" : "bg-card text-muted-foreground hover:bg-slate-50"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                on ? "border-slate-600 bg-slate-600 text-white" : "border-border"
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
