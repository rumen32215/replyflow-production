import type { ReplyContext } from "../context/types";
import type { UnderstandingResult } from "../understanding/types";
import { standingForDate, describeStanding } from "@/lib/availability";

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
export function collectFacts(context: ReplyContext, understanding: UnderstandingResult): Fact[] {
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
    // Fixes a real fact-drift bug found in production testing: the
    // model would answer a "what about tomorrow?" question using the
    // "today" fact (or invent one), because "tomorrow" was never
    // actually grounded in anything. standingForDate already supports
    // any date — it just had never been asked for one before.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStanding = standingForDate(context.diary.availability, tomorrow);
    facts.push({
      id: "diary.tomorrow",
      text: `Tomorrow (${tomorrow.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}): ${describeStanding(tomorrowStanding)}.`,
    });
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

  // Conversation State (Conversation Intelligence Sprint) — carried
  // forward turn by turn by the Understanding Engine (see
  // understanding/state.ts), never re-derived from raw history by this
  // call. This is what fixes re-greeting, re-asking answered questions,
  // and losing the thread: the model is TOLD where the conversation is
  // and what's already known, not left to infer it fresh every time.
  facts.push(...conversationStateFacts(understanding.conversationState, context.currentBooking));

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

const STAGE_GUIDANCE: Record<string, string> = {
  understand: "nothing has been established yet — find out what the customer actually needs.",
  diagnose: "working out what the problem or need actually is — ask one diagnostic question at a time.",
  collect: "the need is understood — you're gathering the specific details still missing (see collected/outstanding below) before a quote or booking can happen.",
  quote_or_book: "enough is known to offer a price or a visit — move to actually offering one, don't keep asking diagnostic questions.",
  confirm: "a booking has just been proposed or made — confirm it plainly, don't re-collect anything.",
  waiting: "a booking is confirmed and there's nothing further to do until the job happens — a plain acknowledgement from the customer here usually needs no reply at all.",
  completed: "the job for this conversation is done — treat any new message as a fresh enquiry, not a continuation.",
  closed: "this conversation is finished — treat any new message as a fresh enquiry.",
};

/** Turns Conversation State (understanding/state.ts) — carried forward
 * turn by turn, never re-derived from raw history — into the facts the
 * generation prompt actually reads. Reconciles with `booking.status`
 * (the real jobs-table ground truth) when they'd otherwise disagree:
 * ground truth always wins on whether a booking is real. */
function conversationStateFacts(
  state: UnderstandingResult["conversationState"],
  booking: ReplyContext["currentBooking"]
): Fact[] {
  const facts: Fact[] = [];

  let stage = state.stage;
  if (booking?.status === "booked" && (stage === "understand" || stage === "diagnose" || stage === "collect" || stage === "quote_or_book")) {
    stage = "confirm";
  }
  facts.push({
    id: "conversation.stage",
    text: `Stage: ${stage} — ${STAGE_GUIDANCE[stage] ?? STAGE_GUIDANCE.understand}. Never move backwards to an earlier stage unless the customer has clearly started a brand new, unrelated request.`,
  });

  const known = Object.entries(state.slots)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key} = "${value}"`);
  if (known.length > 0) {
    facts.push({
      id: "conversation.collected",
      text: `Already collected in this conversation, do not ask for again unless the customer changes it: ${known.join(", ")}.`,
    });
  }

  if (state.openQuestion) {
    facts.push({
      id: "conversation.open_question",
      text: `You are currently waiting to hear back on: "${state.openQuestion}". If the customer's new message answers this, treat it as answered — do not ask it again.`,
    });
  }

  if (state.greetingGiven) {
    facts.push({
      id: "conversation.greeting_given",
      text: "A greeting has already happened earlier in this conversation. Do not open this reply with a greeting or the customer's name again — just answer.",
    });
  }

  if (state.lastTopic) {
    facts.push({
      id: "conversation.topic",
      text: `Current live topic: ${state.lastTopic}. Stay on this — don't bring in an unrelated fact, a different job, or switch topics unless the customer does.`,
    });
  }

  // Goal (Sprint B) — one level above stage. A side-question doesn't
  // change it; only a genuinely different underlying request does.
  facts.push({
    id: "conversation.goal",
    text: `The customer's underlying goal is: ${state.goal.type} (${state.goal.status}). A side-question doesn't change this — only answer it and continue toward this goal, unless the customer has clearly asked for something fundamentally different.`,
  });

  // Commitments ledger (Sprint B) — outstanding items must be
  // acknowledged as still-open, never silently re-asked as if new.
  const outstanding = state.commitments.filter((c) => c.status === "outstanding");
  if (outstanding.length > 0) {
    facts.push({
      id: "conversation.outstanding_commitments",
      text: `Still outstanding, not yet resolved — check if THIS message resolves any of these before replying, and if not, it's fine to still be waiting, but don't re-ask as if it were a fresh question: ${outstanding
        .map((c) => `"${c.text}"`)
        .join("; ")}.`,
    });
  }
  const resolved = state.commitments.filter((c) => c.status === "resolved");
  if (resolved.length > 0) {
    facts.push({
      id: "conversation.resolved_commitments",
      text: `Already settled earlier in this conversation — do not re-ask or re-explain these: ${resolved.map((c) => `"${c.text}"`).join("; ")}.`,
    });
  }

  return facts;
}
