"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, Check, Phone } from "lucide-react";
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
}

/**
 * Opening a conversation tells the story, not just the messages
 * (Conversations Experience V2): what's been collected, where things
 * stand, and the obvious next action — Call, Create a job, or Mark
 * complete. The owner understands the entire journey in seconds.
 *
 * "Create a job" is the real fix for a confirmed gap: the `jobs`
 * table had full schema and RLS but no write path anywhere in the
 * app. Everything prefilled here is a real, known fact (customer
 * name/phone, the latest message, a suggested day from the real
 * diary) — job_title is never inferred from message content, since
 * guessing what the job actually is would be exactly the kind of
 * overclaim ReplyFlow never makes.
 */
export function ConversationStory({
  conversationId,
  businessId,
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
  const [jobTitle, setJobTitle] = useState(`Enquiry from ${customerName || customerPhone}`);
  const [notes, setNotes] = useState(latestCustomerMessage ?? "");
  const [scheduledDate, setScheduledDate] = useState(suggestedSlotDate ?? "");
  const [creatingJob, setCreatingJob] = useState(false);

  const story = buildStory({ status, messageCount, photoCount });
  const group = groupForStatus(status);
  const isFinished = group === "done";

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

  async function confirmJob() {
    if (creatingJob || !jobTitle.trim()) return;
    setCreatingJob(true);
    const { data: inserted, error: insertError } = await supabase
      .from("jobs")
      .insert({
        business_id: businessId,
        conversation_id: conversationId,
        customer_name: customerName || customerPhone,
        job_title: jobTitle.trim(),
        status: "booked",
        scheduled_for: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        notes: notes.trim() || null,
      })
      .select("id, job_title, scheduled_for")
      .single();

    if (insertError || !inserted) {
      setCreatingJob(false);
      softError();
      return;
    }

    // The job is real either way — a failure past this point only
    // means the conversation's status didn't flip, never that nothing
    // was saved (Supabase has no cross-table transaction here).
    const { error: statusError } = await supabase
      .from("conversations")
      .update({ status: "booked" })
      .eq("id", conversationId);

    setCreatingJob(false);
    setJob(inserted);
    setShowJobForm(false);
    router.refresh();
    if (statusError) softError();
    else acknowledge("Job created — I've marked this as booked.");
  }

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
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-success-foreground">
                <Briefcase className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              <span className="text-muted-foreground">Job created — {job.job_title}</span>
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
        {!job && (
          <motion.button
            {...press}
            type="button"
            onClick={() => setShowJobForm((v) => !v)}
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

      <AnimatePresence initial={false}>
        {showJobForm && !job && (
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
              <motion.button
                {...press}
                type="button"
                onClick={confirmJob}
                disabled={creatingJob || !jobTitle.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-success px-3.5 py-2 text-[12.5px] font-semibold text-success-foreground disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" />
                {creatingJob ? "Creating…" : "Confirm booking"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
