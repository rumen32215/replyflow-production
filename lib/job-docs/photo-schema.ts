/**
 * ReplyFlow 2.0, Phase 2A — layer 2 of the photo-analysis safety
 * boundary (system prompt / schema / validator / test fixtures). The
 * JSON schema structurally limits what the model can even return —
 * there is no field here for a price, a measurement, a compliance
 * verdict, or anything else the spec forbids; layer 3
 * (photo-validation.ts) is the backstop for banned *content* that
 * still slips into one of these free-text fields despite the prompt.
 */

export type PhotoConfidence = "low" | "medium" | "high";
export type PhotoPhase = "before" | "during" | "after" | "other";

export interface RawJobPhotoAnalysis {
  visibleSummary: string;
  possibleSummary: string;
  unknownNote: string;
  confidence: PhotoConfidence;
  suggestedPhase: PhotoPhase;
  caption: string;
}

export const JOB_PHOTO_ANALYSIS_SCHEMA_NAME = "job_photo_analysis";

export const JOB_PHOTO_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    visible_summary: { type: "string" },
    possible_summary: { type: "string" },
    unknown_note: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    suggested_phase: { type: "string", enum: ["before", "during", "after", "other"] },
    caption: { type: "string" },
  },
  required: ["visible_summary", "possible_summary", "unknown_note", "confidence", "suggested_phase", "caption"],
} as const;

/**
 * Unlike the WhatsApp photo analyzer (lib/reply-engine/vision/analyze-photo.ts),
 * an empty result here is a valid, complete answer ("nothing useful in
 * this photo"), never rejected — a job-record photo is the
 * tradesperson's own documentation, not something arriving mid-
 * conversation, so there's no fallback message to preserve by
 * rejecting an honest "nothing to say."
 */
export function parseJobPhotoAnalysisResponse(raw: unknown): RawJobPhotoAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.visible_summary !== "string" ||
    typeof r.possible_summary !== "string" ||
    typeof r.unknown_note !== "string" ||
    typeof r.caption !== "string"
  ) {
    return null;
  }
  const confidence: PhotoConfidence = r.confidence === "medium" || r.confidence === "high" ? r.confidence : "low";
  const suggestedPhase: PhotoPhase =
    r.suggested_phase === "before" || r.suggested_phase === "during" || r.suggested_phase === "after" ? r.suggested_phase : "other";

  return {
    visibleSummary: r.visible_summary.trim(),
    possibleSummary: r.possible_summary.trim(),
    unknownNote: r.unknown_note.trim(),
    caption: r.caption.trim(),
    confidence,
    suggestedPhase,
  };
}

/**
 * Written into job_doc_photos.unknown_note (never shown verbatim —
 * the photos GET route translates it into `analysisErrored: true`)
 * when analysis genuinely failed (network/API/parse error), as
 * distinct from a successful analysis that honestly found nothing
 * useful. No schema change needed for this distinction; see the
 * Phase 2A completion report for why this is a deliberate,
 * documented workaround rather than a new status column.
 */
export const ANALYSIS_ERROR_MARKER = "__job_doc_photo_analysis_error__";
