"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
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
 * Local to this component on purpose — this redesign is scoped to a
 * single file, so none of this lives in lib/constants.ts. Each entry's
 * `text` is the exact string inserted into system_prompt / business_rules
 * / escalation_rules on save, so the database schema and save logic
 * never change — only how the user produces those strings does.
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
  "How quickly can someone come?",
  "Can I send photos?",
] as const;

/** Reverse-detects which toggles were "on" from a saved plain-text
 * string, so switching from free-text to toggles never loses data
 * saved before this redesign. Unmatched leftover text becomes the
 * "notes" field rather than being dropped. */
function parseOptions(saved: string, options: readonly { id: string; text: string }[]) {
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

interface ToggleSectionProps {
  title: string;
  subtitle: string;
  options: readonly { id: string; label: string; text: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  notesId: string;
  notesPlaceholder: string;
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
  notesPlaceholder,
}: ToggleSectionProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-1 text-[15px] font-bold">{title}</h2>
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
                "flex items-center gap-3 rounded-xl border p-3.5 text-left text-[13.5px] transition-colors",
                active ? "border-primary bg-accent font-medium" : "border-border hover:border-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                  active ? "justify-end bg-primary" : "justify-start bg-border"
                )}
              >
                <span className="m-0.5 h-4 w-4 rounded-full bg-white shadow" />
              </span>
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-1.5">
        <Label htmlFor={notesId}>
          {notesId === "quickSelectNotes" ? "Anything else ReplyFlow should know?" : "Optional notes"}{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id={notesId}
          placeholder={notesPlaceholder}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="min-h-[70px]"
        />
      </div>
    </section>
  );
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
  const currentTonePreview = GREETING_STYLES.find((g) => g.value === tone) ?? GREETING_STYLES[0];

  function toggleSet(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setSet(next);
  }

  const answeredFaqCount = (watchedFaqs ?? []).filter((f) => f?.answer && f.answer.trim().length >= 3).length;

  const stepsComplete = [
    true, // Tone always has a sensible default selected
    behaviorIds.size > 0 || behaviorNotes.trim().length > 0,
    ruleIds.size > 0 || ruleNotes.trim().length > 0,
    escalationIds.size > 0 || escalationNotes.trim().length > 0,
    answeredFaqCount > 0,
  ];
  const completedCount = stepsComplete.filter(Boolean).length;

  // Live preview — reacts to what's actually been set up so far,
  // falling back to a sensible generic example when nothing's
  // selected yet (Section 7).
  const previewReply = useMemo(() => {
    const parts: string[] = [];
    parts.push(currentTonePreview.value === "concise" ? "Sorry to hear that." : "Hi 👋 Sorry to hear that.");
    const asks: string[] = [];
    if (behaviorIds.has("ask-postcode")) asks.push("your postcode");
    if (behaviorIds.has("ask-photos")) asks.push("a photo of the boiler");
    if (behaviorIds.has("ask-problem") && asks.length === 0) asks.push("a few more details");
    if (asks.length > 0) parts.push(`Can you send ${asks.join(" and ")}?`);
    if (behaviorIds.has("someone-will-contact") || asks.length > 0) {
      parts.push("One of our team will review it as soon as possible.");
    }
    return parts.join(" ");
  }, [behaviorIds, currentTonePreview]);

  async function onSubmit(values: AiConfigurationInput) {
    const systemPrompt = [
      ...QUICK_SELECT_BEHAVIORS.filter((o) => behaviorIds.has(o.id)).map((o) => o.text),
      behaviorNotes.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    if (systemPrompt.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Add a bit more detail",
        description: "Tap a few options above, or add a note about your business.",
      });
      return;
    }

    const businessRules = [
      ...BUSINESS_RULE_OPTIONS.filter((o) => ruleIds.has(o.id)).map((o) => o.text),
      ruleNotes.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const escalationRules = [
      ...ESCALATION_OPTIONS.filter((o) => escalationIds.has(o.id)).map((o) => o.text),
      escalationNotes.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    setSubmitting(true);
    const { error } = await supabase.from("ai_configurations").upsert(
      {
        business_id: businessId,
        tone: values.tone,
        system_prompt: systemPrompt,
        business_rules: businessRules,
        escalation_rules: escalationRules,
        faqs: values.faqs,
      },
      { onConflict: "business_id" }
    );
    setSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Couldn't save configuration", description: error.message });
      return;
    }
    toast({ variant: "success", title: "Your AI receptionist is ready", description: "It'll use this from the next message onward." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* SECTION 6 — Progress */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold">AI Setup</span>
          <span className="text-[13px] text-muted-foreground">
            {completedCount === 5 ? "All done 🎉" : `${completedCount} of 5 complete`}
          </span>
        </div>
        <Progress value={(completedCount / 5) * 100} />
      </div>

      {/* SECTION 1 — Tone (unchanged logic, spacing/polish only) */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 text-[15px] font-bold">How should it sound?</h2>
        <p className="mb-5 text-[13px] text-muted-foreground">Pick the tone that matches your business.</p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {GREETING_STYLES.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setValue("tone", g.value, { shouldDirty: true })}
              aria-pressed={tone === g.value}
              className={cn(
                "rounded-xl border p-3.5 text-left transition-colors",
                tone === g.value ? "border-primary bg-accent" : "border-border hover:border-muted-foreground/30"
              )}
            >
              <p className="text-[13.5px] font-semibold">{g.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">&ldquo;{g.example}&rdquo;</p>
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 2 — quick-select behaviors, replacing the free-text business description */}
      <ToggleSection
        title="What should ReplyFlow do?"
        subtitle="Tap everything that applies — no writing required."
        options={QUICK_SELECT_BEHAVIORS}
        selected={behaviorIds}
        onToggle={(id) => toggleSet(behaviorIds, setBehaviorIds, id)}
        notes={behaviorNotes}
        onNotesChange={setBehaviorNotes}
        notesId="quickSelectNotes"
        notesPlaceholder="e.g. we specialise in older properties"
      />
      {errors.systemPrompt && <p className="px-1 text-xs font-medium text-destructive">{errors.systemPrompt.message}</p>}

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
        notesPlaceholder="e.g. standard jobs get booked within 3 working days"
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
        notesPlaceholder="e.g. hand off for any job quoted over £500"
      />

      {/* SECTION 5 — FAQs, pre-seeded with 5 suggestions */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold">Answers it already knows</h2>
            <p className="text-[13px] text-muted-foreground">Just fill in the answers — add or remove as needed.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ question: "", answer: "" })}>
            <Plus className="h-3.5 w-3.5" /> Add FAQ
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-xl border border-border p-4">
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
                  className="mt-6 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
          ))}
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
      </section>

      {/* SECTION 7 — Preview */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-1 text-[15px] font-bold">Preview</h2>
        <p className="mb-5 text-[13px] text-muted-foreground">A rough idea of how ReplyFlow will reply, based on what you&apos;ve set up.</p>

        <div className="space-y-3 rounded-2xl bg-muted/40 p-5">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-[13.5px] leading-relaxed text-primary-foreground">
              &ldquo;My boiler isn&apos;t working.&rdquo;
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm">
              {previewReply}
            </div>
          </div>
        </div>
      </section>

      <Button type="submit" variant="success" disabled={submitting} className="w-auto px-6">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Save AI Receptionist
      </Button>
    </form>
  );
}
