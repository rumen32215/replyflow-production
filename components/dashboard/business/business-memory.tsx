"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, ChevronDown, Plus, X } from "lucide-react";
import { SettleCard, EASE, press } from "@/components/shared/motion";
import { Acknowledgement, ACK, randomAck, useAcknowledgement } from "@/components/shared/acknowledgement";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  logoUrl: string | null;
  phone: string;
  description: string;
  services: string[];
  serviceAreas: string[];
  /** null = never confirmed either way (Product Guarantee 1) — a
   * ToggleRow needs a boolean to render, so this only ever displays as
   * "off" for null, but the update payload preserves the real
   * three-way state until the owner actually touches the toggle. */
  offersEmergency: boolean | null;
  chargesCalloutFee: boolean | null;
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
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
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
  // Data-loss defence (RC1 fix): this page's initial state is hydrated
  // once from the server and never guaranteed fresh (session timing,
  // a stale read, anything). The old save always re-wrote every field
  // from client state, so if any one field's hydration was ever wrong,
  // an edit to a completely unrelated field (e.g. the About text)
  // silently overwrote a real DB value with that stale one — this is
  // exactly how a real FAQ wipe was observed. `touched` records only
  // the fields the owner has genuinely edited this session; the save
  // below writes ONLY those, so a field that was never touched can
  // never be clobbered by however its initial value got hydrated.
  const touched = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const thisRequest = ++requestId.current;
      startSaving();
      try {
        const businessPatch: Record<string, unknown> = {};
        if (touched.current.has("businessName")) businessPatch.business_name = businessName.trim() || initial.businessName;
        if (touched.current.has("phone")) businessPatch.phone = phone.trim();
        if (touched.current.has("description")) businessPatch.business_description = description.trim() || null;
        if (touched.current.has("services")) businessPatch.services = services;
        if (touched.current.has("serviceAreas")) businessPatch.service_areas = serviceAreas;
        if (touched.current.has("offersEmergency")) businessPatch.offers_emergency_callouts = offersEmergency;
        if (touched.current.has("chargesCalloutFee") || touched.current.has("calloutFeeAmount")) {
          businessPatch.charges_callout_fee = chargesCalloutFee;
          businessPatch.callout_fee_amount = chargesCalloutFee ? calloutFeeAmount.trim() || null : null;
        }
        if (touched.current.has("knowledge")) businessPatch.business_knowledge = knowledge;

        const writes: PromiseLike<{ error: { message: string } | null }>[] = [];
        if (Object.keys(businessPatch).length > 0) {
          writes.push(supabase.from("businesses").update(businessPatch).eq("id", businessId));
        }
        if (touched.current.has("faqs")) {
          const cleanedFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
          writes.push(supabase.from("ai_configurations").upsert({ business_id: businessId, faqs: cleanedFaqs }, { onConflict: "business_id" }));
        }
        if (writes.length === 0) return;
        const results = await Promise.all(writes);
        if (thisRequest !== requestId.current) return;
        if (results.some((r) => r.error)) softError();
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

  function learn<T>(field: string, apply: () => T, ack?: string) {
    touched.current.add(field);
    ackRef.current = ack ?? randomAck();
    return apply();
  }

  function patchKnowledge(patch: Partial<BusinessKnowledge>, ack?: string) {
    touched.current.add("knowledge");
    ackRef.current = ack ?? randomAck();
    setKnowledge((k) => ({ ...k, ...patch }));
  }

  /* Immediate upload, same as every other logo-adjacent flow this
   * project has had (this project's first-ever Supabase Storage
   * upload, originally on Settings — Blueprint moved the field here,
   * not the upload logic, which is unchanged). */
  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      softError();
      return;
    }
    setLogoUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${businessId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("business-assets")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) {
        setLogoUploading(false);
        softError();
        return;
      }
      const { data } = supabase.storage.from("business-assets").getPublicUrl(path);
      const freshUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: updateError } = await supabase.from("businesses").update({ logo_url: freshUrl }).eq("id", businessId);
      setLogoUploading(false);
      if (updateError) {
        softError();
        return;
      }
      setLogoUrl(freshUrl);
      acknowledge("Nice. That's how customers will see you.");
    } catch {
      setLogoUploading(false);
      softError();
    }
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
  // Release polish (Hiring Experience redesign): a percentage here is
  // exactly what 03-Trust-Experience.md §7 already forbids for the
  // Confidence Timeline ("not a score, not a percentage") — that law
  // was never checked against this screen. `knowledgeGaps` (the same
  // real, honest facts the old percent bar was quietly summarising)
  // replaces it: what's actually still unknown, stated as sentences.
  const knowledgeGaps = brain.gaps.filter((g) => g.domain === "knowledge");

  // A real, rare celebration — not another reassurance on every edit.
  // Re-keyed off the gap list emptying rather than a percent crossing
  // a threshold — same real signal, no percentage involved.
  const hadGapsRef = useRef(knowledgeGaps.length > 0);
  const celebratedHalfwayRef = useRef(false);
  useEffect(() => {
    const totalKnowledgeTopics = brain.topics.filter((t) => t.domain === "knowledge").length;
    const doneCount = totalKnowledgeTopics - knowledgeGaps.length;
    if (hadGapsRef.current && knowledgeGaps.length === 0) {
      ackRef.current = "Your business profile is complete.";
    } else if (!celebratedHalfwayRef.current && totalKnowledgeTopics > 0 && doneCount / totalKnowledgeTopics >= 0.5) {
      ackRef.current = "Halfway there — your profile is filling out nicely.";
      celebratedHalfwayRef.current = true;
    }
    hadGapsRef.current = knowledgeGaps.length > 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgeGaps.length]);

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
          <div className="flex items-center gap-3.5 pb-1">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              aria-label="Upload business logo"
              className="group relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full disabled:opacity-60"
            >
              <Avatar className="h-14 w-14 border border-border">
                {logoUrl && <AvatarImage src={logoUrl} alt={businessName} />}
                <AvatarFallback className="text-[15px]">{(businessName || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-transparent transition-all group-hover:bg-black/40 group-hover:text-white">
                <Camera className="h-4 w-4" />
              </span>
            </button>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold">Business logo</p>
              <p className="text-[12px] text-muted-foreground">{logoUploading ? "Uploading…" : "Shown throughout your dashboard"}</p>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoSelect}
              className="hidden"
              aria-hidden
            />
          </div>
          <MemoryField
            label="Business name"
            value={businessName}
            onChange={(v) => learn("businessName", () => setBusinessName(v))}
            placeholder="e.g. Dales Plumbing"
          />
          <MemoryField
            label="Phone number"
            value={phone}
            onChange={(v) => learn("phone", () => setPhone(v))}
            placeholder="So customers can reach you directly"
            type="tel"
          />
          <MemoryTextarea
            label="About your business"
            value={description}
            onChange={(v) => learn("description", () => setDescription(v))}
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
          onChange={(next) => learn("services", () => setServices(next))}
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
            onChange={(next) => learn("serviceAreas", () => setServiceAreas(next))}
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
          {/* Hiring Experience redesign: a real scenario, not a settings
           * label — "would you go out for something like that" is the
           * actual question a receptionist would need answered, and the
           * call-out fee only follows naturally once the answer is yes,
           * the same way a real conversation would raise it. */}
          <ToggleRow
            label="Would you go out for something like that?"
            description="It's 11pm and someone messages saying their boiler's leaking badly — I'll only ever offer this once you've said yes."
            checked={offersEmergency === true}
            onChange={(v) => learn("offersEmergency", () => setOffersEmergency(v), ACK.updated)}
          />
          <AnimatePresence initial={false}>
            {offersEmergency === true && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="pt-1">
                  <ToggleRow
                    label="Is there a call-out fee on top?"
                    description="So I can mention it upfront, before they're surprised by it."
                    checked={chargesCalloutFee === true}
                    onChange={(v) => learn("chargesCalloutFee", () => setChargesCalloutFee(v), ACK.updated)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
                    onChange={(v) => learn("calloutFeeAmount", () => setCalloutFeeAmount(v))}
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
      title: "What's something customers ask you almost every day?",
      content: <FaqEditor faqs={faqs} onChange={(next, ack) => learn("faqs", () => setFaqs(next), ack)} />,
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
        const base =
          justCompleted === "identity"
            ? "Perfect. I can now introduce your business."
            : justCompleted === "scope"
              ? "Got it. I know what you do and where."
              : justCompleted === "commercial"
                ? "Noted. I know how you like to be paid."
                : "Thanks. That's everything I need for now.";
        // Hiring Experience redesign: name what's next, in her voice,
        // instead of a silent auto-advance — "she leads the interview"
        // said out loud, not just implied by which card opens.
        ackRef.current = firstIncompleteGroup ? `${base} Next, let's cover ${GROUP_LABEL[firstIncompleteGroup].toLowerCase()}.` : base;
      }
    }
    prevFirstIncomplete.current = firstIncompleteGroup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstIncompleteGroup]);

  /* ------------------------------ layout ------------------------------- */

  return (
    <div className="mx-auto max-w-5xl">
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
            <p className="text-[13.5px] font-bold">Where things stand</p>
            <AnimatePresence mode="wait" initial={false}>
              {knowledgeGaps.length === 0 ? (
                <motion.p
                  key="complete"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground"
                >
                  Your profile is complete. Keep it updated whenever something changes.
                </motion.p>
              ) : (
                <motion.div key="gaps" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2.5">
                  <p className="mb-1.5 text-[13px] leading-relaxed text-muted-foreground">Still worth teaching me:</p>
                  <ul className="space-y-1">
                    {knowledgeGaps.map((gap) => (
                      <li key={gap.id} className="text-[13px] leading-relaxed text-muted-foreground">
                        · {gap.label}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </SettleCard>

          {/* Release polish (ReplyFlow v1 Polish Pass): "Business profile"
           * was a leftover from before this page was renamed to "Your
           * business" (Sprint 8.7) — the old name surviving right next
           * to the new one read as a real inconsistency, not just a
           * label. "Preview" names what the card actually is (a live
           * "how this looks to someone new" summary), matching its own
           * doc comment on BusinessProfileCard below. */}
          <p className="mb-2 mt-5 px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Preview
          </p>
          <BusinessProfileCard
            businessName={businessName || initial.businessName}
            logoUrl={logoUrl}
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
  logoUrl,
  description,
  services,
  serviceAreas,
  offersEmergency,
}: {
  businessName: string;
  logoUrl: string | null;
  description: string;
  services: string[];
  serviceAreas: string[];
  offersEmergency: boolean | null;
}) {
  // Hiring Experience redesign: this card is the Business page's own
  // "proof" surface (no chat/phone preview here — see the Sprint 8.7
  // note above on why that's deliberate). A brief highlight whenever
  // its real, rendered content changes is how "she's getting it" stays
  // visible here too, without reintroducing the preview that already
  // tested badly on this exact page.
  const signature = JSON.stringify([businessName, description, services, serviceAreas, offersEmergency]);
  const firstSignature = useRef(signature);
  const [justUpdated, setJustUpdated] = useState(false);
  useEffect(() => {
    if (signature === firstSignature.current) return;
    firstSignature.current = signature;
    setJustUpdated(true);
    const t = setTimeout(() => setJustUpdated(false), 900);
    return () => clearTimeout(t);
  }, [signature]);

  const restShadow = "0 1px 2px 0 rgba(0,0,0,0.05)";
  return (
    <motion.div
      animate={{
        boxShadow: justUpdated ? `${restShadow}, 0 0 0 3px rgba(37,99,235,0.18)` : `${restShadow}, 0 0 0 0px rgba(37,99,235,0)`,
      }}
      transition={{ duration: justUpdated ? 0.15 : 0.7, ease: EASE }}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-11 w-11 border border-border">
          {logoUrl && <AvatarImage src={logoUrl} alt="" />}
          <AvatarFallback className="bg-accent text-[15px] font-bold text-primary">
            {(businessName || "?").slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
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
    </motion.div>
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

function FaqEditor({ faqs, onChange }: { faqs: Faq[]; onChange: (faqs: Faq[], ack?: string) => void }) {
  function update(index: number, patch: Partial<Faq>) {
    onChange(faqs.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  // Hiring Experience redesign: reflect the specific answer back
  // ("next time someone asks about X, I'll say exactly that") instead
  // of a generic "Saved" — proof the answer landed somewhere real, not
  // just a table row. Computed from the current field values on every
  // keystroke (not a one-off "just transitioned" flag), so whatever
  // the state is when the debounced save actually fires, the
  // acknowledgement it shows is still accurate.
  function updateAnswer(index: number, answer: string) {
    const next = faqs.map((f, i) => (i === index ? { ...f, answer } : f));
    const question = faqs[index]?.question.trim();
    const ack =
      answer.trim() && question
        ? `Got it — next time someone asks ${question.replace(/\?+$/, "").toLowerCase()}, I'll say exactly that.`
        : undefined;
    onChange(next, ack);
  }

  const askedAlready = new Set(faqs.map((f) => f.question.trim()));
  const suggestedQuestions = FAQ_SUGGESTIONS.filter((q) => !askedAlready.has(q));

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Teach me the answer once, and I&apos;ll give it every time — word for word, never a guess.
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
              onChange={(e) => updateAnswer(index, e.target.value)}
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
        Something else customers ask
      </motion.button>
    </div>
  );
}
