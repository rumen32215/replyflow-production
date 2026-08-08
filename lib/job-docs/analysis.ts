import "server-only";
import { getCompletion } from "@/lib/reply-engine/llm/client";
import { recordErrorEvent } from "@/lib/error-events";
import type { createServiceClient } from "@/lib/supabase/service";
import {
  JOB_PHOTO_ANALYSIS_SCHEMA,
  JOB_PHOTO_ANALYSIS_SCHEMA_NAME,
  parseJobPhotoAnalysisResponse,
  ANALYSIS_ERROR_MARKER,
} from "./photo-schema";
import { validateJobPhotoAnalysis, type JobPhotoAnalysis } from "./photo-validation";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * ReplyFlow 2.0, Phase 2A — layer 1 of the photo-analysis safety
 * boundary: the system prompt. Reuses the one shared LLM client
 * (lib/reply-engine/llm/client.ts) — no second AI provider. Distinct
 * from lib/reply-engine/vision/analyze-photo.ts (the WhatsApp photo
 * analyzer): that photo arrives mid-conversation from a customer; this
 * one is the tradesperson's own job-documentation photo, and the
 * boundary list here is considerably longer — this is a camera with a
 * memory, never an inspector.
 */
const SYSTEM_PROMPT =
  "You are looking at a photo a UK tradesperson took themselves while working, for their own job record — not a " +
  "photo sent by a customer. Describe strictly and only what is visible.\n\n" +
  "You must NEVER, under any circumstance:\n" +
  "- diagnose a fault or state a cause with certainty\n" +
  "- declare something dangerous, unsafe, or a hazard\n" +
  "- make any compliance or regulatory judgment — never say something complies with, passes, fails, or meets/" +
  "doesn't meet any regulation, standard, or classification code\n" +
  "- invent or estimate any measurement, reading, or test result (voltage, current, pressure, temperature, or " +
  "anything else) unless a display, gauge, or label showing that exact value is directly, legibly visible in the " +
  "photo\n" +
  "- claim that testing occurred, unless a testing device actively showing a result is directly visible\n" +
  "- invent certification, registration, or serial number information\n" +
  "- invent a price or cost\n" +
  "- identify or name any person\n" +
  "- describe or transcribe any personal, identifying, or sensitive information visible in the photo (names, " +
  "addresses, documents, screens, post, ID) — if something like this is visible, note only that something of " +
  "that kind appears present, never its content\n" +
  "- state a professional or engineering conclusion\n\n" +
  "Describe in three separate categories, never blending them:\n" +
  "- visible_summary: only what is literally, objectively visible. No interpretation.\n" +
  "- possible_summary: what the visible details might indicate — always hedged (\"may suggest\", \"could " +
  "indicate\", \"possibly\"), never stated as certain.\n" +
  "- unknown_note: what genuinely cannot be determined from a photo alone.\n\n" +
  "Also provide:\n" +
  "- confidence: your own honest confidence in what you wrote (low/medium/high)\n" +
  "- suggested_phase: your best guess at whether this looks like \"before\", \"during\", \"after\", or \"other\" " +
  "relative to the work — this is only ever a suggestion the tradesperson can correct, never treated as fact\n" +
  "- caption: one short, plain, factual sentence (under 12 words), suitable as a photo caption — not " +
  "promotional, not a diagnosis\n\n" +
  "If the photo is unclear, low quality, or shows nothing useful, say so honestly with empty or minimal text " +
  "rather than guessing — that is a complete, valid answer, not a failure.";

/**
 * Returns null only on a genuine call/parse failure (network, API, or
 * malformed-response error) — never for an honest "nothing useful"
 * result, which is a normal, valid JobPhotoAnalysis with empty text.
 * The caller (analyzeAndStoreJobDocPhoto below) is what turns a null
 * here into the recorded-error state; this function's own job is only
 * to try and report why it couldn't.
 */
export async function analyzeJobDocPhoto(input: {
  businessId: string;
  base64Image: string;
  mimeType: string;
}): Promise<JobPhotoAnalysis | null> {
  try {
    const result = await getCompletion({
      tier: "large",
      businessId: input.businessId,
      callSite: "job-docs.analyze_photo",
      maxOutputTokens: 500,
      jsonSchema: { name: JOB_PHOTO_ANALYSIS_SCHEMA_NAME, schema: JOB_PHOTO_ANALYSIS_SCHEMA },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: `data:${input.mimeType};base64,${input.base64Image}` } }],
        },
      ],
    });
    const parsed = parseJobPhotoAnalysisResponse(result.data);
    if (!parsed) return null;
    return validateJobPhotoAnalysis(parsed);
  } catch (err) {
    console.error("[job-docs] analyzeJobDocPhoto failed:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "job-docs.photo_analysis_failed",
      businessId: input.businessId,
      message: "A job record photo's analysis completion call failed.",
      error: err,
    });
    return null;
  }
}

/**
 * The full orchestration: analyse, then write the result — always
 * setting analyzed_at so the row reaches a terminal state either way
 * (per the spec: pending only means "no outcome yet," and an error is
 * itself a real, terminal outcome). Called via waitUntil from the
 * upload route so it never delays the upload response — "AI analyses
 * quietly" while the owner keeps working.
 */
export async function analyzeAndStoreJobDocPhoto(
  supabase: ServiceClient,
  input: { businessId: string; photoId: string; base64Image: string; mimeType: string }
): Promise<void> {
  const analysis = await analyzeJobDocPhoto({ businessId: input.businessId, base64Image: input.base64Image, mimeType: input.mimeType });

  if (!analysis) {
    await supabase
      .from("job_doc_photos")
      .update({ analyzed_at: new Date().toISOString(), unknown_note: ANALYSIS_ERROR_MARKER })
      .eq("id", input.photoId);
    return;
  }

  if (analysis.flagged) {
    await recordErrorEvent({
      severity: "warning",
      source: "job-docs.photo_analysis_flagged",
      businessId: input.businessId,
      message: "A job record photo's AI analysis contained disallowed content and was redacted before storage.",
      context: { photoId: input.photoId },
    });
  }

  await supabase
    .from("job_doc_photos")
    .update({
      analyzed_at: new Date().toISOString(),
      visible_summary: analysis.visibleSummary,
      possible_summary: analysis.possibleSummary,
      unknown_note: analysis.unknownNote,
      analysis_confidence: analysis.confidence,
      phase: analysis.suggestedPhase,
      caption: analysis.caption || null,
    })
    .eq("id", input.photoId);
}
