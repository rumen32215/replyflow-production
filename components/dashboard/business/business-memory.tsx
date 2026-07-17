"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Headset, Plus, X } from "lucide-react";
import { SettleCard, GentleSwap, EASE, press } from "@/components/shared/motion";
import { Acknowledgement, ACK, useAcknowledgement } from "@/components/shared/acknowledgement";
import { PhonePreview } from "@/components/shared/phone-preview";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import {
  parseKnowledge,
  understandingScore,
  buildKnowledgeReply,
  PERSONALITY_SUGGESTIONS,
  PAYMENT_SUGGESTIONS,
  GUARANTEE_SUGGESTIONS,
  ACCESS_SUGGESTIONS,
  FAQ_SUGGESTIONS,
  KNOWLEDGE_PREVIEW_SCENARIOS,
  type BusinessKnowledge,
} from "@/lib/knowledge";
import { PLUMBING_SERVICES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Business knowledge — the living profile (Business Knowledge V2).
 *
 * She's not presenting settings; she's asking questions because she
 * wants to understand the business better. Every section is one of
 * her conversation turns (her avatar, her question, a check once she
 * knows it) — chips and suggestions do almost all the work, typing is
 * reserved for the handful of things that genuinely need it. The live
 * WhatsApp preview stays on screen throughout: every answer visibly
 * changes how she'd actually reply to a real customer question about
 * the business, the same "teach it, watch it, trust it" loop as the
 * Receptionist page.
 *
 * Persistence is quiet: one debounced write, no Save button — she
 * shows "Learning..." while the save is in flight, then acknowledges.
 * FAQs live in ai_configurations.faqs (their original home) so the
 * conversation engine keeps reading them unchanged.
 */

export interface Faq {
  question: string;
  answer: string;
}

export interface BusinessMemoryInitial {
  businessName: string;
  phone: string;
  description: string;
  services: string[];
  serviceAreas: string[];
  offersEmergency: boolean;
  chargesCalloutFee: boolean;
  calloutFeeAmount: string;
  knowledge: BusinessKnowledge;
  faqs: Faq[];
}

type SectionId =
  | "identity"
  | "services"
  | "declined"
  | "areas"
  | "special"
  | "payments"
  | "guarantees"
  | "emergency"
  | "faqs"
  | "access";

export function BusinessMemory({
  businessId,
  initial,
}: {
  businessId: string;
  initial: BusinessMemoryInitial;
}) {
  const supabase = createClient();
  const { message, isError, isSaving, startSaving, acknowledge, softError } = useAcknowledgement();

  const [businessName, setBusinessName] = useState(initial.businessName);
  const [phone, setPhone] = useState(initial.phone);
  const [description, setDescription] = useState(initial.description);
  const [services, setServices] = useState<string[]>(initial.services);
  const [serviceAreas, setServiceAreas] = useState<string[]>(initial.serviceAreas);
  const [offersEmergency, setOffersEmergency] = useState(initial.offersEmergency);
  const [chargesCalloutFee, setChargesCalloutFee] = useState(initial.chargesCalloutFee);
  const [calloutFeeAmount, setCalloutFeeAmount] = useState(initial.calloutFeeAmount);
  const [knowledge, setKnowledge] = useState<BusinessKnowledge>(initial.knowledge);
  const [faqs, setFaqs] = useState<Faq[]>(initial.faqs);
  const [open, setOpen] = useState<SectionId | null>(null);
  const [scenarioId, setScenarioId] = useState<string>(KNOWLEDGE_PREVIEW_SCENARIOS[0]?.id ?? "payment");

  /* The live proof — every answer below is a fact this reply is built
   * from, so watching it change is the whole point. */
  const scenario = KNOWLEDGE_PREVIEW_SCENARIOS.find((s) => s.id === scenarioId) ?? KNOWLEDGE_PREVIEW_SCENARIOS[0]!;
  const liveReply = buildKnowledgeReply(scenarioId, {
    paymentMethods: knowledge.paymentMethods,
    chargesCalloutFee,
    calloutFeeAmount,
    guarantees: knowledge.guarantees,
    serviceAreas,
    offersEmergency,
    emergencyNotes: knowledge.emergencyNotes,
    parkingAccess: knowledge.parkingAccess,
  });

  /* ------------------------- quiet persistence ------------------------- */
  const firstRender = useRef(true);
  const ackRef = useRef<string>(ACK.remember);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      startSaving();
      const cleanedFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
      const [businessResult, faqResult] = await Promise.all([
        supabase
          .from("businesses")
          .update({
            business_name: businessName.trim() || initial.businessName,
            phone: phone.trim(),
            business_description: description.trim() || null,
            services,
            service_areas: serviceAreas,
            offers_emergency_callouts: offersEmergency,
            charges_callout_fee: chargesCalloutFee,
            callout_fee_amount: chargesCalloutFee ? calloutFeeAmount.trim() || null : null,
            business_knowledge: knowledge,
          })
          .eq("id", businessId),
        supabase
          .from("ai_configurations")
          .upsert({ business_id: businessId, faqs: cleanedFaqs }, { onConflict: "business_id" }),
      ]);
      if (businessResult.error || faqResult.error) softError();
      else acknowledge(ackRef.current);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    businessName,
    phone,
    description,
    services,
    serviceAreas,
    offersEmergency,
    chargesCalloutFee,
    calloutFeeAmount,
    knowledge,
    faqs,
  ]);

  function learn<T>(apply: () => T, ack: string = ACK.remember) {
    ackRef.current = ack;
    return apply();
  }

  function patchKnowledge(patch: Partial<BusinessKnowledge>, ack: string = ACK.remember) {
    ackRef.current = ack;
    setKnowledge((k) => ({ ...k, ...patch }));
  }

  /* --------------------- understanding + suggestions ------------------- */

  const score = useMemo(
    () =>
      understandingScore({
        businessDescription: description,
        services,
        serviceAreas,
        knowledge,
        faqCount: faqs.filter((f) => f.question.trim() && f.answer.trim()).length,
      }),
    [description, services, serviceAreas, knowledge, faqs]
  );

  // Proactive learning (One Thought Ahead): ReplyFlow notices what it
  // doesn't know yet and asks — the owner never has to think of it.
  const MISSING_TO_SECTION: Record<string, { section: SectionId; prompt: string }> = {
    "a short introduction": { section: "identity", prompt: "Would you like to tell me a little about the business?" },
    "the services you offer": { section: "services", prompt: "What kinds of jobs do you usually help people with?" },
    "the areas you cover": { section: "areas", prompt: "Where do you usually work?" },
    "what makes you special": { section: "special", prompt: "What makes your business special?" },
    "jobs you don't take": { section: "declined", prompt: "Are there any jobs you don't take on?" },
    "how customers can pay": { section: "payments", prompt: "Customers often ask how they can pay. Shall we cover that?" },
    "your guarantees": { section: "guarantees", prompt: "Do you offer any guarantees I should mention?" },
    "answers to common questions": { section: "faqs", prompt: "Customers often ask the same questions. Would you like to teach me the answers?" },
  };
  const nextLesson = score.missing.map((m) => MISSING_TO_SECTION[m]).find(Boolean) ?? null;

  /* ------------------------------ sections ------------------------------ */

  const summarise = (items: string[]) =>
    items.length === 0
      ? null
      : items.length <= 2
        ? items.join(", ")
        : `${items.slice(0, 2).join(", ")} + ${items.length - 2} more`;

  const activeFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());

  const sections: {
    id: SectionId;
    title: string;
    question: string;
    known: boolean;
    summary: string | null;
    content: React.ReactNode;
  }[] = [
    {
      id: "identity",
      title: "Your business",
      question: "What should I call your business?",
      known: Boolean(description.trim()),
      summary: businessName.trim() || null,
      content: (
        <div className="space-y-3">
          <MemoryField
            label="Business name"
            value={businessName}
            onChange={(v) => learn(() => setBusinessName(v), ACK.gotIt)}
            placeholder="e.g. Dales Plumbing"
          />
          <MemoryField
            label="Phone number"
            value={phone}
            onChange={(v) => learn(() => setPhone(v), ACK.gotIt)}
            placeholder="So customers can reach you directly"
            type="tel"
          />
          <MemoryTextarea
            label="A short introduction"
            value={description}
            onChange={(v) => learn(() => setDescription(v), ACK.helpful)}
            placeholder="e.g. Family-run plumbing and heating covering North London for 15 years."
          />
        </div>
      ),
    },
    {
      id: "services",
      title: "Services",
      question: "What kinds of jobs do you usually help people with?",
      known: services.length > 0,
      summary: summarise(services),
      content: (
        <ChipEditor
          suggestions={[...PLUMBING_SERVICES]}
          items={services}
          onChange={(next) => learn(() => setServices(next))}
          addPlaceholder="Add another service"
        />
      ),
    },
    {
      id: "declined",
      title: "Jobs we don't take",
      question: "Are there any jobs you don't take on?",
      known: knowledge.jobsDeclined.length > 0,
      summary: summarise(knowledge.jobsDeclined),
      content: (
        <>
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
            I&apos;ll politely let customers know, so you never get booked for the wrong work.
          </p>
          <ChipEditor
            suggestions={["Gas work", "Commercial jobs", "New builds", "Jobs outside my area"]}
            items={knowledge.jobsDeclined}
            onChange={(next) => patchKnowledge({ jobsDeclined: next }, ACK.useNextTime)}
            addPlaceholder="Add a job you don't take"
          />
        </>
      ),
    },
    {
      id: "areas",
      title: "Areas we cover",
      question: "Where do you usually work?",
      known: serviceAreas.length > 0,
      summary: summarise(serviceAreas),
      content: (
        <>
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
            I&apos;ll never promise work outside these areas.
          </p>
          <ChipEditor
            suggestions={[]}
            items={serviceAreas}
            onChange={(next) => learn(() => setServiceAreas(next))}
            addPlaceholder="Add a town or postcode"
          />
        </>
      ),
    },
    {
      id: "special",
      title: "What makes you special",
      question: "What makes your business different?",
      known: knowledge.personality.length > 0,
      summary: summarise(knowledge.personality),
      content: (
        <ChipEditor
          suggestions={[...PERSONALITY_SUGGESTIONS]}
          items={knowledge.personality}
          onChange={(next) => patchKnowledge({ personality: next }, ACK.helpful)}
          addPlaceholder="Add your own"
        />
      ),
    },
    {
      id: "payments",
      title: "Payment methods",
      question: "How can customers pay?",
      known: knowledge.paymentMethods.length > 0,
      summary: summarise(knowledge.paymentMethods),
      content: (
        <ChipEditor
          suggestions={[...PAYMENT_SUGGESTIONS]}
          items={knowledge.paymentMethods}
          onChange={(next) => patchKnowledge({ paymentMethods: next })}
          addPlaceholder="Add another way to pay"
        />
      ),
    },
    {
      id: "guarantees",
      title: "Guarantees",
      question: "What do you promise your customers?",
      known: knowledge.guarantees.length > 0,
      summary: summarise(knowledge.guarantees),
      content: (
        <ChipEditor
          suggestions={[...GUARANTEE_SUGGESTIONS]}
          items={knowledge.guarantees}
          onChange={(next) => patchKnowledge({ guarantees: next }, ACK.useNextTime)}
          addPlaceholder="Add a guarantee"
        />
      ),
    },
    {
      id: "emergency",
      title: "Emergency jobs",
      question: "How should I handle urgent enquiries?",
      known: true,
      summary: offersEmergency
        ? chargesCalloutFee && calloutFeeAmount.trim()
          ? `Emergency call-outs · ${calloutFeeAmount.trim()} call-out fee`
          : "Emergency call-outs available"
        : "No emergency call-outs",
      content: (
        <div className="space-y-1">
          <ToggleRow
            label="Emergency call-outs"
            description="Accept urgent jobs when customers need help fast"
            checked={offersEmergency}
            onChange={(v) => learn(() => setOffersEmergency(v), ACK.updated)}
          />
          <ToggleRow
            label="Call-out fee"
            description="I'll mention it upfront so there are no surprises"
            checked={chargesCalloutFee}
            onChange={(v) => learn(() => setChargesCalloutFee(v), ACK.updated)}
          />
          <AnimatePresence initial={false}>
            {chargesCalloutFee && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="pt-2">
                  <MemoryField
                    label="How much is the call-out fee?"
                    value={calloutFeeAmount}
                    onChange={(v) => learn(() => setCalloutFeeAmount(v), ACK.gotIt)}
                    placeholder="e.g. £60"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="pt-2">
            <MemoryTextarea
              label="Anything I should say in an emergency?"
              value={knowledge.emergencyNotes}
              onChange={(v) => patchKnowledge({ emergencyNotes: v }, ACK.useNextTime)}
              placeholder="e.g. If there's a gas leak, tell them to call 0800 111 999 straight away."
            />
          </div>
        </div>
      ),
    },
    {
      id: "faqs",
      title: "Common questions",
      question: "What do customers often ask?",
      known: activeFaqs.length > 0,
      summary:
        activeFaqs.length > 0
          ? `${activeFaqs.length} answer${activeFaqs.length === 1 ? "" : "s"} ready`
          : null,
      content: <FaqEditor faqs={faqs} onChange={(next) => learn(() => setFaqs(next), ACK.useNextTime)} />,
    },
    {
      id: "access",
      title: "Parking & access",
      question: "Anything customers should know before you arrive?",
      known: Boolean(knowledge.parkingAccess.trim()),
      summary: knowledge.parkingAccess.trim() ? "Noted" : null,
      content: (
        <SuggestibleTextarea
          label="Parking, access, or preparation"
          value={knowledge.parkingAccess}
          onChange={(v) => patchKnowledge({ parkingAccess: v })}
          suggestions={ACCESS_SUGGESTIONS}
          placeholder="Or add your own — e.g. Please make sure the stopcock is accessible before we arrive."
        />
      ),
    },
  ];

  /* ------------------------------- layout ------------------------------- */

  return (
    <div className="mx-auto max-w-5xl">
      <SettleCard className="mb-6">
        <h1 className="text-[24px] font-extrabold tracking-tight md:text-[26px]">
          What I know about your business
        </h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          I&apos;m asking because it helps me understand the business better — there&apos;s no finish
          line, add to it whenever something changes.
        </p>
      </SettleCard>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_360px] lg:items-start">
        {/* The live phone — the hero, same as the Receptionist page.
         * First on mobile, sticky in the right column on desktop. */}
        <div className="lg:order-2 lg:sticky lg:top-2 lg:self-start">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {KNOWLEDGE_PREVIEW_SCENARIOS.map((s) => (
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
            <PhonePreview
              businessName={businessName || initial.businessName}
              turns={[{ from: "customer", text: scenario.customerMessage }]}
              liveReply={liveReply}
            />
          </GentleSwap>

          <p className="mt-3 text-[11.5px] text-muted-foreground">This is exactly how I&apos;ll reply.</p>
        </div>

        <div className="min-w-0 space-y-4 lg:order-1">
          {/* Business understanding — not a game, a gentle signal. */}
          <SettleCard delay={0.05} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold tracking-tight">How well I understand you</h2>
              <span className="text-[13px] font-semibold text-primary">{score.percent}%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${Math.max(score.percent, 4)}%` }}
                transition={{ duration: 0.6, ease: EASE }}
              />
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {nextLesson ? (
                <motion.button
                  key={nextLesson.section}
                  {...press}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  type="button"
                  onClick={() => setOpen(nextLesson.section)}
                  className="mt-3.5 flex w-full items-center justify-between rounded-xl border border-dashed border-border px-4 py-3 text-left transition-colors hover:border-primary"
                >
                  <span className="text-[13px] font-medium text-foreground">{nextLesson.prompt}</span>
                  <span className="ml-3 shrink-0 text-[12.5px] font-semibold text-primary">Teach me</span>
                </motion.button>
              ) : (
                <motion.p
                  key="complete"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3.5 text-[13px] text-muted-foreground"
                >
                  I know your business well. Keep adding anything new — I&apos;ll use it straight away.
                </motion.p>
              )}
            </AnimatePresence>
          </SettleCard>

          {/* Her questions — one conversation turn per topic, revealed
           * like papers laid on a desk. */}
          <div className="space-y-3">
            {sections.map((section, index) => (
              <KnowledgeCard
                key={section.id}
                index={index}
                question={section.question}
                known={section.known}
                summary={section.summary}
                open={open === section.id}
                onToggle={() => setOpen(open === section.id ? null : section.id)}
              >
                {section.content}
              </KnowledgeCard>
            ))}
          </div>
        </div>
      </div>

      {/* One quiet acknowledgement bar, pinned clear of the tab bar. */}
      <div className="pointer-events-none sticky bottom-20 mt-6 flex min-h-[28px] justify-center md:bottom-4">
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="rounded-full border border-border bg-card px-4 py-2 shadow-md"
            >
              <Acknowledgement message={message} isError={isError} isSaving={isSaving} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------ pieces ------------------------------ */

/**
 * One of her questions — same conversation-turn language as the
 * Receptionist page (her avatar, her question as a received-message
 * bubble, a check once she knows something here) with progressive
 * disclosure kept for this page specifically: ten topics at once would
 * be a wall, not a conversation, so each stays collapsed to a one-line
 * summary in her voice until tapped open.
 */
function KnowledgeCard({
  index,
  question,
  known,
  summary,
  open,
  onToggle,
  children,
}: {
  index: number;
  question: string;
  known: boolean;
  summary: string | null;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <SettleCard delay={0.04 * index} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={{ scale: 0.99 }}
        aria-expanded={open}
        className="flex w-full items-start gap-2.5 px-4 py-3.5 text-left"
      >
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <Headset className="h-[15px] w-[15px]" />
          {known && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-card"
            >
              <Check className="h-2 w-2" strokeWidth={3.5} />
            </motion.span>
          )}
        </div>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2 text-[13px] leading-relaxed">
            {question}
          </span>
          <span className="mt-1.5 block truncate text-[12px] text-muted-foreground">
            {summary ?? "I don't know this yet"}
          </span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="mt-1.5 shrink-0 text-muted-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-border py-4 pl-[46px] pr-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SettleCard>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold">{label}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function MemoryField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
      />
    </label>
  );
}

function MemoryTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
      />
    </label>
  );
}

/**
 * A free-text field with common answers suggested above it — tapping
 * one adds or removes that exact line; typing anything else is left
 * completely untouched. Reduces typing without ever reinterpreting or
 * losing whatever an owner already wrote here.
 */
function SuggestibleTextarea({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: readonly string[];
  placeholder?: string;
}) {
  const lines = value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  function toggle(s: string) {
    onChange(lines.includes(s) ? lines.filter((l) => l !== s).join("\n") : [...lines, s].join("\n"));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => {
          const on = lines.includes(s);
          return (
            <motion.button
              key={s}
              {...press}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors",
                on ? "border-primary bg-accent text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
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
              {s}
            </motion.button>
          );
        })}
      </div>
      <MemoryTextarea label={label} value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

/**
 * Chips with suggestions — minimal typing (Business Experience V2:
 * "Choices and examples wherever possible"). Suggestions toggle on and
 * off; the owner's own entries carry a remove control.
 */
function ChipEditor({
  suggestions,
  items,
  onChange,
  addPlaceholder,
}: {
  suggestions: string[];
  items: string[];
  onChange: (items: string[]) => void;
  addPlaceholder: string;
}) {
  const [draft, setDraft] = useState("");
  const custom = items.filter((i) => !suggestions.includes(i));

  function toggleSuggestion(s: string) {
    onChange(items.includes(s) ? items.filter((i) => i !== s) : [...items, s]);
  }

  function addDraft() {
    const value = draft.trim();
    if (!value || items.includes(value)) {
      setDraft("");
      return;
    }
    onChange([...items, value]);
    setDraft("");
  }

  return (
    <div className="space-y-3">
      {(suggestions.length > 0 || custom.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => {
            const on = items.includes(s);
            return (
              <motion.button
                key={s}
                {...press}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSuggestion(s)}
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
                {s}
              </motion.button>
            );
          })}
          <AnimatePresence initial={false}>
            {custom.map((item) => (
              <motion.span
                key={item}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="flex items-center gap-1.5 rounded-full border border-primary bg-accent px-3.5 py-2 text-[12.5px] font-medium text-primary"
              >
                {item}
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  onClick={() => onChange(items.filter((i) => i !== item))}
                  className="text-primary/60 transition-colors hover:text-primary"
                >
                  <X className="h-3 w-3" strokeWidth={3} />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder={addPlaceholder}
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
        />
        <motion.button
          {...press}
          type="button"
          onClick={addDraft}
          disabled={!draft.trim()}
          aria-label="Add"
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
}

function FaqEditor({ faqs, onChange }: { faqs: Faq[]; onChange: (faqs: Faq[]) => void }) {
  function update(index: number, patch: Partial<Faq>) {
    onChange(faqs.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  const askedAlready = new Set(faqs.map((f) => f.question.trim()));
  const suggestedQuestions = FAQ_SUGGESTIONS.filter((q) => !askedAlready.has(q));

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Teach me an answer once and I&apos;ll give it consistently, every time.
      </p>

      {/* Suggested before asking the owner to write their own. */}
      {suggestedQuestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((q) => (
            <motion.button
              key={q}
              {...press}
              type="button"
              onClick={() => onChange([...faqs, { question: q, answer: "" }])}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-border bg-card px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-3 w-3" />
              {q}
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {faqs.map((faq, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="space-y-2 rounded-xl border border-border bg-muted/30 p-3.5"
          >
            <div className="flex items-start gap-2">
              <input
                value={faq.question}
                onChange={(e) => update(index, { question: e.target.value })}
                placeholder="e.g. Do you charge a call-out fee?"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
              />
              <button
                type="button"
                aria-label="Remove question"
                onClick={() => onChange(faqs.filter((_, i) => i !== index))}
                className="mt-2 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
            <textarea
              value={faq.answer}
              onChange={(e) => update(index, { answer: e.target.value })}
              placeholder="How should I answer?"
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
            />
          </motion.div>
        ))}
      </AnimatePresence>
      <motion.button
        {...press}
        type="button"
        onClick={() => onChange([...faqs, { question: "", answer: "" }])}
        className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="h-3.5 w-3.5" />
        Add a question
      </motion.button>
    </div>
  );
}
