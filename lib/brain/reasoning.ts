/**
 * The shared reasoning model — pure functions only, no React, no
 * Supabase. Every screen that asks "what don't I know yet" or "how
 * confident am I" used to answer that independently (understandingScore
 * in three places, a separate receptionist topicsLearned/nextTopicId,
 * an inline taughtSignals average, two independent topGap fetches).
 * This file is the one mind those screens now read from instead of
 * each guessing on its own.
 *
 * Beyond gaps and confidence, `thoughts` is the same idea pushed one
 * step further: not just "what information exists" but "what is
 * ReplyFlow currently thinking" — what she's watching, what she's
 * already handled, what she's confident about, what still worries
 * her. Every field is built from real, already-known facts (taught
 * topics, real waiting/completed counts) — nothing here is invented
 * or inferred from message content (ReplyFlow never guesses).
 *
 * Sprint 6: relocated here unchanged from lib/intelligence.ts, which
 * is now a thin re-export shim so every existing caller keeps working.
 * `selectTodaysPriority` (previously lib/dashboard-signals.ts) joins
 * it below for the same reason — both are "priority selection" logic
 * as named in the Sprint 6 migration scope.
 */

import type { BusinessKnowledge } from "@/lib/knowledge";
import { type BookingRules, defaultAvailability, hasCustomizedBookingRules } from "@/lib/availability";
import { formatWaitingTime } from "@/lib/dashboard-signals";
import { confidenceLabelFor } from "./confidence";

export type TopicDomain = "knowledge" | "receptionist" | "diary";

export interface Topic {
  id: string;
  domain: TopicDomain;
  label: string;
  href: string;
  prompt: string;
  /** Safety-critical topics (house rules, escalation) — surfaced first
   * in `thoughts.worriesAbout` when still unknown. */
  important?: boolean;
}

export interface BrainInput {
  /** Business Knowledge's domain — omit on pages that don't teach it
   * (e.g. Receptionist); its topics simply read as "not yet known". */
  knowledge?: {
    businessDescription: string | null;
    services: string[];
    serviceAreas: string[];
    knowledge: BusinessKnowledge;
    faqCount: number;
  };
  /** Receptionist's domain — omit on pages that don't teach it. */
  receptionist?: {
    behavioursTaught: boolean;
    rulesTaught: boolean;
    escalationTaught: boolean;
  };
  /** Diary's domain — omit on pages that don't touch it. Never used
   * for teaching-card sequencing (the diary is configured on its own
   * full-page editor, not taught turn-by-turn) — feeds percent/gaps
   * only. */
  diary?: {
    rules: BookingRules;
  };
  /** Real, current activity — optional because not every page that
   * builds a Brain has conversation/job data to hand. Every `thought`
   * derived from this degrades to empty/false when omitted, never
   * invented. */
  activity?: {
    whatsappConnected: boolean;
    waitingCount: number;
    oldestWaitingName: string | null;
    oldestWaitingMinutes: number | null;
    completedToday: number;
    bookedToday: number;
  };
}

interface TopicDef extends Topic {
  done: (input: BrainInput) => boolean;
}

/**
 * Sprint 8.6: `href` now carries `?topic=<id>` so a Recommendations
 * click lands on the exact topic that was recommended, not wherever
 * the destination page's own auto-advance happens to open — clicking
 * "Teach me your guarantees" used to be able to land on a completely
 * different open section if it wasn't that page's own first gap. The
 * destination pages read this param once, on the first render only
 * (see business-memory.tsx / receptionist-playground.tsx); normal
 * direct navigation without the param keeps auto-advancing exactly as
 * before.
 */
