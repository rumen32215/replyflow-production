import "server-only";
import { getCompletion } from "../llm/client";
import { recordErrorEvent } from "@/lib/error-events";

/**
 * Photo analysis (Phase B — the differentiating loop). A distinct call
 * from reply generation, not a bolt-on to it: analysing an image is a
 * different task from drafting a customer-facing reply, and keeping it
 * separate means its output — VISIBLE / POSSIBLE / UNKNOWN — becomes an
 * ordinary, citable fact for the existing reply pipeline (see
 * lib/reply-engine/prompt/facts.ts) rather than a parallel system with
 * its own grounding rules to invent.
 *
 * Never returns a diagnosis, a price, or a promise — enforced by the
 * system prompt below, and structurally impossible to smuggle in
 * anyway since the schema has no field for any of those.
 */
export interface PhotoAnalysis {
  visible: string;
  possible: string;
  unknown: string;
  confidence: "low" | "medium" | "high";
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    visible: { type: "string" },
    possible: { type: "string" },
    unknown: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["visible", "possible", "unknown", "confidence"],
} as const;

const SYSTEM_PROMPT =
  "You are helping a UK trade/service business understand a photo a customer just sent them on WhatsApp, so the " +
  "tradesperson knows what they're walking into before travelling. Describe strictly in three separate categories, " +
  "never blending them:\n" +
  "- visible: only what is literally, objectively visible in the photo. No interpretation, no guessing.\n" +
  "- possible: what the visible details might indicate — always hedged (\"may suggest\", \"could indicate\"), never " +
  "stated as certain or as a diagnosis.\n" +
  "- unknown: what genuinely cannot be determined from a photo alone and needs an in-person look.\n\n" +
  "Strict rules, always: never give a definitive diagnosis or state a cause with certainty. Never mention or imply " +
  "a price, cost, or quote. Never promise a repair, a fix, or any outcome. Never invent anything not actually " +
  "visible (no guessing brands, ages, or history). If the photo is unclear, low quality, poorly lit, or shows " +
  "nothing diagnostically useful, say so plainly in \"unknown\" rather than guessing — that is a completely valid " +
  "answer, not a failure. Keep each field to one or two short, plain sentences.";

/**
 * Degrades to null on any failure (never throws) — the caller
 * (lib/reply-engine/media-intake.ts) falls back to the existing,
 * already-honest attachment acknowledgment when this returns null, the
 * same "never lose the message, never invent understanding" discipline
 * generateReplyDraft's own fallback already follows.
 */
export async function analyzePhoto(input: {
  businessId: string;
  trade: string;
  base64Image: string;
  mimeType: string;
  caption: string | null;
}): Promise<PhotoAnalysis | null> {
  try {
    const result = await getCompletion({
      tier: "large",
      businessId: input.businessId,
      callSite: "vision.analyze_photo",
      maxOutputTokens: 400,
      jsonSchema: { name: "photo_analysis", schema: RESPONSE_SCHEMA },
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT} This is for a ${input.trade || "trade/service"} business.` },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: input.caption ? `The customer's caption for this photo: "${input.caption}"` : "No caption was sent with this photo.",
            },
            { type: "image_url", image_url: { url: `data:${input.mimeType};base64,${input.base64Image}` } },
          ],
        },
      ],
    });
    return parsePhotoAnalysis(result.data);
  } catch (err) {
    console.error("[reply-engine] analyzePhoto failed:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "reply-engine.photo_analysis_failed",
      businessId: input.businessId,
      message: "analyzePhoto's completion call failed — the photo was stored but could not be analysed.",
      error: err,
    });
    return null;
  }
}

function parsePhotoAnalysis(raw: unknown): PhotoAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<PhotoAnalysis>;
  if (typeof r.visible !== "string" || typeof r.possible !== "string" || typeof r.unknown !== "string") return null;
  if (!r.visible.trim() || !r.possible.trim() || !r.unknown.trim()) return null;
  const confidence = r.confidence === "medium" || r.confidence === "high" ? r.confidence : "low";
  return { visible: r.visible.trim(), possible: r.possible.trim(), unknown: r.unknown.trim(), confidence };
}
