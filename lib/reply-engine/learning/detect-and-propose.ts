import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { isLearningCandidate } from "@/lib/brain/learning";
import { proposeLesson } from "./propose-lesson";
import { recordProductEvent } from "@/lib/product-events";
import { recordErrorEvent } from "@/lib/error-events";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * The orchestration layer for Learning Memory's candidate detection —
 * everything in `DOCS/CONSTITUTION/12-ReplyFlow-Learning-Memory-Architecture.md`
 * §2.1-§2.2 wired together. Called from the reply-drafts edit route
 * via `waitUntil`, the same deferred pattern the WhatsApp webhook
 * already uses — an edit must never wait on this before the owner sees
 * their save confirmed.
 *
 * Best-effort throughout, matching every other background job in this
 * codebase: a failure here means a learning opportunity was missed,
 * never a customer- or owner-visible failure.
 */
export async function detectAndProposeLearning(params: {
  supabase: ServiceClient;
  businessId: string;
  replyDraftId: string;
  customerMessageId: string | null;
  category: string;
  originalDraft: string;
  editedDraft: string;
}): Promise<void> {
  const { supabase, businessId, replyDraftId, customerMessageId, category, originalDraft, editedDraft } = params;

  try {
    if (!isLearningCandidate(originalDraft, editedDraft)) return;

    // Existing proposal for this exact draft already pending/resolved —
    // never create a second one for the same edit (e.g. a retried
    // request, or the owner editing an already-edited draft again).
    const { data: existing } = await supabase
      .from("learning_proposals")
      .select("id")
      .eq("reply_draft_id", replyDraftId)
      .maybeSingle();
    if (existing) return;

    let customerMessage = "";
    if (customerMessageId) {
      const { data: message } = await supabase.from("messages").select("body").eq("id", customerMessageId).maybeSingle();
      customerMessage = message?.body ?? "";
    }

    const lesson = await proposeLesson({
      businessId,
      category,
      customerMessage,
      originalDraft,
      editedDraft,
    });
    if (!lesson) return;

    const { error: insertError } = await supabase.from("learning_proposals").insert({
      business_id: businessId,
      reply_draft_id: replyDraftId,
      category,
      original_text: originalDraft,
      edited_text: editedDraft,
      proposed_lesson: lesson,
      status: "pending",
    });
    if (insertError) {
      console.error("[learning] could not insert learning_proposals row:", insertError.message);
      return;
    }

    // Adaptation prep (doc 12 §2.6, doc 13) — every outcome recorded
    // through the existing product_events chokepoint, no new table for
    // the event history itself.
    await recordProductEvent({ eventType: "learning.proposed", businessId, context: { replyDraftId } });
  } catch (err) {
    console.error("[learning] detectAndProposeLearning failed:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "learning.detect_failed",
      businessId,
      message: "detectAndProposeLearning threw — no learning proposal was created for this edit.",
      error: err,
      context: { replyDraftId },
    });
  }
}
