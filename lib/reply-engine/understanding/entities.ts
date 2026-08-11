import type { PatternEntities } from "./types";
import type { ConversationState } from "./state";

/**
 * Deterministic, format-shaped entity extraction — no model, no
 * hallucination risk, free (Sprint 9.1 §2: "pattern-shaped entities...
 * deterministic regex/format parsing"). This is the one place the
 * Understanding Engine is allowed to use plain string matching, per
 * Sprint 10A's own instruction: "Do not use keyword matching unless
 * the architecture specifically calls for deterministic parsing
 * (phone numbers, dates, postcodes, etc.)."
 */

// UK mobile/landline shapes, loose enough to catch spaced/dashed forms
// a customer would actually type, tight enough not to swallow ordinary
// numbers mentioned in prose.
const PHONE_RE = /(?:\+44\s?|0)(?:\d\s?){9,10}/g;

// UK postcode format (outward + inward code).
const POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/gi;

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Explicit calendar-shaped dates only ("12/08", "12-08-2026", "12 August",
// "August 12th") — deliberately NOT relative words like "tomorrow" or
// "next week", which are meaning-shaped and belong to the classification
// call instead (Sprint 9.1 §2).
const NUMERIC_DATE_RE = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g;
const MONTH_NAMES =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
const WORDED_DATE_RE = new RegExp(`\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_NAMES})|(?:${MONTH_NAMES})\\s+\\d{1,2}(?:st|nd|rd|th)?)\\b`, "gi");

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

export function extractPatternEntities(text: string): PatternEntities {
  const phoneNumbers = uniq(text.match(PHONE_RE) ?? []).filter((m) => m.replace(/\D/g, "").length >= 10);
  const postcodes = uniq(text.match(POSTCODE_RE) ?? []);
  const emails = uniq(text.match(EMAIL_RE) ?? []);
  const explicitDates = uniq([...(text.match(NUMERIC_DATE_RE) ?? []), ...(text.match(WORDED_DATE_RE) ?? [])]);

  return { phoneNumbers, postcodes, emails, explicitDates };
}

/** ReplyFlow V2 (2026-08-11) — Proactive postcode qualification: the
 * `location` slot is defined (understanding/classify.ts's own
 * classification prompt) to hold postcode/address, but until now
 * capturing it depended entirely on the classification model noticing
 * and writing it — a real UK postcode typed by the customer should
 * never be lost just because that model call degraded or missed it in
 * a longer message. This backstop only ever *fills a gap* — it never
 * overwrites a value the customer (via the model) has already
 * confirmed, since a customer's own correction should always win over
 * a regex match from an earlier message. */
export function withPostcodeBackstop(state: ConversationState, patternEntities: PatternEntities): ConversationState {
  if (state.slots.location || patternEntities.postcodes.length === 0) return state;
  return { ...state, slots: { ...state.slots, location: patternEntities.postcodes[0]! } };
}
