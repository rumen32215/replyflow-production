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
 */

import type { BusinessKnowledge } from "@/lib/knowledge";
import { type BookingRules, defaultAvailability, hasCustomizedBookingRules } from "@/lib/availability";

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

const TOPIC_DEFINITIONS: readonly TopicDef[] = [
  // Business Knowledge (8) — same ids as business-memory.tsx's SectionId.
  {
    id: "identity",
    domain: "knowledge",
    label: "a short introduction",
    href: "/dashboard/business",
    prompt: "Before I answer customers today — what would you like me to call your business, and how would you describe what you do?",
    done: (i) => Boolean(i.knowledge?.businessDescription?.trim()),
  },
  {
    id: "services",
    domain: "knowledge",
    label: "the services you offer",
    href: "/dashboard/business",
    prompt: "What kinds of jobs do you usually help people with?",
    done: (i) => Boolean(i.knowledge && i.knowledge.services.length > 0),
  },
  {
    id: "areas",
    domain: "knowledge",
    label: "the areas you cover",
    href: "/dashboard/business",
    prompt: "Where do you usually work?",
    done: (i) => Boolean(i.knowledge && i.knowledge.serviceAreas.length > 0),
  },
  {
    id: "special",
    domain: "knowledge",
    label: "what makes you special",
    href: "/dashboard/business",
    prompt: "What makes your business different from others customers might call instead?",
    done: (i) => Boolean(i.knowledge && i.knowledge.knowledge.personality.length > 0),
  },
  {
    id: "declined",
    domain: "knowledge",
    label: "jobs you don't take",
    href: "/dashboard/business",
    prompt: "Are there any jobs you don't take on?",
    done: (i) => Boolean(i.knowledge && i.knowledge.knowledge.jobsDeclined.length > 0),
  },
  {
    id: "payments",
    domain: "knowledge",
    label: "how customers can pay",
    href: "/dashboard/business",
    prompt: "I've realised customers keep asking how to pay. What should I tell them?",
    done: (i) => Boolean(i.knowledge && i.knowledge.knowledge.paymentMethods.length > 0),
  },
  {
    id: "guarantees",
    domain: "knowledge",
    label: "your guarantees",
    href: "/dashboard/business",
    prompt: "If someone asks whether your work is guaranteed, how would you normally answer?",
    done: (i) => Boolean(i.knowledge && i.knowledge.knowledge.guarantees.length > 0),
  },
  {
    id: "faqs",
    domain: "knowledge",
    label: "answers to common questions",
    href: "/dashboard/business",
    prompt: "Customers often ask the same questions. Would you like to teach me the answers?",
    done: (i) => Boolean(i.knowledge && i.knowledge.faqCount > 0),
  },
  // Receptionist (3) — matches exactly what TeachingCard sequencing covers today.
  {
    id: "behaviours",
    domain: "receptionist",
    label: "what I should always do",
    href: "/dashboard/receptionist",
    prompt: "What should I always do when someone gets in touch?",
    done: (i) => Boolean(i.receptionist?.behavioursTaught),
  },
  {
    id: "rules",
    domain: "receptionist",
    label: "your house rules",
    href: "/dashboard/receptionist",
    prompt: "Are there things I should never get wrong?",
    important: true,
    done: (i) => Boolean(i.receptionist?.rulesTaught),
  },
  {
    id: "escalation",
    domain: "receptionist",
    label: "when to hand off to you",
    href: "/dashboard/receptionist",
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

export interface Brain {
  topics: (Topic & { done: boolean })[];
  percent: number;
  percentFor: (domain: TopicDomain) => number;
  confidenceLabel: "Learning" | "Growing" | "Complete";
  gaps: Topic[];
  nextTopic: Topic | null;
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

export function confidenceLabelFor(percent: number): "Learning" | "Growing" | "Complete" {
  if (percent >= 100) return "Complete";
  if (percent >= 50) return "Growing";
  return "Learning";
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

  return {
    topics,
    percent,
    percentFor,
    confidenceLabel: confidenceLabelFor(percent),
    gaps,
    nextTopic: gaps[0] ?? null,
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
