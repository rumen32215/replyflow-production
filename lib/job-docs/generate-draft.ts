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
  /** Production hardening (2026-08-14) — "what's still outstanding or
   * happens next," grounded in the notes alone. Always attempted,
   * regardless of job status — a completed job might still have a
   * follow-up note (e.g. a warranty), an in-progress one almost always
   * does. Never invented if the notes don't support one. */
  nextSteps: DraftField;
  /** ReplyFlow 2.0, Phase 2A — set only when the photos and the notes
   * appear to describe different things. Never auto-resolved; the
   * caller writes this as its own field for the owner to read and
   * decide. Empty string when nothing diverges. */
  divergenceNote: string;
}

/** ReplyFlow 2.0, Phase 2A — analysed photo context threaded in
 * alongside the raw notes. Only ever the already-validated, already-
 * grounded output of lib/job-docs/analysis.ts — this function never
 * sees a raw image or an unvalidated model response. */
export interface PhotoContext {
  visibleSummary: string;
  possibleSummary: string;
  unknownNote: string;
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    job_summary: { type: "string" },
    job_summary_confidence: { type: "string", enum: ["low", "medium", "high"] },
    work_performed: { type: "string" },
    work_performed_confidence: { type: "string", enum: ["low", "medium", "high"] },
    next_steps: { type: "string" },
    next_steps_confidence: { type: "string", enum: ["low", "medium", "high"] },
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
    divergence_note: { type: "string" },
  },
  required: [
    "job_summary",
    "job_summary_confidence",
    "work_performed",
    "work_performed_confidence",
    "next_steps",
    "next_steps_confidence",
    "observations",
    "divergence_note",
  ],
} as const;

/**
 * Production hardening (2026-08-14) — the real, live Work Card status is
 * now told to the model explicitly, and work_performed's own
 * instruction branches on it. This is a defence-in-depth *first* layer,
 * not the only one: app/api/job-docs/[id]/draft/route.ts applies a
 * deterministic backstop afterwards that discards whatever the model
 * wrote for work_performed whenever the job isn't genuinely completed,
 * regardless of how well this prompt was followed — the same
 * "never trust the model alone for a safety-relevant fact" discipline
 * this codebase already applies to photo analysis and message safety.
 */
function buildSystemPrompt(isJobCompleted: boolean, issueReported: string | null): string {
  const statusLine = isJobCompleted
    ? "This job's real status, from the business's own job record, is COMPLETED — the work described in the notes has genuinely finished."
    : "This job's real status, from the business's own job record, is NOT YET COMPLETED (still in progress, booked, or otherwise open) — " +
      "regardless of what the notes describe doing, the job itself is not finished from the business's own records.";
  // Structural fix (production test, 2026-08-16) — the report no longer
  // shows the raw, ungenerated issue as its own section above Job
  // Summary (that used to restate the same problem twice, in two
  // voices — the single largest driver of the report reading like an
  // AI Q&A form). job_summary is now the ONLY place the customer sees
  // their reported problem stated back to them, so it must actually
  // say what the problem was, not just describe the visit in the
  // abstract.
  const issueLine = issueReported
    ? `The customer's own reported issue, straight from the business's job record, is: "${issueReported}". This is the only place the ` +
      "customer will see their reported problem restated — job_summary must open by clearly stating what the problem was (in professional " +
      "language, not copied verbatim) before anything else, as if no other section already told them."
    : "No reported issue is on record for this job — describe only what the notes themselves establish, do not guess at an original problem.";
  const workPerformedRule = isJobCompleted
    ? "- work_performed: a clear, factual account of what was actually done, in the notes' own terms — never add a step, part, or action " +
      "that wasn't mentioned."
    : "- work_performed: since this job is NOT yet completed, do not describe finished work here at all — leave this an empty string. Put " +
      "whatever progress or diagnosis the notes describe under observations instead, worded as what has been found/done so far, never as " +
      "a finished job.";

  return (
    "You are drafting a professional job report for a UK trade/service business, from the tradesperson's own raw " +
    "notes about a job, and (when provided) already-analysed context from photos they took. " +
    statusLine +
    " " +
    issueLine +
    " Produce exactly these things:\n" +
    "- job_summary: one or two plain sentences opening with what the reported problem was, then briefly what the job " +
    "involved, in professional language — a complete, standalone statement, not a continuation of something said " +
    "elsewhere. Never state or imply the job is finished unless it genuinely is.\n" +
    workPerformedRule +
    "\n" +
    "- next_steps: what's still outstanding or happens next, grounded strictly in the notes — e.g. a follow-up " +
    "visit, a part on order, or (for a genuinely completed job) a warranty note if the notes mention one. Empty " +
    "string if the notes don't support anything here.\n" +
    "- observations: a short list (0-5) of specific, useful observations genuinely present in the notes or photo " +
    "context (e.g. condition found, cause identified, anything the customer should know) — omit this entirely if " +
    "neither supports any. Describe what was found, never as an action taken.\n" +
    "- divergence_note: empty unless the photo context and the notes appear to describe something genuinely " +
    "different (e.g. the notes say a part was replaced but a photo context describes the old part still in place). " +
    "If so, describe BOTH what the notes say and what the photo context shows, plainly and separately — never " +
    "silently pick one as correct, never rewrite the notes to match the photo or vice versa, never state which one " +
    "is right. That decision belongs to the owner, not you.\n\n" +
    "Absolute rules — never invent, guess, or estimate any of the following unless the notes state it explicitly:\n" +
    "measurements, quantities, test results, registration or certificate numbers, signatures or names of who signed " +
    "anything, compliance verdicts (pass/fail/satisfactory), or safety classifications. If the notes don't mention " +
    "one of these, simply don't write it — do not write a placeholder, an estimate, or a plausible-sounding guess. " +
    "The same restriction applies to anything from the photo context — it has already been through its own " +
    "grounding checks, but never add to it or treat a hedged 'possible' observation as a confirmed fact.\n\n" +
    "Mark your own confidence honestly for each field: high only when the notes directly and clearly support what " +
    "you wrote; low when you had to infer or organise loosely-stated information. If the notes genuinely don't " +
    "support a field at all, return an empty string for it rather than inventing content.\n\n" +
    "Write in plain, professional British English. No marketing language, no filler, no unnecessary adjectives."
  );
}