const TOPIC_DEFINITIONS: readonly TopicDef[] = [
  // Business Knowledge (8) — same ids as business-memory.tsx's SectionId.
  {
    id: "identity",
    domain: "knowledge",
    label: "a short introduction",
    href: "/dashboard/business?topic=identity",
    prompt: "Before I answer customers today — what would you like me to call your business, and how would you describe what you do?",
    done: (i) => Boolean(i.knowledge?.businessDescription?.trim()),
  },
  {
    id: "services",
    domain: "knowledge",
    label: "the services you offer",
    href: "/dashboard/business?topic=services",
    prompt: "What kinds of jobs do you usually help people with?",
    done: (i) => Boolean(i.knowledge && i.knowledge.services.length > 0),
  },
  {
    id: "areas",
    domain: "knowledge",
    label: "the areas you cover",
    href: "/dashboard/business?topic=areas",
    prompt: "Where do you usually work?",
    done: (i) => Boolean(i.knowledge && i.knowledge.serviceAreas.length > 0),
  },
  {
    id: "special",
    domain: "knowledge",
    label: "what makes you special",
    href: "/dashboard/business?topic=special",
    prompt: "What makes your business different from others customers might call instead?",
    done: (i) => Boolean(i.knowledge && i.knowledge.knowledge.personality.length > 0),
  },
  {
    id: "declined",
    domain: "knowledge",
    label: "jobs you don't take",
    href: "/dashboard/business?topic=declined",
    prompt: "Are there any jobs you don't take on?",
    done: (i) => Boolean(i.knowledge && i.knowledge.knowledge.jobsDeclined.length > 0),
  },
  {
    id: "payments",
    domain: "knowledge",
    label: "how customers can pay",
    href: "/dashboard/business?topic=payments",
    prompt: "I've realised customers keep asking how to pay. What should I tell them?",
    done: (i) => Boolean(i.knowledge && i.knowledge.knowledge.paymentMethods.length > 0),
  },
  {
    id: "guarantees",
    domain: "knowledge",
    label: "your guarantees",
    href: "/dashboard/business?topic=guarantees",
    prompt: "If someone asks whether your work is guaranteed, how would you normally answer?",
    done: (i) => Boolean(i.knowledge && i.knowledge.knowledge.guarantees.length > 0),
  },
  {
    id: "faqs",
    domain: "knowledge",
    label: "answers to common questions",
    href: "/dashboard/business?topic=faqs",
    prompt: "Customers often ask the same questions. Would you like to teach me the answers?",
    done: (i) => Boolean(i.knowledge && i.knowledge.faqCount > 0),
  },
  // Receptionist (3) — matches exactly what TeachingCard sequencing covers today.
  {
    id: "behaviours",
    domain: "receptionist",
    label: "what I should always do",
    href: "/dashboard/receptionist?topic=behaviours",
    prompt: "What should I always do when someone gets in touch?",
    done: (i) => Boolean(i.receptionist?.behavioursTaught),
  },
  {
    id: "rules",
    domain: "receptionist",
    label: "your house rules",
    href: "/dashboard/receptionist?topic=rules",
    prompt: "Are there things I should never get wrong?",
    important: true,
    done: (i) => Boolean(i.receptionist?.rulesTaught),
  },
  {
    id: "escalation",
    domain: "receptionist",
    label: "when to hand off to you",
    href: "/dashboard/receptionist?topic=escalation",
    prompt: "When should I stop and come get you?",
    important: true,
    done: (i) => Boolean(i.receptionist?.escalationTaught),
  },
  // Diary (1) — percent/gaps only, never a TeachingCard.
  {
    id: "diary",
    domain: "diary",
    label: "how you like your diary managed",
    href: "/dashboard/availability",
    prompt: "Let's set up how I protect your time — notice periods, busy days, and when to say no.",
    done: (i) => hasCustomizedBookingRules(i.diary?.rules ?? defaultAvailability().rules),
  },
];

/**
 * One thing the Brain is thinking, in its own calm voice — the unit
 * every screen renders identically via `components/shared/insight.tsx`.
 * This is the actual product concept: no page decides what's worth
 * observing, they only ask the Brain and render what it hands back.
 * `priority` is what keeps this calm rather than noisy — every
 * consumer caps how many it shows (usually 1), so on a quiet day nothing
 * appears at all rather than padding the list with filler.
 */
export interface Observation {
  id: string;
  text: string;
  tone: "watching" | "handled" | "worry" | "learning" | "confident";
  href?: string;
  priority: number;
}

