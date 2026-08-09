import type { RawJobPhotoAnalysis, PhotoConfidence, PhotoPhase } from "./photo-schema";
import { BANNED_PATTERNS } from "./banned-patterns";

/**
 * ReplyFlow 2.0, Phase 2A — layer 3 of the photo-analysis safety
 * boundary: a deterministic, non-AI backstop, same pattern already
 * used in lib/reply-engine/safety/evaluate.ts (regex-based checks
 * behind the system prompt, never trusting prompt wording alone).
 *
 * Any field containing a banned pattern is blanked entirely — not
 * trimmed or edited — the safe default is "say nothing" over
 * "say something with the risky part surgically removed," since a
 * partial edit could still leave a misleading fragment. The pattern
 * list itself lives in ./banned-patterns.ts, shared with
 * report-validation.ts's equivalent backstop for job-report text —
 * see that file for the same "honest limitation" note, which applies
 * here identically.
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
