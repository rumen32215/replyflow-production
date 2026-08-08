import "server-only";
import { getCompletion } from "@/lib/reply-engine/llm/client";
import { recordErrorEvent } from "@/lib/error-events";

/**
 * ReplyFlow 2.0, Phase 2 — turns a tradesperson's raw job notes into a
 * structured draft (job_summary / work_performed / observations[]),
 * grounded strictly in what was actually supplied. Reuses the same
 * provider-agnostic completion client the reply engine and photo
 * analysis already use (lib/reply-engine/llm/client.ts) — no second AI
 * integration.
 *
 * Every field comes back with its own confidence, which the caller
 * (app/api/job-docs/[id]/draft/route.ts) turns into this schema's
 * provenance value: confident output is "ai_structured" (the model
 * organised real, supplied information); low-confidence output is
 * "ai_suggestion" (more inference than the notes directly support);
 * genuinely empty output is "missing" — never invented to fill a gap.
 */

export interface DraftField {
  text: string;
  confidence: "low" | "medium" | "high";
}

export interface JobReportDraft {
  jobSummary: DraftField;
  workPerformed: DraftField;
  observations: DraftField[];
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    job_summary: { type: "string" },
    job_summary_confidence: { type: "string", enum: ["low", "medium", "high"] },
    work_performed: { type: "string" },
    work_performed_confidence: { type: "string", enum: ["low", "medium", "high"] },
    observations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["text", "confidence"],
      },
    },
  },
  required: ["job_summary", "job_summary_confidence", "work_performed", "work_performed_confidence", "observations"],
} as const;

const SYSTEM_PROMPT =
  "You are drafting a professional job report for a UK trade/service business, from the tradesperson's own raw " +
  "notes about a job they just completed or visited. Produce exactly three things:\n" +
  "- job_summary: one or two plain sentences describing what the job was, in professional language.\n" +
  "- work_performed: a clear, factual account of what was actually done, in the notes' own terms — never add a " +
  "step, part, or action that wasn't mentioned.\n" +
  "- observations: a short list (0-5) of specific, useful observations genuinely present in the notes (e.g. " +
  "condition found, cause identified, anything the customer should know) — omit this entirely if the notes don't " +
  "support any.\n\n" +
  "Absolute rules — never invent, guess, or estimate any of the following unless the notes state it explicitly:\n" +
  "measurements, quantities, test results, registration or certificate numbers, signatures or names of who signed " +
  "anything, compliance verdicts (pass/fail/satisfactory), or safety classifications. If the notes don't mention " +
  "one of these, simply don't write it — do not write a placeholder, an estimate, or a plausible-sounding guess.\n\n" +
  "Mark your own confidence honestly for each field: high only when the notes directly and clearly support what " +
  "you wrote; low when you had to infer or organise loosely-stated information. If the notes genuinely don't " +
  "support a field at all, return an empty string for it rather than inventing content.\n\n" +
  "Write in plain, professional British English. No marketing language, no filler, no unnecessary adjectives.";

/**
 * Returns null on any failure (never throws) — the caller falls back
 * to an honest "couldn't generate a draft" state rather than losing
 * the job record itself, same no-throw-past-the-boundary discipline
 * every other AI call site in this codebase already follows.
 */
export async function generateJobReportDraft(input: {
  businessId: string;
  customerName: string;
  jobAddress: string | null;
  rawNotes: string;
}): Promise<JobReportDraft | null> {
  try {
    const result = await getCompletion({
      tier: "large",
      businessId: input.businessId,
      callSite: "job-docs.generate_draft",
      maxOutputTokens: 700,
      jsonSchema: { name: "job_report_draft", schema: RESPONSE_SCHEMA },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Customer: ${input.customerName || "not given"}\n` +
            `Job address: ${input.jobAddress || "not given"}\n\n` +
            `Raw notes from the tradesperson:\n"""\n${input.rawNotes}\n"""`,
        },
      ],
    });
    return parseDraft(result.data);
  } catch (err) {
    console.error("[job-docs] generateJobReportDraft failed:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "job-docs.generate_draft_failed",
      businessId: input.businessId,
      message: "generateJobReportDraft's completion call failed — no draft was produced.",
      error: err,
    });
    return null;
  }
}

function parseDraft(raw: unknown): JobReportDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.job_summary !== "string" || typeof r.work_performed !== "string") return null;

  const jobSummaryConfidence = toConfidence(r.job_summary_confidence);
  const workPerformedConfidence = toConfidence(r.work_performed_confidence);

  const observations: DraftField[] = Array.isArray(r.observations)
    ? r.observations
        .filter((o): o is { text: unknown; confidence: unknown } => Boolean(o) && typeof o === "object")
        .map((o) => ({ text: typeof o.text === "string" ? o.text.trim() : "", confidence: toConfidence(o.confidence) }))
        .filter((o) => o.text.length > 0)
    : [];

  return {
    jobSummary: { text: r.job_summary.trim(), confidence: jobSummaryConfidence },
    workPerformed: { text: r.work_performed.trim(), confidence: workPerformedConfidence },
    observations,
  };
}

function toConfidence(value: unknown): "low" | "medium" | "high" {
  return value === "medium" || value === "high" ? value : "low";
}
