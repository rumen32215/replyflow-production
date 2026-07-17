"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, Check, Phone, Pencil, X } from "lucide-react";
import { press, Reveal, EASE } from "@/components/shared/motion";
import { Acknowledgement, useAcknowledgement } from "@/components/shared/acknowledgement";
import { TypingDots } from "@/components/shared/typed-message";
import { createClient } from "@/lib/supabase/client";
import { buildStory, groupForStatus } from "@/lib/conversations";
import { cn } from "@/lib/utils";

interface ExistingJob {
  id: string;
  job_title: string;
  scheduled_for: string | null;
  status: string;
  notes: string | null;
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
