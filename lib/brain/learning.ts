/**
 * Learning Memory — Brain Loop Stage 8
 * (`DOCS/CONSTITUTION/12-ReplyFlow-Learning-Memory-Architecture.md`).
 *
 * This file holds only the one deterministic, no-AI decision the
 * architecture requires: is a real edit substantial enough to be
 * worth interpreting at all? Deciding *what* the edit might mean is a
 * genuinely interpretive question and belongs to the LLM-assisted
 * proposal step (`lib/reply-engine/learning/propose-lesson.ts`) — this
 * function's only job is the mechanical gate in front of it, so that
 * step never runs against a typo fix or a punctuation change.
 *
 * Pure and deterministic, matching every other module in lib/brain/:
 * no LLM call, no Supabase access, no I/O.
 */

/** Below this fraction of changed words, an edit reads as wording
 * polish, not a business-behaviour correction — a founder-set default,
 * not an evidence-calibrated threshold (the same honesty doc 11 and
 * doc 13 already apply to their own thresholds). Revisit once real
 * confirm/ignore history exists to check whether it's actually right. */
const MIN_CHANGED_WORD_FRACTION = 0.25;

/** Very short exchanges ("ok" -> "okay!") should never reach the LLM
 * step regardless of the fraction above — there's nothing a business
 * fact could hide in two words. */
const MIN_WORD_COUNT = 4;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * A simple, mechanical word-level diff — not a real diff algorithm,
 * just enough to answer "how much of this actually changed," which is
 * all the gate needs. Deliberately conservative: word-set overlap,
 * not position-aware, so reordering doesn't over-count as a change.
 */
function changedWordFraction(original: string, edited: string): number {
  const originalWords = words(original);
  const editedWords = words(edited);
  const totalWords = Math.max(originalWords.length, editedWords.length);
  if (totalWords === 0) return 0;

  const originalSet = new Map<string, number>();
  for (const w of originalWords) originalSet.set(w, (originalSet.get(w) ?? 0) + 1);

  let unchanged = 0;
  for (const w of editedWords) {
    const remaining = originalSet.get(w) ?? 0;
    if (remaining > 0) {
      unchanged += 1;
      originalSet.set(w, remaining - 1);
    }
  }

  const changed = totalWords - unchanged;
  return changed / totalWords;
}

export function isLearningCandidate(originalText: string, editedText: string): boolean {
  const original = originalText.trim();
  const edited = editedText.trim();
  if (!original || !edited || original === edited) return false;
  if (words(edited).length < MIN_WORD_COUNT) return false;

  return changedWordFraction(original, edited) >= MIN_CHANGED_WORD_FRACTION;
}