export interface Brain {
  topics: (Topic & { done: boolean })[];
  percent: number;
  percentFor: (domain: TopicDomain) => number;
  confidenceLabel: "Learning" | "Growing" | "Complete";
  gaps: Topic[];
  nextTopic: Topic | null;
  /** The unified, ranked stream — see `Observation` above. */
  observations: Observation[];
  thoughts: {
    watching: string[];
    handled: string[];
    confidentAbout: Topic[];
    worriesAbout: Topic[];
    nextToLearn: Topic | null;
    readyToActAlone: boolean;
    needsYourReview: string[];
  };
}
export function buildBrain(input: BrainInput): Brain {
  const topics = TOPIC_DEFINITIONS.map((def) => ({ ...def, done: def.done(input) }));

  const percentFor = (domain: TopicDomain): number => {
    const inDomain = topics.filter((t) => t.domain === domain);
    if (inDomain.length === 0) return 100;
    return Math.round((inDomain.filter((t) => t.done).length / inDomain.length) * 100);
  };

  // An explicit, even 3-way blend across domains — replaces the old ad
  // hoc 50/50 knowledge/receptionist average now that diary counts too.
  const domains: TopicDomain[] = ["knowledge", "receptionist", "diary"];
  const percent = Math.round(domains.reduce((sum, d) => sum + percentFor(d), 0) / domains.length);

  const gaps = topics.filter((t) => !t.done);
  const confidentAbout = topics.filter((t) => t.done);
  const worriesAbout = gaps.filter((t) => t.important);

  const activity = input.activity;
  const watching: string[] = [];
  const handled: string[] = [];
  const needsYourReview: string[] = [];

  if (activity) {
    if (activity.waitingCount > 0 && activity.oldestWaitingName && activity.oldestWaitingMinutes !== null) {
      const suffix = activity.waitingCount > 1 ? ` (and ${activity.waitingCount - 1} more)` : "";
      watching.push(`${activity.oldestWaitingName} has been waiting${suffix}`);
      needsYourReview.push(
        `${activity.waitingCount} ${activity.waitingCount === 1 ? "conversation" : "conversations"} waiting on you`
      );
    }
    if (activity.completedToday > 0) {
      handled.push(`${activity.completedToday} ${activity.completedToday === 1 ? "job" : "jobs"} completed today`);
    }
    if (activity.bookedToday > 0) {
      handled.push(`${activity.bookedToday} ${activity.bookedToday === 1 ? "job" : "jobs"} booked in today`);
    }
  }

  // The unified stream — built from the exact same real facts above,
  // never a second, independently-invented set. Ranked so the most
  // urgent real thing always wins; every consumer decides only how
  // many of these it has room to show, never what they are.
  //
  // Scoped to domains this caller actually supplied: a page that only
  // passes `receptionist` (e.g. the Receptionist page) never sees a
  // Business Knowledge gap surface as if it were its own — omitted
  // domains read as "not done" for percent/gap-list purposes, but they
  // must never leak into what a specific page claims to be thinking.
  const providedDomains = new Set<TopicDomain>([
    ...(input.knowledge ? (["knowledge"] as const) : []),
    ...(input.receptionist ? (["receptionist"] as const) : []),
    ...(input.diary ? (["diary"] as const) : []),
  ]);
  const relevantGaps = gaps.filter((t) => providedDomains.has(t.domain));
  const relevantWorries = worriesAbout.filter((t) => providedDomains.has(t.domain));

  const observations: Observation[] = [];

  if (activity && activity.waitingCount > 0 && activity.oldestWaitingName && activity.oldestWaitingMinutes !== null) {
    const suffix = activity.waitingCount > 1 ? ` (and ${activity.waitingCount - 1} more)` : "";
    observations.push({
      id: "watching:waiting",
      text: `${activity.oldestWaitingName} has been waiting${suffix}`,
      tone: "watching",
      priority: 1,
    });
  }

  const topWorry = relevantWorries[0];
  if (topWorry) {
    observations.push({
      id: `worry:${topWorry.id}`,
      text: `I still don't know ${topWorry.label} — that's worth teaching me soon`,
      tone: "worry",
      href: topWorry.href,
      priority: 2,
    });
  }

  const topLearning = relevantGaps.find((g) => g !== topWorry);
  if (topLearning) {
    observations.push({
      id: `learning:${topLearning.id}`,
      text: `I'd like to learn ${topLearning.label} next`,
      tone: "learning",
      href: topLearning.href,
      priority: 3,
    });
  }

  if (activity?.completedToday) {
    observations.push({
      id: "handled:completed",
      text: `${activity.completedToday} ${activity.completedToday === 1 ? "job" : "jobs"} completed today`,
      tone: "handled",
      priority: 4,
    });
  }
  if (activity?.bookedToday) {
    observations.push({
      id: "handled:booked",
      text: `${activity.bookedToday} ${activity.bookedToday === 1 ? "job" : "jobs"} booked in today`,
      tone: "handled",
      priority: 4,
    });
  }

  if (relevantGaps.length === 0 && providedDomains.size > 0) {
    // Scoped to what this caller actually asked about — a single-domain
    // page (e.g. Receptionist) never claims to know the whole business.
    const allThree = providedDomains.size === 3;
    const text = allThree
      ? "I know everything I need — your business, how you like things run, and your diary"
      : providedDomains.has("receptionist")
        ? "I know exactly how you like things run"
        : providedDomains.has("knowledge")
          ? "I know everything I need about your business"
          : "I know how you like your diary managed";
    observations.push({ id: "confident:complete", text, tone: "confident", priority: 5 });
  }

  observations.sort((a, b) => a.priority - b.priority);

  return {
    topics,
    percent,
    percentFor,
    confidenceLabel: confidenceLabelFor(percent),
    gaps,
    nextTopic: gaps[0] ?? null,
    observations,
    thoughts: {
      watching,
      handled,
      confidentAbout,
      worriesAbout,
      nextToLearn: gaps[0] ?? null,
      // A setup-readiness signal, not a claim that automated replying
      // is live today (it isn't) — WhatsApp connected plus the two
      // safety-critical receptionist topics taught.
      readyToActAlone:
        Boolean(activity?.whatsappConnected) &&
        topics.filter((t) => t.domain === "receptionist").every((t) => t.done),
      needsYourReview,
    },
  };
}

