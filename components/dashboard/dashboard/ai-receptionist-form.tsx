"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { aiConfigurationSchema, type AiConfigurationInput } from "@/lib/validations/ai-configuration";
import { GREETING_STYLES } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Local to this component on purpose — none of this lives in
 * lib/constants.ts. Each entry's `text` is the exact string inserted
 * into system_prompt / business_rules / escalation_rules on save, so
 * the database schema and save logic never change — only how the user
 * produces those strings does. These same arrays are also the ONLY
 * source the live preview reads from (see deriveSignals / buildPreviewReply
 * below) — there is no second copy of "what each toggle means" anywhere
 * in this file.
 */
const QUICK_SELECT_BEHAVIORS = [
  { id: "ask-problem", label: "Ask customers what the problem is", text: "Ask the customer what the problem is." },
  { id: "ask-postcode", label: "Ask for postcode", text: "Ask for their postcode." },
  { id: "ask-photos", label: "Ask for photos", text: "Ask if they can send a photo of the issue." },
  { id: "mention-emergency", label: "Mention emergency call-outs", text: "Mention that emergency call-outs are available if it's urgent." },
  { id: "be-friendly", label: "Be friendly", text: "Keep the tone warm and friendly throughout." },
  { id: "short-replies", label: "Keep replies short", text: "Keep replies short and easy to read on a phone." },
  { id: "mention-hours", label: "Mention opening hours", text: "Mention the business's opening hours if it's relevant." },
  { id: "someone-will-contact", label: "Tell customers someone will contact them", text: "Let the customer know a team member will be in touch soon." },
] as const;

const BUSINESS_RULE_OPTIONS = [
  { id: "no-exact-prices", label: "Never give exact prices", text: "Never give exact prices over chat — say the team will confirm pricing after a quick look." },
  { id: "no-arrival-times", label: "Never promise arrival times", text: "Never promise a specific arrival time — say the team will confirm timing." },
  { id: "mention-callout-fee", label: "Always mention call-out fee", text: "Always mention the call-out fee upfront if the business charges one." },
  { id: "always-ask-photos", label: "Always ask for photos", text: "Always ask for a photo of the issue before finishing the conversation." },
  { id: "offer-emergency", label: "Offer emergency service", text: "Offer emergency service for urgent issues." },
  { id: "mention-hours", label: "Mention business hours", text: "Mention business hours when relevant to the customer's question." },
] as const;

const ESCALATION_OPTIONS = [
  { id: "gas-leak", label: "Gas leak", text: "Hand off immediately if the customer mentions a gas leak." },
  { id: "flooding", label: "Flooding", text: "Hand off immediately if there's flooding or major water damage." },
  { id: "wants-person", label: "Customer asks for a person", text: "Hand off if the customer directly asks to speak to a person." },
  { id: "complaint", label: "Complaint", text: "Hand off if the customer is making a complaint." },
  { id: "payment-dispute", label: "Payment dispute", text: "Hand off if there's a payment dispute." },
  { id: "emergency", label: "Emergency", text: "Hand off if the situation sounds like a genuine emergency." },
] as const;

const SUGGESTED_FAQS = [
  "Do you offer weekend call-outs?",
  "How much is the call-out fee?",
  "What areas do you cover?",
] as const;

/**
 * Pool of realistic customer openers, grouped by which "shape" of
 * reply they call for. Grouping (not the individual messages) is what
 * decides whether the preview keeps the current message or rotates —
 * see pickTier / the rotation effect below.
 */
const MESSAGE_POOL = {
  problem: ["My boiler isn't working.", "My toilet won't flush.", "I've got a leak under the sink."],
  quote: ["Can someone give me a quote?"],
  emergency: ["It's an emergency."],
  photos: ["I've attached some photos."],
  postcode: ["Do you cover my postcode?"],
  fee: ["How much is your call-out fee?"],
  hours: ["Do you work weekends?", "Can someone come tomorrow?"],
} as const;

type MessageTier = keyof typeof MESSAGE_POOL;

type PresetOption = { id: string; text: string };

/** Reverse-detects which toggles were "on" from a saved plain-text
 * string, so switching from free-text to toggles never loses data
 * saved before this redesign. Unmatched leftover text becomes the
 * "notes" field rather than being dropped. */
