"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Briefcase, Check, Loader2, Phone, Pencil, Sparkles, X } from "lucide-react";
import { press, GrowingCheck, Reveal, EASE } from "@/components/shared/motion";
import { Acknowledgement, useAcknowledgement } from "@/components/shared/acknowledgement";
import { TypingDots } from "@/components/shared/typed-message";
import { createClient } from "@/lib/supabase/client";
import { buildStory, groupForStatus } from "@/lib/conversations";
import { joinList } from "@/lib/knowledge";
import { cn } from "@/lib/utils";

interface ExistingJob {
  id: string;
  job_title: string;
  scheduled_for: string | null;
  status: string;
  notes: string | null;
}

interface PendingReplyDraft {
  id: string;
  draft_text: string;
  final_text: string | null;
  intent: string;
  confidence: string;
  requires_escalation: boolean;
  escalation_reason: string | null;
  facts_used: string[] | null;
  status: string;
}

/** Turns the Understanding Engine's SCREAMING_CASE intent into
 * something an owner would actually say. Falls back to a mechanical
 * transform for anything not yet mapped, so a future intent never
 * renders as literally undefined. */
const INTENT_LABELS: Record<string, string> = {
  BOOKING_REQUEST: "New booking enquiry",
  BOOKING_CHANGE: "Changing a booking",
  BOOKING_CANCELLATION: "Cancelling a booking",
  BUSINESS_INFORMATION: "Asking about your business",
  PRICING_INQUIRY: "Asking about pricing",
  RETURNING_PROBLEM: "A recurring problem",
  EMERGENCY: "Emergency",
  COMPLAINT: "A complaint",
  STATUS_CHECK: "Checking in on a job",
  PAYMENT_QUERY: "Asking about payment",
  SOCIAL: "Just saying hello",
  UNCLEAR: "Not sure what they need",
};
function intentLabel(intent: string): string {
  return INTENT_LABELS[intent] ?? intent.toLowerCase().replace(/_/g, " ");
}

/** A calm, human read on how sure the draft is — never a raw
 * percentage (Shared Brain precedent: "the user receives High
 * confidence / Needs review, not raw probabilities"). */
function ConfidenceTag({ confidence }: { confidence: string }) {
  if (confidence === "high" || confidence === "verified") {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10.5px] font-bold text-success">
        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
        Confident
      </span>
    );
  }
  if (confidence === "medium") {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10.5px] font-bold text-muted-foreground">
        Fairly sure
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10.5px] font-bold text-amber-700">
      Worth a check
    </span>
  );
}

/** What this draft actually leans on, in plain terms — turns the
 * Reply Engine's internal fact-grounding ids (Sprint 10A) into the
 * one trust signal that matters to the owner: not *that* it's
 * grounded, but *in what*. Category-level only — never claims a
 * specific fact wasn't shown here to keep the summary honest. */
const FACT_SOURCE_LABELS: Record<string, string> = {
  profile: "your business details",
  receptionist: "your FAQs",
  diary: "your diary",
  customer: "this customer's history",
};
function factSourceSummary(factsUsed: string[] | null | undefined): string | null {
  if (!Array.isArray(factsUsed) || factsUsed.length === 0) return null;
  const prefixes = Array.from(new Set(factsUsed.map((id) => id.split(".")[0])));
  const labels = prefixes.map((p) => (p ? FACT_SOURCE_LABELS[p] : undefined)).filter((l): l is string => Boolean(l));
  return labels.length > 0 ? joinList(labels) : null;
}

