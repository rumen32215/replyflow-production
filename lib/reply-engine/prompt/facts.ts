import type { ReplyContext } from "../context/types";

/** One bounded fact, stably identified so the generation LLM can cite
 * exactly which real fact it used (Sprint 9 §5: `facts_used`) and the
 * Safety Layer can verify every citation actually exists (§6 fact-
 * grounding check) — never a free-text citation the safety layer would
 * have to fuzzy-match. */
export interface Fact {
  id: string;
  text: string;
}

/**
 * Every bounded fact currently available to the prompt, flattened with
 * stable ids. Only ever built from context categories that were
 * actually fetched — a category the Understanding Engine didn't ask
 * for contributes zero facts, exactly like it contributes zero prompt
 * text.
 */
export function collectFacts(context: ReplyContext): Fact[] {
  const facts: Fact[] = [];
  const p = context.businessProfile;

  if (p) {
    facts.push({ id: "profile.name", text: `The business is called ${p.businessName}.` });
    if (p.description) facts.push({ id: "profile.description", text: p.description });
    p.services.forEach((s, i) => facts.push({ id: `profile.service.${i}`, text: `Offers: ${s}.` }));
    p.serviceAreas.forEach((a, i) => facts.push({ id: `profile.area.${i}`, text: `Covers the area: ${a}.` }));
    facts.push({ id: "profile.hours", text: `Normal opening hours are ${p.openingTime} to ${p.closingTime}.` });
    facts.push({
      id: "profile.emergency_callouts",
      text: p.offersEmergencyCallouts ? "Offers emergency call-outs." : "Does not offer emergency call-outs.",
    });
    facts.push({
      id: "profile.callout_fee",
      text: p.chargesCalloutFee
        ? `Charges a call-out fee${p.calloutFeeAmount ? ` of ${p.calloutFeeAmount}` : ""}.`
        : "Does not charge a call-out fee.",
    });
    p.knowledge.personality.forEach((t, i) => facts.push({ id: `profile.personality.${i}`, text: t }));
    p.knowledge.jobsDeclined.forEach((t, i) => facts.push({ id: `profile.declined.${i}`, text: `Does not take on: ${t}.` }));
    p.knowledge.guarantees.forEach((t, i) => facts.push({ id: `profile.guarantee.${i}`, text: `Guarantee: ${t}.` }));
    p.knowledge.paymentMethods.forEach((t, i) => facts.push({ id: `profile.payment.${i}`, text: `Accepts payment by: ${t}.` }));
    p.knowledge.certifications.forEach((t, i) => facts.push({ id: `profile.certification.${i}`, text: t }));
    if (p.knowledge.parkingAccess) facts.push({ id: "profile.parking", text: p.knowledge.parkingAccess });
    if (p.knowledge.emergencyNotes) facts.push({ id: "profile.emergency_notes", text: p.knowledge.emergencyNotes });
  }

  if (context.receptionist) {
    context.receptionist.faqs.forEach((f, i) =>
      facts.push({ id: `receptionist.faq.${i}`, text: `Q: ${f.question} — A: ${f.answer}` })
    );
  }

  if (context.diary) {
    facts.push({ id: "diary.today", text: context.diary.todaysAvailabilityReply });
    if (context.diary.nextAvailable) {
      facts.push({ id: "diary.next_available", text: `Next realistic availability: ${context.diary.nextAvailable.label}.` });
    }
  }

  if (context.customerJobs) {
    context.customerJobs.jobs.forEach((j, i) =>
      facts.push({
        id: `customer.job.${i}`,
        text: `${j.jobTitle} — status: ${j.status}${j.scheduledFor ? `, scheduled for ${new Date(j.scheduledFor).toLocaleDateString("en-GB")}` : ""}.`,
      })
    );
  }

  // Always present (Conversation Design Sprint) — the one fact that
  // exists specifically so the model never has to infer or guess
  // whether this conversation's booking is real. Every branch is
  // written to be unambiguous about what may and may not be claimed.
  const b = context.currentBooking;
  if (!b) {
    facts.push({
      id: "booking.status",
      text: "No booking exists for this conversation yet. Do not tell the customer they are booked — if asked, say a booking hasn't been arranged yet.",
    });
  } else if (b.status === "draft") {
    facts.push({
      id: "booking.status",
      text: `A booking draft exists for "${b.jobTitle}" but the owner has not approved it yet. Do not tell the customer they are booked — say it still needs to be confirmed.`,
    });
  } else if (b.status === "booked") {
    facts.push({
      id: "booking.status",
      text: `A booking is confirmed for "${b.jobTitle}"${
        b.scheduledFor ? `, scheduled for ${new Date(b.scheduledFor).toLocaleDateString("en-GB")}` : ""
      }. You may tell the customer they are booked.`,
    });
  } else if (b.status === "completed") {
    facts.push({ id: "booking.status", text: `The booking for "${b.jobTitle}" has already been completed.` });
  } else if (b.status === "cancelled") {
    facts.push({
      id: "booking.status",
      text: `A previous booking for "${b.jobTitle}" was cancelled. There is no active booking right now.`,
    });
  } else {
    facts.push({
      id: "booking.status",
      text: `There is a job record for "${b.jobTitle}" in status "${b.status}" — treat this as not yet confirmed unless the status is specifically "booked".`,
    });
  }

  // Conversation stage (Voice doc 07 §5) — computed deterministically
  // from data already assembled, never inferred by the generation model
  // from raw history. Exists so "never go backwards, never repeat a
  // stage" is a fact the model is told, not a pattern it has to notice
  // on its own in a 12-message window.
  facts.push(stageFact(context.currentBooking, context.conversationHistory));

  // Phrase memory (Voice doc 07 §5) — a small, deterministic,
  // non-model check: which of the known stock phrases has this
  // conversation already used. Converts "please don't repeat yourself"
  // from a request the model might ignore into a fact it can't.
  const alreadyUsed = detectUsedStockPhrases(context.conversationHistory);
  if (alreadyUsed.length > 0) {
    facts.push({
      id: "conversation.already_used_phrases",
      text: `Already used earlier in this conversation, do not use again: ${alreadyUsed.map((p) => `"${p}"`).join(", ")}.`,
    });
  }

  return facts;
}

