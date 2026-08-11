/**
 * ReplyFlow V4 — pure mapping from a completed Work Card into the seed
 * data a new, linked Job Record starts from (0030_link_job_docs_to_
 * work_cards.sql). No Supabase here, same convention as lib/front-desk-
 * signals.ts: what the seed *should* contain is a testable, mechanical
 * question, kept separate from where the rows actually come from or go.
 *
 * The point of this function is the product rule itself: a plumber
 * must never have to retype something ReplyFlow already knows just
 * because they moved from a Work Card to its Job Record.
 */

export interface WorkCardForJobDoc {
  customerName: string;
  issue: string;
  address: string | null;
  conversationSummary: string | null;
  collectedDetails: string | null;
  notes: string | null;
  scheduledFor: string | null;
  completedAt: string | null;
}

export interface JobDocSeed {
  title: string;
  customerName: string;
  jobAddress: string | null;
  /** ISO timestamp, or null if the Work Card has neither a completion
   * nor a scheduled time yet. */
  jobDate: string | null;
  rawNotes: string;
}

export function buildJobDocSeedFromWorkCard(workCard: WorkCardForJobDoc): JobDocSeed {
  const title = workCard.address ? `${workCard.customerName} — ${workCard.address}` : `${workCard.customerName} — ${workCard.issue}`;

  const notesParts = [workCard.conversationSummary, workCard.collectedDetails, workCard.notes]
    .map((part) => (part ?? "").trim())
    .filter(Boolean);
  // Every Work Card has an issue; the other three fields can genuinely
  // all be empty on a fast-moving job, so this never produces a blank
  // starting point for Generate Draft to work from.
  const rawNotes = notesParts.length > 0 ? notesParts.join("\n\n") : `Job: ${workCard.issue}`;

  return {
    title,
    customerName: workCard.customerName,
    jobAddress: workCard.address,
    jobDate: workCard.completedAt ?? workCard.scheduledFor,
    rawNotes,
  };
}
