"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { SettleCard, EASE, press } from "@/components/shared/motion";
import { Acknowledgement, ACK, randomAck, useAcknowledgement } from "@/components/shared/acknowledgement";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import {
  parseKnowledge,
  PERSONALITY_SUGGESTIONS,
  PAYMENT_SUGGESTIONS,
  GUARANTEE_SUGGESTIONS,
  FAQ_SUGGESTIONS,
  type BusinessKnowledge,
} from "@/lib/knowledge";
import { buildBrain } from "@/lib/intelligence";
import { servicesForTrade, accessSuggestionsForTrade } from "@/lib/trades";
import { cn } from "@/lib/utils";

/**
 * Business Profile (Sprint 8.7 rewrite, Sprint 8.8 progressive
 * disclosure).
 *
 * Sprint 8.6 grouped the old chat-interview layout into three
 * categories and it was still, in the product review's own words,
 * "psychologically perceived as a questionnaire" — an avatar asking a
 * question in a speech bubble, one topic auto-expanding after another,
 * is the AI-chatbot metaphor, however calm its styling. Sprint 8.7
 * dropped that metaphor entirely for a plain, always-visible profile
 * document — the same mental model WhatsApp Business itself uses for
 * its own "Business Profile" screen.
 *
 * Sprint 8.8 brings back *progressive* disclosure, deliberately —
 * without bringing back the chatbot framing that came with it before.
 * Exactly one of the four groups is open at a time; a group that's
 * genuinely done collapses into a compact, checked summary row and
 * the next incomplete group opens on its own — the difference from
 * 8.6 is that nothing here is dressed up as a question from an AI
 * character asking to be taught. It's the same document, one section
 * at a time, the same way filling in a paper form naturally draws the
 * eye to the next blank line. Any group can still be reopened by
 * tapping it — nothing is ever locked.
 *
 * The WhatsApp phone-preview + scenario tabs stay gone from this page
 * (Sprint 8.7 decision) — that demo belongs to Receptionist. The
 * profile summary card on the right keeps updating live as fields
 * change, exactly as before.
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

type SectionGroup = "identity" | "scope" | "commercial" | "goodToKnow";
const GROUP_LABEL: Record<SectionGroup, string> = {
  identity: "Who we are",
  scope: "What we do",
  commercial: "How we work",
  goodToKnow: "Good to know",
};
const GROUP_ORDER: SectionGroup[] = ["identity", "scope", "commercial", "goodToKnow"];

export function BusinessMemory({
  businessId,
  trade,
  initial,
  initialTopic = null,
}: {
  businessId: string;
  trade: string | null;
  initial: BusinessMemoryInitial;
  /** Set when arriving from a Front Desk recommendation (?topic=) —
   * scrolls to and briefly highlights that field instead of opening a
   * section, since nothing here collapses any more. */
  initialTopic?: string | null;
}) {
  const supabase = createClient();
  const serviceSuggestions = servicesForTrade(trade);
  const accessSuggestions = accessSuggestionsForTrade(trade);
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

  /* ------------------------- quiet persistence ------------------------- */
  const firstRender = useRef(true);
  const ackRef = useRef<string>(ACK.remember);
  // Only the most recent save is allowed to update the acknowledgement
  // UI — see the identical fix and explanation in receptionist-playground.tsx.
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
        if (thisRequest !== requestId.current) return;
        if (businessResult.error || faqResult.error) softError();
        else acknowledge(ackRef.current);
      } catch {
        if (thisRequest === requestId.current) softError();
      }
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

  function learn<T>(apply: () => T, ack?: string) {
    ackRef.current = ack ?? randomAck();
    return apply();
  }

  function patchKnowledge(patch: Partial<BusinessKnowledge>, ack?: string) {
    ackRef.current = ack ?? randomAck();
    setKnowledge((k) => ({ ...k, ...patch }));
  }

  /* --------------------------- profile completeness --------------------- */

  // The shared Brain (lib/intelligence.ts) — this page only feeds its
  // own knowledge domain, so its completeness bar stays scoped to what
  // this page covers. Used only for the overall percentage and each
  // field's own done/not-done state; there's no auto-advance queue any
  // more, so gaps/nextTopic aren't read here.
  const brain = useMemo(
    () =>
      buildBrain({
        knowledge: {
          businessDescription: description,
          services,
          serviceAreas,
          knowledge,
          faqCount: faqs.filter((f) => f.question.trim() && f.answer.trim()).length,
        },
      }),
    [description, services, serviceAreas, knowledge, faqs]
  );
  const knownById = new Map(brain.topics.filter((t) => t.domain === "knowledge").map((t) => [t.id, t.done]));
  const profilePercent = brain.percentFor("knowledge");

  // A real, rare celebration — not another reassurance on every edit.
  const celebratedPercentRef = useRef(profilePercent);
  useEffect(() => {
    const prev = celebratedPercentRef.current;
    if (prev < 100 && profilePercent >= 100) {
      ackRef.current = "Your business profile is complete.";
    } else if (prev < 50 && profilePercent >= 50) {
      ackRef.current = "Halfway there — your profile is filling out nicely.";
    }
    celebratedPercentRef.current = profilePercent;
  }, [profilePercent]);

  /* ---------------------- scroll to a requested field -------------------- */
  const fieldRefs = useRef<Partial<Record<SectionId, HTMLDivElement | null>>>({});
  const [highlighted, setHighlighted] = useState<SectionId | null>(null);
  useEffect(() => {
    if (!initialTopic) return;
    const el = fieldRefs.current[initialTopic as SectionId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlighted(initialTopic as SectionId);
    const t = setTimeout(() => setHighlighted(null), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------ fields --------------------------------- */

  const activeFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());

  const fields: {
    id: SectionId;
    group: SectionGroup;
    title: string;
    content: React.ReactNode;
  }[] = [
    {
      id: "identity",
      group: "identity",
      title: "Business details",
      content: (
        <div className="space-y-3">
          <MemoryField
            label="Business name"
            value={businessName}
            onChange={(v) => learn(() => setBusinessName(v))}
            placeholder="e.g. Dales Plumbing"
          />
          <MemoryField
            label="Phone number"
            value={phone}
            onChange={(v) => learn(() => setPhone(v))}
            placeholder="So customers can reach you directly"
            type="tel"
          />
          <MemoryTextarea
            label="About your business"
            value={description}
            onChange={(v) => learn(() => setDescription(v))}
            placeholder="e.g. Family-run plumbing and heating covering North London for 15 years."
          />
        </div>
      ),
    },
    {
      id: "special",
      group: "identity",
      title: "What makes you different",
      content: (
        <ChipEditor
          suggestions={[...PERSONALITY_SUGGESTIONS]}
          items={knowledge.personality}
          onChange={(next) => patchKnowledge({ personality: next })}
          addPlaceholder="Add your own"
        />
      ),
    },
    {
      id: "services",
      group: "scope",
      title: "Services you offer",
      content: (
        <ChipEditor
          suggestions={[...serviceSuggestions]}
          items={services}
          onChange={(next) => learn(() => setServices(next))}
          addPlaceholder="Add another service"
        />
      ),
    },
    {
      id: "areas",
      group: "scope",
      title: "Areas you cover",
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
      id: "declined",
      group: "scope",
      title: "Jobs you don't take",
      content: (
        <>
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
            I&apos;ll politely let customers know, so you never get booked for the wrong work.
          </p>
          <ChipEditor
            suggestions={["Gas work", "Commercial jobs", "New builds", "Jobs outside my area"]}
            items={knowledge.jobsDeclined}
            onChange={(next) => patchKnowledge({ jobsDeclined: next })}
            addPlaceholder="Add a job you don't take"
          />
        </>
      ),
    },
    {
      id: "payments",
      group: "commercial",
      title: "Ways to pay",
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
      group: "commercial",
      title: "Guarantees",
      content: (
        <ChipEditor
          suggestions={[...GUARANTEE_SUGGESTIONS]}
          items={knowledge.guarantees}
          onChange={(next) => patchKnowledge({ guarantees: next })}
          addPlaceholder="Add a guarantee"
        />
      ),
    },
    {
      id: "emergency",
      group: "commercial",
      title: "Emergency call-outs",
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
                    onChange={(v) => learn(() => setCalloutFeeAmount(v))}
                    placeholder="e.g. £60"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="pt-2">
            <MemoryTextarea
              label="Anything to say in an emergency?"
              value={knowledge.emergencyNotes}
              onChange={(v) => patchKnowledge({ emergencyNotes: v })}
              placeholder="e.g. If there's a gas leak, tell them to call 0800 111 999 straight away."
            />
          </div>
        </div>
      ),
    },
    {
      id: "access",
      group: "goodToKnow",
      title: "Parking & access",
      content: (
        <SuggestibleTextarea
          label="Parking, access, or preparation"
          value={knowledge.parkingAccess}
          onChange={(v) => patchKnowledge({ parkingAccess: v })}
          suggestions={accessSuggestions}
          placeholder="Or add your own — e.g. Please make sure the stopcock is accessible before we arrive."
        />
      ),
    },
    {
      id: "faqs",
      group: "goodToKnow",
      title: "Questions customers often ask",
      content: <FaqEditor faqs={faqs} onChange={(next) => learn(() => setFaqs(next))} />,
    },
  ];

  const fieldKnown = (id: SectionId): boolean => {
    if (id === "identity") return Boolean(description.trim());
    if (id === "emergency") return true;
    return knownById.get(id) ?? false;
  };

  const groupDone = (group: SectionGroup): boolean =>
    fields.filter((f) => f.group === group).every((f) => fieldKnown(f.id));

  /** A one-line, honest highlight of what's already been added — never
   * a fabricated summary, just the same values shown in the fields
   * themselves, joined. Shown once a group collapses. */
  const groupSummary = (group: SectionGroup): string | null => {
    if (group === "identity") return businessName.trim() || null;
    if (group === "scope") return services.length > 0 ? services.slice(0, 3).join(", ") : null;
    if (group === "commercial") return knowledge.paymentMethods.length > 0 ? knowledge.paymentMethods.join(", ") : null;
    if (activeFaqs.length > 0) return `${activeFaqs.length} ${activeFaqs.length === 1 ? "answer" : "answers"} ready`;
    return null;
  };

  // Sprint 8.8 — exactly one group open at a time; a group that
  // becomes fully done collapses and the next incomplete one opens on
  // its own, the same auto-advance pattern Sprint 8.6 used per-topic,
  // now at group level. Manually opening a different group is always
  // respected. Arriving from a Recommendations link (?topic=) opens
  // that field's own group first, instead of wherever auto-advance
  // would otherwise land.
  const initialGroup = initialTopic ? fields.find((f) => f.id === initialTopic)?.group ?? null : null;
  const firstIncompleteGroup = GROUP_ORDER.find((g) => !groupDone(g)) ?? null;
  const [openGroup, setOpenGroup] = useState<SectionGroup | null>(initialGroup ?? firstIncompleteGroup);
  const prevFirstIncomplete = useRef<SectionGroup | null | undefined>(undefined);
  useEffect(() => {
    if (prevFirstIncomplete.current === undefined) {
      prevFirstIncomplete.current = firstIncompleteGroup;
      return;
    }
    if (firstIncompleteGroup !== prevFirstIncomplete.current) {
      const justCompleted = prevFirstIncomplete.current;
      setOpenGroup((current) => (current === justCompleted ? firstIncompleteGroup : current));
      if (justCompleted) {
        ackRef.current =
          justCompleted === "identity"
            ? "Perfect. I can now introduce your business."
            : justCompleted === "scope"
              ? "Got it. I know what you do and where."
              : justCompleted === "commercial"
                ? "Noted. I know how you like to be paid."
                : "Thanks. That's everything I need for now.";
      }
    }
    prevFirstIncomplete.current = firstIncompleteGroup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstIncompleteGroup]);

  /* ------------------------------ layout ------------------------------- */

  return (
    <div className="mx-auto max-w-5xl">
      <SettleCard className="mb-6">
        <h1 className="text-[24px] font-extrabold tracking-tight md:text-[26px]">Business Profile</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          This is what I&apos;ll use to introduce your business and answer your customers accurately. Update
          it any time — there&apos;s no finish line.
        </p>
      </SettleCard>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="min-w-0 space-y-3 lg:order-1">
          {GROUP_ORDER.map((group) => {
            const groupFields = fields.filter((f) => f.group === group);
            if (groupFields.length === 0) return null;
            const doneCount = groupFields.filter((f) => fieldKnown(f.id)).length;
            const done = doneCount === groupFields.length;
            const isOpen = openGroup === group;
            const summary = groupSummary(group);

            if (!isOpen) {
              return (
                <SettleCard key={group} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <motion.button
                    type="button"
                    onClick={() => setOpenGroup(group)}
                    whileTap={{ scale: 0.99 }}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left"
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        done ? "bg-success text-success-foreground" : "border border-border text-muted-foreground"
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold">{GROUP_LABEL[group]}</p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {summary ?? `${doneCount} of ${groupFields.length} added`}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </motion.button>
                </SettleCard>
              );
            }

            return (
              <SettleCard key={group} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenGroup(null)}
                  className="mb-4 flex w-full items-baseline justify-between text-left"
                >
                  <h2 className="text-[15px] font-bold tracking-tight">{GROUP_LABEL[group]}</h2>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    {doneCount} of {groupFields.length} added
                    <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                  </span>
                </button>
                <div className="divide-y divide-border/70">
                  {groupFields.map((field) => (
                    <div
                      key={field.id}
                      ref={(el) => {
                        fieldRefs.current[field.id] = el;
                      }}
                      className={cn(
                        "rounded-lg py-4 transition-colors first:pt-0 last:pb-0",
                        highlighted === field.id && "-mx-3 bg-primary/5 px-3 ring-1 ring-primary/25"
                      )}
                    >
                      <div className="mb-2.5 flex items-center gap-1.5">
                        <h3 className="text-[13.5px] font-semibold">{field.title}</h3>
                        {fieldKnown(field.id) && <Check className="h-3.5 w-3.5 text-success" strokeWidth={3} />}
                      </div>
                      {field.content}
                    </div>
                  ))}
                </div>
              </SettleCard>
            );
          })}
        </div>

        {/* The profile as it stands — how this looks to someone new,
         * built from these exact answers. No conversation preview
         * here: that belongs to Receptionist, where tone and reply
         * style are actually being shaped (Sprint 8.7). */}
        <div className="lg:order-2 lg:sticky lg:top-2 lg:self-start">
          <SettleCard delay={0.05} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <ConfidenceBar title="Profile completeness" percent={profilePercent} caption={`${profilePercent}% complete`} />
            <AnimatePresence mode="wait" initial={false}>
              {profilePercent >= 100 && (
                <motion.p
                  key="complete"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3.5 text-[13px] text-muted-foreground"
                >
                  Your profile is complete. Keep it updated whenever something changes.
                </motion.p>
              )}
            </AnimatePresence>
          </SettleCard>

          <p className="mb-2 mt-5 px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Business profile
          </p>
          <BusinessProfileCard
            businessName={businessName || initial.businessName}
            description={description}
            services={services}
            serviceAreas={serviceAreas}
            offersEmergency={offersEmergency}
          />
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
 * How this profile looks to someone new — a calm summary card, not a
 * conversation. The same "here's what it produces" reassurance the old
 * phone preview gave, without a second fake WhatsApp thread on top of
 * Receptionist's real one.
 */
function BusinessProfileCard({
  businessName,
  description,
  services,
  serviceAreas,
  offersEmergency,
}: {
  businessName: string;
  description: string;
  services: string[];
  serviceAreas: string[];
  offersEmergency: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-bold text-primary">
          {(businessName || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold">{businessName || "Your business"}</p>
          {offersEmergency && <p className="text-[11.5px] text-success">Emergency call-outs available</p>}
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        {description || "No description yet — add one so I can introduce your business properly."}
      </p>
      {services.length > 0 && (
        <div className="mt-3.5">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Services</p>
          <div className="flex flex-wrap gap-1.5">
            {services.map((s) => (
              <span key={s} className="rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-medium text-foreground">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {serviceAreas.length > 0 && (
        <div className="mt-3.5">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Areas covered
          </p>
          <div className="flex flex-wrap gap-1.5">
            {serviceAreas.map((a) => (
              <span key={a} className="rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-medium text-foreground">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
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
                "flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] transition-all",
                on
                  ? "bg-blue-600 font-semibold text-white shadow-sm shadow-blue-600/25"
                  : "border border-border bg-card font-medium text-muted-foreground hover:border-blue-200 hover:text-foreground"
              )}
            >
              {on && <Check className="h-3 w-3" strokeWidth={3} />}
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
                  "flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] transition-all",
                  on
                    ? "bg-blue-600 font-semibold text-white shadow-sm shadow-blue-600/25"
                    : "border border-border bg-card font-medium text-muted-foreground hover:border-blue-200 hover:text-foreground"
                )}
              >
                {on && <Check className="h-3 w-3" strokeWidth={3} />}
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
                className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm shadow-blue-600/25"
              >
                {item}
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  onClick={() => onChange(items.filter((i) => i !== item))}
                  className="text-white/70 transition-colors hover:text-white"
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
          onBlur={addDraft}
          placeholder={addPlaceholder}
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-blue-500"
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
        Add an answer once and I&apos;ll use it whenever a customer asks.
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
              className="flex items-center gap-1.5 rounded-full border border-dashed border-blue-200 bg-blue-50/40 px-3.5 py-2 text-[12.5px] font-medium text-blue-700/80 transition-colors hover:border-blue-400 hover:text-blue-700"
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
        className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-blue-300 hover:text-blue-600"
      >
        <Plus className="h-3.5 w-3.5" />
        Add a question
      </motion.button>
    </div>
  );
}
