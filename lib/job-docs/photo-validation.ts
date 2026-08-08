import type { RawJobPhotoAnalysis, PhotoConfidence, PhotoPhase } from "./photo-schema";

/**
 * ReplyFlow 2.0, Phase 2A — layer 3 of the photo-analysis safety
 * boundary: a deterministic, non-AI backstop, same pattern already
 * used in lib/reply-engine/safety/evaluate.ts (regex-based checks
 * behind the system prompt, never trusting prompt wording alone).
 *
 * Any field containing a banned pattern is blanked entirely — not
 * trimmed or edited — the safe default is "say nothing" over
 * "say something with the risky part surgically removed," since a
 * partial edit could still leave a misleading fragment.
 *
 * Honest limitation, not silently overclaimed: this reliably catches
 * measurements, test-occurred claims, compliance/certification
 * language, prices, unhedged diagnostic certainty, and danger
 * declarations — all patterns with recognisable vocabulary. It does
 * NOT reliably catch a person's name or a street address in free
 * text (no general-purpose PII detector exists here) — that
 * category depends on the system prompt (lib/job-docs/analysis.ts)
 * and, per the spec's own final requirement, human review remaining
 * the last gate.
 */

export interface JobPhotoAnalysis {
  visibleSummary: string;
  possibleSummary: string;
  unknownNote: string;
  caption: string;
  confidence: PhotoConfidence;
  suggestedPhase: PhotoPhase;
  /** True if any field was blanked for containing disallowed content
   * — the caller (lib/job-docs/analysis.ts) logs this as a warning
   * error_events entry for observability; never shown to the owner. */
  flagged: boolean;
}

const BANNED_PATTERNS: RegExp[] = [
  // Measurements / readings — voltage, current, pressure, temperature,
  // frequency, sound level, or a generic "reading of X" phrasing.
  /\b\d+(\.\d+)?\s?(v|volts?|amps?|amperes?|ohms?|hz|khz|kw|watts?|psi|bar|mm|cm|db)\b/i,
  /°\s?[cf]\b/i,
  /\b(reading of|measured at|reads?)\s*\d/i,
  // Claims that testing actually occurred, or a stated test result.
  /\b(tested and (passed|failed)|test(ed)? (confirms?|shows?|proves?)|passed (the )?test|failed (the )?test|test results?)\b/i,
  // Compliance / certification / regulatory judgments.
  /\bcomplies?( with)?\b/i,
  /\bcompliant\b/i,
  /\bcertificat\w*/i,
  /\bpart\s?p\b/i,
  /\bbs\s?\d{3,5}\b/i,
  /\bregulation\s?\d/i,
  /\bsatisfactory\b/i,
  /\bunsatisfactory\b/i,
  /\bc1\b|\bc2\b|\bc3\b|\bfi\b/i,
  // Prices/costs.
  /£\s?\d|\$\s?\d|\bprice\b|\bcost\b|\bquote\b/i,
  // Unhedged diagnostic certainty / professional conclusions.
  /\b(definitely|confirmed to be|diagnosed as|is certainly|without doubt|is faulty|has failed)\b/i,
  // Danger/safety declarations.
  /\b(is dangerous|is unsafe|is a hazard|hazardous)\b/i,
  // Invented identity/registration/serial/certificate numbers.
  /\bserial (no\.?|number)\b/i,
  /\breg(?:istration)? (no\.?|number)\b/i,
  /\bcertificate (no\.?|number)\b/i,
];

function scrub(text: string): { text: string; flagged: boolean } {
  if (!text) return { text: "", flagged: false };
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) return { text: "", flagged: true };
  }
  return { text, flagged: false };
}

export function validateJobPhotoAnalysis(raw: RawJobPhotoAnalysis): JobPhotoAnalysis {
  const visible = scrub(raw.visibleSummary);
  const possible = scrub(raw.possibleSummary);
  const unknown = scrub(raw.unknownNote);
  const caption = scrub(raw.caption);

  return {
    visibleSummary: visible.text,
    possibleSummary: possible.text,
    unknownNote: unknown.text,
    caption: caption.text,
    confidence: raw.confidence,
    suggestedPhase: raw.suggestedPhase,
    flagged: visible.flagged || possible.flagged || unknown.flagged || caption.flagged,
  };
}
