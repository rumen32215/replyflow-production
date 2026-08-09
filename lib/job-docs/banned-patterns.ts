/**
 * ReplyFlow 2.0 — the one shared list of deterministic, non-AI content
 * patterns banned from anything AI-generated that could reach a
 * customer-facing document. Two call sites share this exact list
 * rather than maintaining two forks of it: lib/job-docs/photo-
 * validation.ts (photo analysis text) and lib/job-docs/report-
 * validation.ts (job report draft text). Both apply it only to
 * AI-generated output, never to a tradesperson's own typed words —
 * see each call site for exactly where that boundary sits.
 *
 * Honest limitation, not silently overclaimed: this reliably catches
 * measurements, test-occurred claims, compliance/certification
 * language, prices, unhedged diagnostic certainty, and danger
 * declarations — all patterns with recognisable vocabulary. It does
 * NOT reliably catch a person's name or a street address in free
 * text (no general-purpose PII detector exists here) — that category
 * depends on each call site's own system prompt, and human review
 * remaining the last gate.
 */

export const BANNED_PATTERNS: RegExp[] = [
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