function parseOptions(saved: string, options: readonly PresetOption[]) {
  const selected = new Set<string>();
  let remainder = saved;
  for (const option of options) {
    if (remainder.includes(option.text)) {
      selected.add(option.id);
      remainder = remainder.replace(option.text, "");
    }
  }
  return { selected, notes: remainder.replace(/^\s*\n+|\n+\s*$/g, "").trim() };
}

/** The single function that turns toggle state into the string that
 * actually gets saved to Supabase. */
function composeFromOptions(options: readonly PresetOption[], selectedIds: Set<string>, notes: string) {
  return [...options.filter((o) => selectedIds.has(o.id)).map((o) => o.text), notes.trim()].filter(Boolean).join("\n");
}

function hasOption(composedText: string, options: readonly PresetOption[], id: string) {
  const option = options.find((o) => o.id === id);
  return Boolean(option && composedText.includes(option.text));
}

function getProgressCopy(completed: number) {
  if (completed >= 5) return "Ready to save";
  if (completed === 4) return "Almost done";
  if (completed >= 2) return "Halfway there";
  return "Great start";
}

function truncate(text: string, max: number) {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trim()}…` : trimmed;
}

/**
 * Every fact the preview (and the tier picker) needs, computed exactly
 * once per change from the composed strings — the same values that get
 * saved. Both buildPreviewReply and pickTier read from this single
 * object instead of each re-scanning the composed strings themselves,
 * which is what keeps this "no duplicated logic."
 */
function deriveSignals(systemPrompt: string, businessRules: string, escalationRules: string) {
  const behaviorNotes = parseOptions(systemPrompt, QUICK_SELECT_BEHAVIORS).notes;
  const ruleNotes = parseOptions(businessRules, BUSINESS_RULE_OPTIONS).notes;
  const escalationNotes = parseOptions(escalationRules, ESCALATION_OPTIONS).notes;

  const wantsPostcode = hasOption(systemPrompt, QUICK_SELECT_BEHAVIORS, "ask-postcode");
  const wantsPhotos = hasOption(systemPrompt, QUICK_SELECT_BEHAVIORS, "ask-photos");
  const wantsProblem = hasOption(systemPrompt, QUICK_SELECT_BEHAVIORS, "ask-problem");
  const mentionsEmergency = hasOption(systemPrompt, QUICK_SELECT_BEHAVIORS, "mention-emergency");
  const mentionsHours = hasOption(systemPrompt, QUICK_SELECT_BEHAVIORS, "mention-hours");
  const willContact = hasOption(systemPrompt, QUICK_SELECT_BEHAVIORS, "someone-will-contact");

  const ruleMentionFee = hasOption(businessRules, BUSINESS_RULE_OPTIONS, "mention-callout-fee");
  const ruleOfferEmergency = hasOption(businessRules, BUSINESS_RULE_OPTIONS, "offer-emergency");

  const escalationUrgent =
    hasOption(escalationRules, ESCALATION_OPTIONS, "emergency") ||
    hasOption(escalationRules, ESCALATION_OPTIONS, "gas-leak") ||
    hasOption(escalationRules, ESCALATION_OPTIONS, "flooding");

  return {
    behaviorNotes,
    ruleNotes,
    escalationNotes,
    wantsPostcode,
    wantsPhotos,
    wantsProblem,
    mentionsEmergency,
    mentionsHours,
    willContact,
    ruleMentionFee,
    ruleOfferEmergency,
    isUrgent: mentionsEmergency && (escalationUrgent || ruleOfferEmergency),
  };
}

type Signals = ReturnType<typeof deriveSignals>;

/** Picks which "shape" of customer message the preview should be
 * showing right now. Whether the displayed message actually changes to
 * match is decided separately (see the rotation effect) — this only
 * says what would be ideal. */
function pickTier(signals: Signals): MessageTier {
  if (signals.isUrgent) return "emergency";
  if (signals.ruleMentionFee) return "fee";
  if (signals.wantsPhotos) return "photos";
  if (signals.wantsPostcode) return "postcode";
  if (signals.mentionsHours) return "hours";
  return "problem";
}

/** Appends any freeform notes onto a reply, verbatim but capped — this
 * is what makes notes "visibly influence" the preview per the redesign
 * brief, instead of silently vanishing into a saved string nobody sees
 * again. Reads notes straight from `signals`, i.e. from the same
 * composed strings that get saved — never from separate raw state. */
function appendNotes(base: string, signals: Signals) {
  const extras = [signals.behaviorNotes, signals.ruleNotes, signals.escalationNotes]
    .filter(Boolean)
    .map((n) => truncate(n, 70));
  return [base, ...extras].filter(Boolean).join(" ");
}

/**
 * Builds the preview reply purely from `signals` (itself derived only
 * from the composed strings that get saved) plus tone, the current
 * message tier, and live FAQ answers. Tier-aware so the acknowledgment
 * actually matches what the customer said, instead of always talking
 * about a boiler no matter the question.
 */
function buildPreviewReply(tier: MessageTier, tone: AiConfigurationInput["tone"], signals: Signals, faqs: AiConfigurationInput["faqs"]): string {
  const feeFaq = faqs.find((f) => /call.?out fee/i.test(f.question) && f.answer.trim().length > 0);
  const areaFaq = faqs.find((f) => /area|postcode|cover/i.test(f.question) && f.answer.trim().length > 0);

  if (tier === "emergency") {
    const ack = tone === "professional" ? "We understand — this sounds urgent." : tone === "concise" ? "Understood, urgent." : "That sounds urgent!";
    const handoff = signals.mentionsEmergency
      ? tone === "professional"
        ? "We're flagging this to our team immediately."
        : "Flagging this to the team right now! 🚨"
      : "Please call us directly if it's dangerous.";
    return appendNotes([ack, handoff].join(" "), signals);
  }

  if (tier === "fee") {
    const ack = tone === "professional" ? "Thank you for asking." : tone === "concise" ? "Sure —" : "Good question!";
    const answer = feeFaq
      ? feeFaq.answer.trim()
      : signals.ruleMentionFee
      ? "There's a small call-out fee, which we'll always confirm first."
      : "Let us check and get straight back to you on that.";
    return appendNotes([ack, answer].join(" "), signals);
  }

  if (tier === "postcode") {
    const ack = tone === "professional" ? "Thank you for checking." : tone === "concise" ? "Checking —" : "Good question!";
    const answer = areaFaq ? areaFaq.answer.trim() : "Yes, that's within our coverage area!";
    return appendNotes([ack, answer].join(" "), signals);
  }

  if (tier === "hours") {
    const ack = tone === "professional" ? "Thank you for reaching out." : tone === "concise" ? "Checking —" : "Good question!";
    const answer = signals.mentionsHours
      ? "We're open now and taking messages."
      : "Let us check the schedule and get back to you.";
    return appendNotes([ack, answer].join(" "), signals);
  }

  if (tier === "photos") {
    const ack = tone === "professional" ? "Thank you for sharing those." : tone === "concise" ? "Received, thanks." : "Thanks for sending those over!";
    const follow = signals.wantsPostcode ? "Can you also send your postcode?" : "";
    return appendNotes([ack, follow].filter(Boolean).join(" "), signals);
  }

  if (tier === "quote") {
    const ack = tone === "professional" ? "Happy to help with that." : tone === "concise" ? "Sure —" : "Happy to help!";
    const asks: string[] = [];
    if (signals.wantsProblem) asks.push("a few details about the job");
    if (signals.wantsPostcode) asks.push("your postcode");
    if (signals.wantsPhotos) asks.push("a photo if you have one");
    const askLine = asks.length > 0 ? `Could you send over ${asks.join(", ")}?` : "";
    return appendNotes([ack, askLine].filter(Boolean).join(" "), signals);
  }

  // tier === "problem" — the original boiler/toilet/leak style enquiry
  const opener = tone === "professional" ? "Thank you for getting in touch." : tone === "concise" ? "" : "Hi 👋";
  const sorry = tone === "professional" ? "We're sorry to hear you're having trouble." : tone === "concise" ? "Got it." : "Sorry to hear that!";

  const asks: string[] = [];
  if (signals.wantsPostcode) asks.push("your postcode");
  if (signals.wantsPhotos) asks.push("a photo of the issue");
  if (signals.wantsProblem && asks.length === 0) asks.push("a few more details");

  const askLine =
    asks.length === 0
      ? ""
      : tone === "professional"
      ? `Could you please provide ${asks.join(" and ")}?`
      : tone === "concise"
      ? `Send ${asks.join(" + ")}?`
      : `Can you send ${asks.join(" and ")}?`;

  const feeLine = !signals.ruleMentionFee ? "" : feeFaq ? feeFaq.answer.trim() : "There's a small call-out fee, which we'll always confirm first.";
  const hoursLine = signals.mentionsHours ? "We're open now and taking messages." : "";
  const closingLine =
    !(signals.willContact || asks.length > 0)
      ? ""
      : tone === "professional"
      ? "A member of our team will review this and respond as soon as possible."
      : tone === "concise"
      ? "Team will follow up shortly."
      : "One of our team will review it as soon as possible.";

  const reply = [opener, sorry, askLine, feeLine, hoursLine, closingLine].filter(Boolean).join(" ");
  return appendNotes(reply || "Hi 👋 Thanks for reaching out — how can we help?", signals);
}

interface ToggleSectionProps {
  title: string;
  subtitle: string;
  options: readonly { id: string; label: string; text: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  notesId: string;
  notesLabel: string;
  notesPlaceholder: string;
  notesHelperText: string;
  inlineMessage?: string | null;
}

/** Shared layout for Sections 2, 3, and 4 — same toggle-grid-plus-notes
 * pattern three times, so spacing and interaction stay identical
 * across all of them (visual consistency principle). */
function ToggleSection({
  title,
  subtitle,
  options,
  selected,
  onToggle,
  notes,
  onNotesChange,
  notesId,
  notesLabel,
  notesPlaceholder,
  notesHelperText,
  inlineMessage,
}: ToggleSectionProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-sm">
      <h2 className="mb-1 text-[15px] font-bold tracking-tight">{title}</h2>
      <p className="mb-5 text-[13px] text-muted-foreground">{subtitle}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const active = selected.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onToggle(option.id)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3.5 text-left text-[13.5px] transition-all duration-150 active:scale-[0.98]",
                active
                  ? "border-primary bg-accent font-medium"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200",
                  active ? "justify-end bg-primary" : "justify-start bg-border"
                )}
              >
                <motion.span
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="m-0.5 h-4 w-4 rounded-full bg-white shadow"
                />
              </span>
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-1.5">
        <Label htmlFor={notesId}>
          {notesLabel} <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id={notesId}
          placeholder={notesPlaceholder}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="min-h-[70px] transition-shadow"
        />
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">{notesHelperText}</p>
      </div>

      <AnimatePresence>
        {inlineMessage && (
          <motion.p
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-lg bg-accent px-3.5 py-2.5 text-[13px] font-medium text-primary"
          >
            {inlineMessage}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Three bouncing dots — the only "typing" affordance besides the
 * character reveal, kept deliberately quiet. */
function TypingIndicator() {
  return (
    <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm bg-card px-4 py-3 shadow-sm">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50"
          style={{ animationDelay: `${i * 120}ms`, animationDuration: "900ms" }}
        />
      ))}
    </div>
  );
}

/**
 * Sequenced, cancelable message preview: typing indicator -> character
 * reveal -> done. Driven entirely by `targetText` — every time it
 * changes, React runs the previous effect's cleanup (clearing any
 * in-flight timer) before starting the new sequence, so old text can
 * never keep typing itself after a change.
 */
function useTypedMessage(targetText: string) {
  const [phase, setPhase] = useState<"indicator" | "typing" | "done">("indicator");
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    setPhase("indicator");
    setVisibleLength(0);
    const indicatorDelay = setTimeout(() => setPhase("typing"), 450);
    return () => clearTimeout(indicatorDelay);
  }, [targetText]);

  useEffect(() => {
    if (phase !== "typing") return;
    if (targetText.length === 0) {
      setPhase("done");
      return;
    }
    const totalDurationMs = Math.min(1600, Math.max(1000, targetText.length * 16));
    const stepMs = Math.max(10, totalDurationMs / targetText.length);
    let revealed = 0;
    const interval = setInterval(() => {
      revealed += 1;
      setVisibleLength(revealed);
      if (revealed >= targetText.length) {
        clearInterval(interval);
        setPhase("done");
      }
    }, stepMs);
    return () => clearInterval(interval);
  }, [phase, targetText]);

  return {
    isTyping: phase === "indicator",
    displayText: phase === "indicator" ? "" : targetText.slice(0, visibleLength),
  };
}

export function AiReceptionistForm({
  businessId,
  defaultValues,
}: {
  businessId: string;
  defaultValues: AiConfigurationInput;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);

  const initialBehaviors = useMemo(
    () => parseOptions(defaultValues.systemPrompt, QUICK_SELECT_BEHAVIORS),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const initialRules = useMemo(
    () => parseOptions(defaultValues.businessRules, BUSINESS_RULE_OPTIONS),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const initialEscalation = useMemo(
    () => parseOptions(defaultValues.escalationRules, ESCALATION_OPTIONS),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const seededFaqs = useMemo(
    () =>
      defaultValues.faqs.length > 0
        ? defaultValues.faqs
        : SUGGESTED_FAQS.map((question) => ({ question, answer: "" })),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [behaviorIds, setBehaviorIds] = useState<Set<string>>(initialBehaviors.selected);
  const [behaviorNotes, setBehaviorNotes] = useState(initialBehaviors.notes);
  const [ruleIds, setRuleIds] = useState<Set<string>>(initialRules.selected);
  const [ruleNotes, setRuleNotes] = useState(initialRules.notes);
  const [escalationIds, setEscalationIds] = useState<Set<string>>(initialEscalation.selected);
  const [escalationNotes, setEscalationNotes] = useState(initialEscalation.notes);

  const [behaviorsMessage, setBehaviorsMessage] = useState<string | null>(null);
  const [faqsMessage, setFaqsMessage] = useState<string | null>(null);

  const behaviorsRef = useRef<HTMLDivElement>(null);
  const faqsRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AiConfigurationInput>({
    resolver: zodResolver(aiConfigurationSchema),
    defaultValues: { ...defaultValues, faqs: seededFaqs },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "faqs" });
  const tone = watch("tone");
  const watchedFaqs = watch("faqs");

  function toggleSet(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setSet(next);
  }

  const composedSystemPrompt = useMemo(
    () => composeFromOptions(QUICK_SELECT_BEHAVIORS, behaviorIds, behaviorNotes),
    [behaviorIds, behaviorNotes]
  );
  const composedBusinessRules = useMemo(
    () => composeFromOptions(BUSINESS_RULE_OPTIONS, ruleIds, ruleNotes),
    [ruleIds, ruleNotes]
  );
  const composedEscalationRules = useMemo(
    () => composeFromOptions(ESCALATION_OPTIONS, escalationIds, escalationNotes),
    [escalationIds, escalationNotes]
  );

  useEffect(() => {
    setValue("systemPrompt", composedSystemPrompt, { shouldValidate: false });
  }, [composedSystemPrompt, setValue]);

  useEffect(() => {
    setValue("businessRules", composedBusinessRules, { shouldValidate: false });
  }, [composedBusinessRules, setValue]);

  useEffect(() => {
    setValue("escalationRules", composedEscalationRules, { shouldValidate: false });
  }, [composedEscalationRules, setValue]);

  const answeredFaqCount = (watchedFaqs ?? []).filter((f) => f?.answer && f.answer.trim().length >= 3).length;

  const stepsComplete = [
    true,
    behaviorIds.size > 0 || behaviorNotes.trim().length > 0,
    ruleIds.size > 0 || ruleNotes.trim().length > 0,
    escalationIds.size > 0 || escalationNotes.trim().length > 0,
    answeredFaqCount > 0,
  ];
  const completedCount = stepsComplete.filter(Boolean).length;

  // Every fact the preview needs, computed once from the composed
  // strings — reused by both the tier picker and the reply builder so
  // neither re-scans the toggle state independently.
  const signals = useMemo(
    () => deriveSignals(composedSystemPrompt, composedBusinessRules, composedEscalationRules),
    [composedSystemPrompt, composedBusinessRules, composedEscalationRules]
  );

  const idealTier = useMemo(() => pickTier(signals), [signals]);
  const [messageTier, setMessageTier] = useState<MessageTier>("problem");
  const [customerMessage, setCustomerMessage] = useState<string>(MESSAGE_POOL.problem[0]);

  // Only rotates the displayed customer message when the *shape* of
  // enquiry actually changes (e.g. toggling into an emergency
  // scenario) — toggling something that doesn't change the shape (say,
  // turning "be friendly" on/off) keeps the same customer message so
  // the user can directly compare replies to the same question.
  useEffect(() => {
    if (idealTier === messageTier) return;
    setMessageTier(idealTier);
    const pool = MESSAGE_POOL[idealTier];
    setCustomerMessage(pool[Math.floor(Math.random() * pool.length)] ?? pool[0]);
  }, [idealTier, messageTier]);

  const rawPreviewTarget = useMemo(
    () => buildPreviewReply(messageTier, tone, signals, watchedFaqs ?? []),
    [messageTier, tone, signals, watchedFaqs]
  );

  const [previewTarget, setPreviewTarget] = useState(rawPreviewTarget);
  useEffect(() => {
    const debounce = setTimeout(() => setPreviewTarget(rawPreviewTarget), 350);
    return () => clearTimeout(debounce);
  }, [rawPreviewTarget]);

  const { isTyping, displayText } = useTypedMessage(previewTarget);

  function handleInvalid(formErrors: FieldErrors<AiConfigurationInput>) {
    if (formErrors.faqs) {
      setFaqsMessage("Almost there — finish the questions you've started, or remove the ones you don't need.");
      faqsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function attemptSave() {
    if (savingRef.current) return;
    if (composedSystemPrompt.trim().length < 10) {
      setBehaviorsMessage("Almost there — tell ReplyFlow one sentence about your business, or tap a couple of options above.");
      behaviorsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBehaviorsMessage(null);
    setFaqsMessage(null);

    await handleSubmit(async (values) => {
      savingRef.current = true;
      setSubmitting(true);
      const { error } = await supabase.from("ai_configurations").upsert(
        {
          business_id: businessId,
          tone: values.tone,
          system_prompt: values.systemPrompt,
          business_rules: values.businessRules,
          escalation_rules: values.escalationRules,
          faqs: values.faqs,
        },
        { onConflict: "business_id" }
      );
      setSubmitting(false);
      savingRef.current = false;

      if (error) {
        toast({ variant: "destructive", title: "Couldn't save configuration", description: error.message });
        return;
      }
      toast({
        variant: "success",
        title: "Your AI receptionist is ready",
        description: "It'll use this from the next message onward.",
      });
      router.refresh();
    }, handleInvalid)();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void attemptSave();
      }}
      className="space-y-6"
      noValidate
    >
      {/* SECTION 6 — Progress */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold">AI Setup</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={getProgressCopy(completedCount)}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18 }}
              className="text-[13px] font-semibold text-primary"
            >
              {getProgressCopy(completedCount)}
            </motion.span>
          </AnimatePresence>
        </div>
        <Progress value={(completedCount / 5) * 100} />
      </div>

      {/* SECTION 1 — Tone */}
      <section className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-sm">
        <h2 className="mb-1 text-[15px] font-bold tracking-tight">How should it sound?</h2>
        <p className="mb-5 text-[13px] text-muted-foreground">Pick the tone that matches your business.</p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {GREETING_STYLES.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setValue("tone", g.value, { shouldDirty: true })}
              aria-pressed={tone === g.value}
              className={cn(
                "rounded-xl border p-3.5 text-left transition-all duration-150 active:scale-[0.98]",
                tone === g.value
                  ? "border-primary bg-accent"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
              )}
            >
              <p className="text-[13.5px] font-semibold">{g.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">&ldquo;{g.example}&rdquo;</p>
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 2 — quick-select behaviors */}
      <div ref={behaviorsRef}>
        <ToggleSection
          title="What should ReplyFlow do?"
          subtitle="Tap everything that applies — no writing required."
          options={QUICK_SELECT_BEHAVIORS}
          selected={behaviorIds}
          onToggle={(id) => toggleSet(behaviorIds, setBehaviorIds, id)}
          notes={behaviorNotes}
          onNotesChange={setBehaviorNotes}
          notesId="quickSelectNotes"
          notesLabel="Anything else ReplyFlow should know?"
          notesPlaceholder="e.g. we specialise in older properties"
          notesHelperText="ReplyFlow will remember this in every future conversation — and you'll see it reflected in the preview below."
          inlineMessage={behaviorsMessage}
        />
      </div>

      {/* SECTION 3 — Business Rules */}
      <ToggleSection
        title="Business rules"
        subtitle="Anything that should always apply."
        options={BUSINESS_RULE_OPTIONS}
        selected={ruleIds}
        onToggle={(id) => toggleSet(ruleIds, setRuleIds, id)}
        notes={ruleNotes}
        onNotesChange={setRuleNotes}
        notesId="businessRulesNotes"
        notesLabel="Optional notes"
        notesPlaceholder="e.g. standard jobs get booked within 3 working days"
        notesHelperText="These become permanent instructions for your AI — it will follow them in every conversation."
      />

      {/* SECTION 4 — Escalation Rules */}
      <ToggleSection
        title="When should it hand off to you?"
        subtitle="ReplyFlow stops and flags you immediately for any of these."
        options={ESCALATION_OPTIONS}
        selected={escalationIds}
        onToggle={(id) => toggleSet(escalationIds, setEscalationIds, id)}
        notes={escalationNotes}
        onNotesChange={setEscalationNotes}
        notesId="escalationNotes"
        notesLabel="Optional notes"
        notesPlaceholder="e.g. hand off for any job quoted over £500"
        notesHelperText="ReplyFlow will always check for this when deciding whether to bring you in."
      />

      {/* SECTION 5 — FAQs */}
      <div ref={faqsRef} className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight">Answers it already knows</h2>
            <p className="text-[13px] text-muted-foreground">Just fill in the answers — add or remove as needed.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ question: "", answer: "" })}>
            <Plus className="h-3.5 w-3.5" /> Add FAQ
          </Button>
        </div>

        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {fields.map((field, index) => (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-border p-4 transition-colors hover:border-muted-foreground/30">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`faqs.${index}.question`}>Question</Label>
                      <Input
                        id={`faqs.${index}.question`}
                        placeholder="Do you offer weekend call-outs?"
                        {...register(`faqs.${index}.question` as `faqs.${number}.question`)}
                      />
                      {errors.faqs?.[index]?.question && (
                        <p className="text-xs font-medium text-destructive">{errors.faqs[index]?.question?.message}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="mt-6 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove FAQ"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`faqs.${index}.answer`}>Answer</Label>
                    <Textarea
                      id={`faqs.${index}.answer`}
                      placeholder="Yes, emergency call-outs are available on weekends with a call-out fee."
                      {...register(`faqs.${index}.answer` as `faqs.${number}.answer`)}
                    />
                    {errors.faqs?.[index]?.answer && (
                      <p className="text-xs font-medium text-destructive">{errors.faqs[index]?.answer?.message}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {fields.length === 0 && (
          <button
            type="button"
            onClick={() => append({ question: "", answer: "" })}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-8 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Sparkles className="h-4 w-4" /> Add a question
          </button>
        )}

        <AnimatePresence>
          {faqsMessage && (
            <motion.p
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden rounded-lg bg-accent px-3.5 py-2.5 text-[13px] font-medium text-primary"
            >
              {faqsMessage}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* SECTION 7 — Live preview */}
      <section className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-sm">
        <h2 className="mb-1 text-[15px] font-bold tracking-tight">Preview</h2>
        <p className="mb-5 text-[13px] text-muted-foreground">
          Exactly how ReplyFlow will reply, based on everything you&apos;ve set up above.
        </p>

        <div className="space-y-3 rounded-2xl bg-muted/40 p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={customerMessage}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex justify-end"
            >
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-[13.5px] leading-relaxed text-primary-foreground">
                &ldquo;{customerMessage}&rdquo;
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex min-h-[42px] justify-start">
            <AnimatePresence mode="wait">
              {isTyping ? (
                <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <TypingIndicator />
                </motion.div>
              ) : (
                <motion.div
                  key="reply"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-[80%] rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm"
                >
                  {displayText}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <Button
        type="submit"
        variant="success"
        disabled={submitting}
        className="w-auto px-6 transition-transform active:scale-[0.98]"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Saving..." : "Save AI Receptionist"}
      </Button>
    </form>
  );
}