function buildPhotoContextBlock(photos: PhotoContext[]): string {
  if (photos.length === 0) return "";
  const lines = photos.map((p, i) => {
    const parts: string[] = [];
    if (p.visibleSummary) parts.push(`visible: ${p.visibleSummary}`);
    if (p.possibleSummary) parts.push(`possible (hedged, not certain): ${p.possibleSummary}`);
    if (p.unknownNote) parts.push(`unknown: ${p.unknownNote}`);
    return `Photo ${i + 1} — ${parts.length > 0 ? parts.join("; ") : "nothing useful found"}`;
  });
  return `\n\nAnalysed photo context (already grounded — treat "possible" as hedged, never certain):\n${lines.join("\n")}`;
}

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
  photos?: PhotoContext[];
  /** Production hardening (2026-08-14) — the real Work Card status,
   * live-fetched by the caller via job_docs.work_card_id, never a
   * stored copy. Defaults to false (never claim completion without
   * explicit confirmation) when there's no linked Work Card at all. */
  isJobCompleted?: boolean;
  /** Structural fix (production test, 2026-08-16) — the customer's own
   * reported issue (work_cards.issue), straight from the Work Card,
   * never AI-touched. Needed here because job_summary is now the only
   * customer-facing statement of the problem (see buildSystemPrompt) —
   * without it, the model has no way to know what to state. Null only
   * when there's no linked Work Card to read it from. */
  issueReported?: string | null;
}): Promise<JobReportDraft | null> {
  try {
    const result = await getCompletion({
      tier: "large",
      businessId: input.businessId,
      callSite: "job-docs.generate_draft",
      maxOutputTokens: 800,
      jsonSchema: { name: "job_report_draft", schema: RESPONSE_SCHEMA },
      messages: [
        { role: "system", content: buildSystemPrompt(Boolean(input.isJobCompleted), input.issueReported ?? null) },
        {
          role: "user",
          content:
            `Customer: ${input.customerName || "not given"}\n` +
            `Job address: ${input.jobAddress || "not given"}\n\n` +
            `Raw notes from the tradesperson:\n"""\n${input.rawNotes}\n"""` +
            buildPhotoContextBlock(input.photos ?? []),
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
  const nextStepsConfidence = toConfidence(r.next_steps_confidence);

  const observations: DraftField[] = Array.isArray(r.observations)
    ? r.observations
        .filter((o): o is { text: unknown; confidence: unknown } => Boolean(o) && typeof o === "object")
        .map((o) => ({ text: typeof o.text === "string" ? o.text.trim() : "", confidence: toConfidence(o.confidence) }))
        .filter((o) => o.text.length > 0)
    : [];

  return {
    jobSummary: { text: r.job_summary.trim(), confidence: jobSummaryConfidence },
    workPerformed: { text: r.work_performed.trim(), confidence: workPerformedConfidence },
    nextSteps: { text: typeof r.next_steps === "string" ? r.next_steps.trim() : "", confidence: nextStepsConfidence },
    observations,
    divergenceNote: typeof r.divergence_note === "string" ? r.divergence_note.trim() : "",
  };
}

function toConfidence(value: unknown): "low" | "medium" | "high" {
  return value === "medium" || value === "high" ? value : "low";
}