/**
 * Front Desk V4 (Sprint 3 rebuild) — "Today's Priority" is exactly one
 * headline fact, chosen by a fixed precedence, never a fabricated
 * score: a real waiting customer always outranks a real job, which
 * always outranks "nothing's happening." Every branch only fires from
 * a fact this page already fetched — nothing here is invented.
 */
export interface TodaysPriorityInput {
  waitingCustomer: { name: string; minutes: number; conversationId: string } | null;
  waitingCount: number;
  currentJob: { title: string; customerName: string } | null;
  nextJob: { title: string; customerName: string; scheduledFor: string | null } | null;
  jobsBookedToday: number;
}

export interface TodaysPriority {
  headline: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
  tone: "urgent" | "active" | "calm";
}

export function selectTodaysPriority({
  waitingCustomer,
  waitingCount,
  currentJob,
  nextJob,
  jobsBookedToday,
}: TodaysPriorityInput): TodaysPriority {
  if (waitingCustomer) {
    const suffix = waitingCount > 1 ? ` — and ${waitingCount - 1} more waiting` : "";
    return {
      headline: `${waitingCustomer.name} is waiting`,
      detail: `Waiting ${formatWaitingTime(waitingCustomer.minutes)}${suffix}.`,
      actionLabel: "Reply now",
      actionHref: `/dashboard/conversations/${waitingCustomer.conversationId}`,
      tone: "urgent",
    };
  }

  if (currentJob) {
    return {
      headline: `You're at ${currentJob.title}`,
      detail: `${currentJob.customerName} — nothing else needs you while you're on site.`,
      actionLabel: "View diary",
      actionHref: "/dashboard/availability",
      tone: "active",
    };
  }

  if (nextJob) {
    const time = nextJob.scheduledFor
      ? new Date(nextJob.scheduledFor).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })
      : null;
    return {
      headline: `Next up: ${nextJob.title}`,
      detail: time ? `${nextJob.customerName} at ${time}.` : `${nextJob.customerName}.`,
      actionLabel: "View diary",
      actionHref: "/dashboard/availability",
      tone: "active",
    };
  }

  if (jobsBookedToday > 0) {
    return {
      headline: "Today is fully handled",
      detail: `${jobsBookedToday} ${jobsBookedToday === 1 ? "job" : "jobs"} booked in — nothing else needs your attention.`,
      actionLabel: "View diary",
      actionHref: "/dashboard/availability",
      tone: "calm",
    };
  }

  return {
    headline: "A quiet day so far",
    detail: "Nothing booked and nobody waiting — I'll let you know the moment that changes.",
    actionLabel: "View diary",
    actionHref: "/dashboard/availability",
    tone: "calm",
  };
}