function formatScheduled(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

/**
 * Opening a conversation tells the story, not just the messages
 * (Conversations Experience V2): what's been collected, where things
 * stand, and the obvious next action — Call, Create a job, or Mark
 * complete. The owner understands the entire journey in seconds.
 *
 * "Create a job" fixes a confirmed gap: the `jobs` table had full
 * schema and RLS but no write path anywhere in the app. It never
 * auto-finalises, though — a job created here starts as a draft the
 * owner must approve, edit, or reject, exactly like every other
 * booking-adjacent decision in the product (never guess, never
 * decide alone). job_title is never inferred from message content —
 * guessing what the job actually is would be exactly the overclaim
 * ReplyFlow never makes.
 *
 * Approving shows a clearly-labeled preview of what would be sent to
 * the customer — a simulation, not a real message, since outbound
 * WhatsApp sending isn't wired up yet. It's framed so that's obvious.
 */
export function ConversationStory({
  conversationId,
  businessId,
  businessName,
  status,
  customerName,
  customerPhone,
  messageCount,
  photoCount,
  existingJob,
  latestCustomerMessage,
  suggestedSlotDate,
  suggestedSlotLabel,
  pendingDraft,
}: {
  conversationId: string;
  businessId: string;
  businessName: string;
  status: string;
  customerName: string | null;
  customerPhone: string;
  messageCount: number;
  photoCount: number;
  existingJob: ExistingJob | null;
  latestCustomerMessage: string | null;
  suggestedSlotDate: string | null;
  suggestedSlotLabel: string | null;
  pendingDraft: PendingReplyDraft | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { message, isError, acknowledge, softError } = useAcknowledgement();
  const [saving, setSaving] = useState(false);

  const [job, setJob] = useState<ExistingJob | null>(existingJob);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingDraft, setEditingDraft] = useState(false);
  const [jobTitle, setJobTitle] = useState(`Enquiry from ${customerName || customerPhone}`);
  const [notes, setNotes] = useState(latestCustomerMessage ?? "");
  const [scheduledDate, setScheduledDate] = useState(suggestedSlotDate ?? "");
  const [savingJob, setSavingJob] = useState(false);
  const [decidingJob, setDecidingJob] = useState(false);
  const [showSentPreview, setShowSentPreview] = useState(false);

  const [replyDraft, setReplyDraft] = useState<PendingReplyDraft | null>(pendingDraft);
  const [editingReply, setEditingReply] = useState(false);
  const [replyText, setReplyText] = useState(pendingDraft?.final_text ?? pendingDraft?.draft_text ?? "");
  const [pendingAction, setPendingAction] = useState<"approve" | "edit" | "reject" | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const story = buildStory({ status, messageCount, photoCount });
  const group = groupForStatus(status);
  const isFinished = group === "done";
  const isDraft = job?.status === "draft";

  async function markCompleted() {
    if (saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("conversations")
      .update({ status: "completed" })
      .eq("id", conversationId);
    setSaving(false);
    if (error) {
      softError();
      return;
    }
    acknowledge("Nice. That one's finished.");
    router.refresh();
  }

  function startEdit() {
    if (!job) return;
    setJobTitle(job.job_title);
    setNotes(job.notes ?? "");
    setScheduledDate(job.scheduled_for ? job.scheduled_for.slice(0, 10) : "");
    setEditingDraft(true);
    setShowJobForm(true);
  }

  async function saveJob() {
    if (savingJob || !jobTitle.trim()) return;
    setSavingJob(true);

    if (editingDraft && job) {
      const { error } = await supabase
        .from("jobs")
        .update({
          job_title: jobTitle.trim(),
          scheduled_for: scheduledDate ? new Date(scheduledDate).toISOString() : null,
          notes: notes.trim() || null,
        })
        .eq("id", job.id);
      setSavingJob(false);
      if (error) {
        softError();
        return;
      }
      setJob({
        ...job,
        job_title: jobTitle.trim(),
        scheduled_for: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        notes: notes.trim() || null,
      });
      setShowJobForm(false);
      setEditingDraft(false);
      acknowledge("Updated the draft.");
      router.refresh();
      return;
    }

    // A brand-new job always starts as a draft — never auto-finalised.
    // The owner approves, edits, or rejects it below.
    const { data: inserted, error: insertError } = await supabase
      .from("jobs")
      .insert({
        business_id: businessId,
        conversation_id: conversationId,
        customer_name: customerName || customerPhone,
        job_title: jobTitle.trim(),
        status: "draft",
        scheduled_for: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        notes: notes.trim() || null,
      })
      .select("id, job_title, scheduled_for, status, notes")
      .single();

    setSavingJob(false);
    if (insertError || !inserted) {
      softError();
      return;
    }
    setJob(inserted);
    setShowJobForm(false);
    acknowledge("Draft ready — take a look when you're ready.");
    router.refresh();
  }

  async function approveJob() {
    if (!job || decidingJob) return;
    setDecidingJob(true);
    const { error: jobError } = await supabase.from("jobs").update({ status: "booked" }).eq("id", job.id);
    if (jobError) {
      setDecidingJob(false);
      softError();
      return;
    }
    // The job is real either way — a failure past this point only
    // means the conversation's status didn't flip, never that the
    // approval itself didn't happen (Supabase has no cross-table
    // transaction here).
    const { error: statusError } = await supabase
      .from("conversations")
      .update({ status: "booked" })
      .eq("id", conversationId);
    setDecidingJob(false);
    setJob({ ...job, status: "booked" });
    setShowSentPreview(true);
    router.refresh();
    if (statusError) softError();
    else acknowledge("Approved and booked.");
  }

  async function rejectJob() {
    if (!job || decidingJob) return;
    setDecidingJob(true);
    const { error } = await supabase.from("jobs").update({ status: "cancelled" }).eq("id", job.id);
    setDecidingJob(false);
    if (error) {
      softError();
      return;
    }
    setJob({ ...job, status: "cancelled" });
    acknowledge("Rejected — this won't be booked.");
    router.refresh();
  }

  /**
   * Resolving an AI draft goes through the API route, not a direct
   * client-side Supabase write like a job's approve/reject — approving
   * sends a real WhatsApp message using a stored access token the
   * browser must never see (see app/api/reply-drafts/[id]/route.ts).
   *
   * Approve doesn't clear the draft immediately — it holds a brief
   * "Sent" confirmation in place first (GrowingCheck), so the moment
   * of a real message going out is felt, not just inferred from the
   * card silently disappearing.
   */
  async function resolveDraft(action: "approve" | "edit" | "reject", text?: string) {
    if (!replyDraft || pendingAction) return;
    setPendingAction(action);
    setReplyError(null);
    try {
      const res = await fetch(`/api/reply-drafts/${replyDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(text !== undefined ? { action, text } : { action }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setReplyError(payload.error ?? "Something went wrong.");
        setPendingAction(null);
        return;
      }
      if (action === "reject") {
        setPendingAction(null);
        setReplyDraft(null);
        acknowledge("Rejected — I won't send this one.");
      } else if (action === "edit") {
        setPendingAction(null);
        setReplyDraft(payload.draft);
        setEditingReply(false);
        acknowledge("Saved your edit.");
      } else {
        setJustSent(true);
        acknowledge("Sent.");
        setTimeout(() => {
          setReplyDraft(null);
          setPendingAction(null);
          setJustSent(false);
        }, 1600);
      }
      router.refresh();
    } catch {
      setPendingAction(null);
      setReplyError("Couldn't reach the server — try again.");
    }
  }

  const scheduledLabel = job ? formatScheduled(job.scheduled_for) : null;
  const confirmationPreview = job
    ? `Hi ${customerName || "there"}! ${businessName} here — your booking for ${job.job_title} is confirmed${
        scheduledLabel ? ` for ${scheduledLabel}` : ""
      }. See you then!`
    : "";

  return (
    <div className="border-b border-border bg-muted/30 px-5 py-4">
      <div className="space-y-1.5">
        {story.map((moment, i) => (
          <Reveal key={moment.label} index={i}>
            <div className="flex items-center gap-2.5 text-[13px]">
              {moment.pending ? (
                <span className="flex h-4 w-4 items-center justify-center">
                  <TypingDots />
                </span>
              ) : (
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full",
                    moment.done ? "bg-success text-success-foreground" : "border border-border"
                  )}
                >
                  {moment.done && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                </span>
              )}
              <span className={cn(moment.pending ? "font-semibold text-amber-600" : "text-muted-foreground")}>
                {moment.label}
              </span>
            </div>
          </Reveal>
        ))}
        {job && (
          <Reveal index={story.length}>
            <div className="flex items-center gap-2.5 text-[13px]">
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full",
                  isDraft
                    ? "bg-amber-100 text-amber-700"
                    : job.status === "cancelled"
                      ? "bg-muted text-muted-foreground"
                      : "bg-success text-success-foreground"
                )}
              >
                <Briefcase className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              <span
                className={cn(
                  isDraft ? "font-semibold text-amber-700" : "text-muted-foreground",
                  job.status === "cancelled" && "line-through"
                )}
              >
                {isDraft
                  ? `Draft ready for your review — ${job.job_title}`
                  : job.status === "cancelled"
                    ? `Draft rejected — ${job.job_title}`
                    : `Job booked — ${job.job_title}`}
              </span>
            </div>
          </Reveal>
        )}
      </div>

      {/* Primary actions are obvious — never hidden behind menus. */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <motion.a
          {...press}
          href={`tel:${customerPhone}`}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground shadow-sm"
        >
          <Phone className="h-3.5 w-3.5" />
          Call customer
        </motion.a>
        {(!job || job.status === "cancelled") && (
          <motion.button
            {...press}
            type="button"
            onClick={() => {
              // A rejected draft never blocks a fresh one — reset the
              // form back to sensible defaults rather than reopening
              // whatever was last typed into the rejected draft.
              setJobTitle(`Enquiry from ${customerName || customerPhone}`);
              setNotes(latestCustomerMessage ?? "");
              setScheduledDate(suggestedSlotDate ?? "");
              setEditingDraft(false);
              setShowJobForm((v) => !v);
            }}
            aria-pressed={showJobForm}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold shadow-sm",
              showJobForm ? "bg-success text-success-foreground" : "border border-border bg-card text-foreground"
            )}
          >
            <Briefcase className="h-3.5 w-3.5" />
            Create a job
          </motion.button>
        )}
        {!isFinished && (
          <motion.button
            {...press}
            type="button"
            onClick={markCompleted}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-[12.5px] font-semibold text-foreground disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            Mark complete
          </motion.button>
        )}
        <Acknowledgement message={message} isError={isError} className="ml-1" />
      </div>

      {/* A draft never auto-finalises — the owner decides. */}
      {isDraft && !showJobForm && (
        <div className="mt-3.5 rounded-xl border border-amber-200 bg-amber-50/50 p-3.5">
          <p className="mb-2.5 text-[12.5px] leading-relaxed text-amber-900">
            I&apos;ve prepared this booking from the conversation — nothing&apos;s confirmed until you say so.
          </p>
          <div className="flex flex-wrap gap-2">
            <motion.button
              {...press}
              type="button"
              onClick={approveJob}
              disabled={decidingJob}
              className="flex items-center gap-1.5 rounded-lg bg-success px-3.5 py-2 text-[12.5px] font-semibold text-success-foreground disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </motion.button>
            <motion.button
              {...press}
              type="button"
              onClick={startEdit}
              disabled={decidingJob}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-[12.5px] font-semibold text-foreground disabled:opacity-60"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </motion.button>
            <motion.button
              {...press}
              type="button"
              onClick={rejectJob}
              disabled={decidingJob}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </motion.button>
          </div>
        </div>
      )}

      {/* The AI-drafted reply (Sprint 10A) — the product's hero moment,
       * so it gets its own distinct card rather than sharing the muted
       * "info box" treatment job-drafts use. Never sent automatically:
       * the owner reviews, optionally edits, then approves or rejects. */}
      <AnimatePresence initial={false}>
        {replyDraft && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="mt-3.5 overflow-hidden"
          >
            <div className="overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-primary/10 bg-accent/50 px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-bold leading-tight text-foreground">Suggested reply</p>
                    <p className="truncate text-[11px] leading-tight text-muted-foreground">
                      {intentLabel(replyDraft.intent)}
                    </p>
                  </div>
                </div>
                {!justSent && <ConfidenceTag confidence={replyDraft.confidence} />}
              </div>

              <div className="p-3.5">
                {justSent ? (
                  <div className="flex items-center gap-2.5 py-1 text-[13px] font-semibold text-success">
                    <GrowingCheck />
                    Sent to {customerName || "the customer"}
                  </div>
                ) : (
                  <>
                    {replyDraft.requires_escalation && (
                      <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[12px] leading-relaxed text-amber-900">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{replyDraft.escalation_reason || "This one needs your judgement before sending."}</span>
                      </div>
                    )}

                    {editingReply ? (
                      <div className="space-y-2.5">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={3}
                          autoFocus
                          className="w-full resize-none rounded-2xl border border-primary/30 bg-accent/30 px-3.5 py-2.5 text-[13px] leading-relaxed outline-none transition-colors focus:border-primary"
                        />
                        <div className="flex flex-wrap gap-2">
                          <motion.button
                            {...press}
                            type="button"
                            onClick={() => resolveDraft("edit", replyText)}
                            disabled={pendingAction !== null || !replyText.trim()}
                            className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-success px-4 py-2.5 text-[13px] font-semibold text-success-foreground disabled:opacity-60"
                          >
                            {pendingAction === "edit" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            {pendingAction === "edit" ? "Saving…" : "Save"}
                          </motion.button>
                          <motion.button
                            {...press}
                            type="button"
                            onClick={() => {
                              setReplyText(replyDraft.final_text ?? replyDraft.draft_text);
                              setEditingReply(false);
                            }}
                            disabled={pendingAction !== null}
                            className="flex min-h-[44px] items-center rounded-xl px-4 py-2.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
                          >
                            Cancel
                          </motion.button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {latestCustomerMessage && (
                          <p className="mb-2 truncate text-[11.5px] leading-snug text-muted-foreground">
                            Replying to <span className="italic">&ldquo;{latestCustomerMessage}&rdquo;</span>
                          </p>
                        )}
                        <div className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-[13px] leading-relaxed text-primary-foreground">
                            {replyDraft.final_text ?? replyDraft.draft_text}
                          </div>
                        </div>
                        {factSourceSummary(replyDraft.facts_used) && (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Based on {factSourceSummary(replyDraft.facts_used)}.
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <motion.button
                            {...press}
                            type="button"
                            onClick={() => resolveDraft("approve")}
                            disabled={pendingAction !== null}
                            className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-success px-4 py-2.5 text-[13px] font-semibold text-success-foreground shadow-sm disabled:opacity-60"
                          >
                            {pendingAction === "approve" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            {pendingAction === "approve" ? "Sending…" : "Approve & send"}
                          </motion.button>
                          <motion.button
                            {...press}
                            type="button"
                            onClick={() => {
                              setReplyText(replyDraft.final_text ?? replyDraft.draft_text);
                              setEditingReply(true);
                            }}
                            disabled={pendingAction !== null}
                            className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-foreground disabled:opacity-60"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </motion.button>
                          <motion.button
                            {...press}
                            type="button"
                            onClick={() => resolveDraft("reject")}
                            disabled={pendingAction !== null}
                            className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            {pendingAction === "reject" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                            Reject
                          </motion.button>
                        </div>
                      </>
                    )}
                    {replyError && <p className="mt-2 text-[12px] text-red-600">{replyError}</p>}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A simulated confirmation — clearly labeled, never phrased as
       * a delivery receipt. Real outbound sending isn't wired up yet. */}
      <AnimatePresence initial={false}>
        {showSentPreview && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-3.5 rounded-xl border border-border bg-card p-3.5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Preview — here&apos;s what I&apos;d send the customer
              </p>
              <div className="inline-block max-w-full rounded-2xl rounded-br-sm bg-[#d7f8c8] px-3.5 py-2 text-[13px] leading-relaxed text-foreground">
                {confirmationPreview}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Not actually sent — outbound WhatsApp messaging isn&apos;t connected yet.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showJobForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-3.5 space-y-2.5 rounded-xl border border-border bg-card p-3.5">
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Job title</span>
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="What's this job?"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Scheduled for</span>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none transition-colors focus:border-primary"
                />
                {suggestedSlotLabel && scheduledDate === suggestedSlotDate && (
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    A suggested day based on your diary ({suggestedSlotLabel}) — worth checking against today&apos;s bookings.
                  </span>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Anything worth remembering about this job"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
                />
              </label>
              <div className="flex gap-2">
                <motion.button
                  {...press}
                  type="button"
                  onClick={saveJob}
                  disabled={savingJob || !jobTitle.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-success px-3.5 py-2 text-[12.5px] font-semibold text-success-foreground disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  {savingJob ? "Saving…" : editingDraft ? "Save changes" : "Save as draft"}
                </motion.button>
                {editingDraft && (
                  <motion.button
                    {...press}
                    type="button"
                    onClick={() => {
                      setShowJobForm(false);
                      setEditingDraft(false);
                    }}
                    className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