const STOCK_PHRASES = [
  "let me know if you need anything else",
  "have a great day",
  "thank you for confirming",
  "i completely understand your frustration",
  "i hope this message finds you well",
  "no problem at all",
  "don't hesitate to reach out",
  "do not hesitate to reach out",
  "is there anything else i can help",
];

function detectUsedStockPhrases(history: ReplyContext["conversationHistory"]): string[] {
  if (!history) return [];
  const outboundText = history.messages
    .filter((m) => m.direction === "outbound")
    .map((m) => m.body.toLowerCase())
    .join(" \n ");
  if (!outboundText) return [];
  return STOCK_PHRASES.filter((phrase) => outboundText.includes(phrase));
}

function stageFact(
  booking: ReplyContext["currentBooking"],
  history: ReplyContext["conversationHistory"]
): Fact {
  const hasHistory = Boolean(history && history.messages.length > 0);

  if (booking?.status === "booked") {
    return {
      id: "conversation.stage",
      text:
        "Stage: Confirm/Close — a booking is already confirmed for this conversation. Do not re-collect information " +
        "already used to make it, do not re-explain the booking unless asked, and do not offer to book again. If the " +
        "customer's new message is just an acknowledgement with nothing new to address, the right move may be no " +
        "reply at all.",
    };
  }
  if (booking?.status === "draft") {
    return {
      id: "conversation.stage",
      text:
        "Stage: Quote or book — a booking has already been proposed and is waiting on the owner, not yet confirmed. " +
        "Do not ask again for information already collected to create it, and do not tell the customer it's confirmed.",
    };
  }
  if (booking?.status === "completed" || booking?.status === "cancelled") {
    return {
      id: "conversation.stage",
      text:
        "Stage: Understand — the previous booking for this conversation is finished or cancelled. Treat a new " +
        "message as a fresh enquiry from scratch, not a continuation of that old booking.",
    };
  }
  if (!hasHistory) {
    return {
      id: "conversation.stage",
      text: "Stage: Understand — this is the first message in this conversation. Nothing has been asked or answered yet.",
    };
  }
  return {
    id: "conversation.stage",
    text:
      "Stage: Diagnose/Collect — no booking exists yet for this conversation. Check the conversation history below " +
      "before asking anything: never ask again for a detail (symptom, postcode, preferred time, name) the customer " +
      "already gave earlier in this thread.",
  };
}
