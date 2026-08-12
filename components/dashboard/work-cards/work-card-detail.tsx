"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Phone,
  MapPin,
  MessageCircle,
  Pencil,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Navigation,
  FileText,
} from "lucide-react";
import { press, SettleCard, Reveal, EASE } from "@/components/shared/motion";
import { Acknowledgement, useAcknowledgement } from "@/components/shared/acknowledgement";
import { createClient } from "@/lib/supabase/client";
import {
  describeWorkCardState,
  WORK_CARD_TONE_STYLE,
  SIMPLIFIED_STATUS_LABEL,
  type SimplifiedWorkCardStatus,
} from "@/lib/work-card-state";
import { toDateTimeLocalValue, mapsHref, formatDateTime, formatDate } from "@/lib/work-card-format";
import type { ConversationGroup } from "@/lib/conversations";
import { cn } from "@/lib/utils";
import { revalidateWorkCards } from "@/app/(dashboard)/dashboard/work-cards/actions";

export interface WorkCardDetailData {
  id: string;
  conversationId: string | null;
  customerName: string;
  customerPhone: string | null;
  issue: string;
  status: string;
  estimatedValue: number | null;
  scheduledFor: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  address: string | null;
  addressConfirmed: boolean;
  collectedDetails: string | null;
  conversationSummary: string | null;
  approvedAt: string | null;
}

/** ReplyFlow V2 (2026-08-11) — a photo the customer sent, already
 * analysed (lib/reply-engine/vision/analyze-photo.ts). Same three-way
 * shape everywhere this analysis is shown: what's actually visible,
 * what's possible but not certain, and what genuinely can't be told
 * without an in-person look — never collapsed into one summary, so
 * the distinction between observed and uncertain is never lost on
 * the way to the screen. `url` is null if the signed URL couldn't be
 * generated (never a broken image, just no photo shown that turn). */
export interface WorkCardPhoto {
  id: string;
  url: string | null;
  visibleSummary: string;
  possibleSummary: string;
  unknownNote: string;
  confidence: "low" | "medium" | "high";
}

const SECTION_HEADING = "mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground";

export function WorkCardDetail({
  workCard,
  conversationGroup,
  isEmergency,
  completedSiblingCount,
  communicationGuidance,
  photos = [],
  simplifiedStatus,
  linkedJobDocId,
}: {
  workCard: WorkCardDetailData;
  conversationGroup: ConversationGroup | null;
  isEmergency: boolean;
  completedSiblingCount: number;
  /** "Surface, don't build" — null when nothing's stored, rendered
   * exactly nowhere in that case. Already phrased as guidance by the
   * caller (buildCommunicationGuidance), never a raw field value. */
  communicationGuidance: string | null;
  /** ReplyFlow V2 — real, already-analysed photos for this job.
   * Empty, not undefined, when the conversation never linked one — no
   * section renders in that case (see the Photos section below). */
  photos?: WorkCardPhoto[];
  /** ReplyFlow V2 — the plain five-stage lifecycle (lib/work-card-
   * state.ts's simplifiedWorkCardStatus), shown as a quiet secondary
   * label next to the existing actionable badge below. That badge
   * answers "what does this need from me" (Needs approval, Waiting
   * for address, Emergency); this answers the plainer "what stage is
   * it at" — deliberately kept as two separate signals, not merged. */
  simplifiedStatus: SimplifiedWorkCardStatus;
  /** ReplyFlow V4 — the linked Job Record's id
   * (0030_link_job_docs_to_work_cards.sql), or null if this Work Card
   * hasn't generated one yet. Drives "Generate report" vs "View
   * report" below; never re-fetched client-side, only set once here
   * or by generateOrOpenReport's own response. */
  linkedJobDocId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { message, isError, acknowledge, softError } = useAcknowledgement();

  const [card, setCard] = useState(workCard);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sendFailedReason, setSendFailedReason] = useState<string | null>(null);
  const [showSentPreview, setShowSentPreview] = useState(false);
  const [sentPreviewText, setSentPreviewText] = useState<string | null>(null);
  const [jobDocId, setJobDocId] = useState(linkedJobDocId);
  const [generatingReport, setGeneratingReport] = useState(false);

  const [issue, setIssue] = useState(card.issue);
  const [address, setAddress] = useState(card.address ?? "");
  const [conversationSummary, setConversationSummary] = useState(card.conversationSummary ?? "");
  const [collectedDetails, setCollectedDetails] = useState(card.collectedDetails ?? "");
  const [scheduledFor, setScheduledFor] = useState(toDateTimeLocalValue(card.scheduledFor));
  const [estimatedValue, setEstimatedValue] = useState(card.estimatedValue != null ? String(card.estimatedValue) : "");
  const [notes, setNotes] = useState(card.notes ?? "");

  // Recomputed from the current, possibly client-updated `card` — a
  // real bug found in production verification: this used to be a
  // static server-passed prop, so the badge silently froze at
  // whatever it was on first load and never reflected a real,
  // successful status change afterward (the write succeeded; only the
  // display didn't).
  const state = useMemo(
    () => describeWorkCardState({ status: card.status, addressConfirmed: card.addressConfirmed, conversationGroup, isEmergency }),
    [card.status, card.addressConfirmed, conversationGroup, isEmergency]
  );

  const isDraft = card.status === "draft";
  const isTerminal = card.status === "completed" || card.status === "cancelled";

  function startEdit() {
    setIssue(card.issue);
    setAddress(card.address ?? "");
    setConversationSummary(card.conversationSummary ?? "");
    setCollectedDetails(card.collectedDetails ?? "");
    setScheduledFor(toDateTimeLocalValue(card.scheduledFor));
    setEstimatedValue(card.estimatedValue != null ? String(card.estimatedValue) : "");
    setNotes(card.notes ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    if (busy || !issue.trim()) return;
    setBusy(true);
    const parsedValue = estimatedValue.trim() ? Number(estimatedValue) : null;
    const updates = {
      issue: issue.trim(),
      address: address.trim() || null,
      conversation_summary: conversationSummary.trim() || null,
      collected_details: collectedDetails.trim() || null,
      scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
      estimated_value: parsedValue != null && !Number.isNaN(parsedValue) ? parsedValue : null,
      notes: notes.trim() || null,
    };
    const { error } = await supabase.from("work_cards").update(updates).eq("id", card.id);
    setBusy(false);
    if (error) {
      softError();
      return;
    }
    setCard({
      ...card,
      issue: updates.issue,
      address: updates.address,
      conversationSummary: updates.conversation_summary,
      collectedDetails: updates.collected_details,
      scheduledFor: updates.scheduled_for,
      estimatedValue: updates.estimated_value,
      notes: updates.notes,
    });
    setEditing(false);
    acknowledge("Updated.");
    // Production hardening — the Work Cards list is a separate route
    // whose own cached data has no way to know this direct client
    // write happened; router.refresh() only re-fetches this page.
    await revalidateWorkCards();
    router.refresh();
  }

  async function confirmAddress() {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.from("work_cards").update({ address_confirmed: true }).eq("id", card.id);
    setBusy(false);
    if (error) {
      softError();
      return;
    }
    setCard({ ...card, addressConfirmed: true });
    acknowledge("Address confirmed.");
    router.refresh();
  }

  async function approve() {
    if (busy) return;
    setBusy(true);
    setSendFailedReason(null);
    setSentPreviewText(null);
    try {
      const res = await fetch(`/api/work-cards/${card.id}/approve`, { method: "POST" });
      const payload = await res.json();
      setBusy(false);
      if (!res.ok) {
        softError();
        return;
      }
      setCard({ ...card, status: "booked" });
      // ReplyFlow V4 (P1.D) — the same canonical behaviour as approving
      // from a conversation thread: the owner always sees what was
      // actually sent, not just a status flip. The API route
      // (app/api/work-cards/[id]/approve/route.ts) already returned
      // this for free; the bug was this screen throwing it away.
      setSentPreviewText(payload.confirmationText);
      if (!payload.sent) setSendFailedReason(payload.sendError || "Couldn't send the confirmation.");
      setShowSentPreview(true);
      acknowledge(payload.sent ? "Booked — confirmation sent." : "Booked — but the confirmation didn't send.");
      router.refresh();
    } catch {
      setBusy(false);
      softError();
    }
  }

  async function generateOrOpenReport() {
    if (generatingReport) return;
    if (jobDocId) {
      router.push(`/dashboard/job-records/${jobDocId}`);
      return;
    }
    setGeneratingReport(true);
    try {
      const res = await fetch(`/api/work-cards/${card.id}/job-doc`, { method: "POST" });
      const payload = await res.json();
      setGeneratingReport(false);
      if (!res.ok) {
        softError();
        return;
      }
      setJobDocId(payload.id);
      router.push(`/dashboard/job-records/${payload.id}`);
    } catch {
      setGeneratingReport(false);
      softError();
    }
  }

  async function transitionTo(next: string, ackText: string) {
    if (busy) return;
    setBusy(true);
    // ReplyFlow V4 — Conversation Episodes: this transition may also need
    // to close the Work Card's episode, and conversation_episodes is
    // service-role-write-only, so this goes through the shared status
    // route (app/api/work-cards/[id]/status) instead of a direct write.
    let completedAt: string | null = null;
    let ok = true;
    try {
      const res = await fetch(`/api/work-cards/${card.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      ok = res.ok;
      if (ok) {
        const payload = await res.json();
        completedAt = payload.completedAt ?? null;
      }
    } catch {
      ok = false;
    }
    setBusy(false);
    if (!ok) {
      softError();
      return;
    }
    setCard({ ...card, status: next, ...(next === "completed" ? { completedAt: completedAt ?? new Date().toISOString() } : {}) });
    acknowledge(ackText);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3.5">
        <Link
          href={card.conversationId ? `/dashboard/conversations/${card.conversationId}` : "/dashboard"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Back"
        >
          <ChevronLeft className="h-[18px] w-[18px]" />
        </Link>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-primary">
          {card.customerName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold">{card.customerName}</p>
          <p className="truncate text-[12px] text-muted-foreground">{card.issue}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {/* Plain lifecycle stage — "what stage is this job at,"
           * deliberately separate from the badge below it ("what does
           * this need from me right now"). */}
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
            {SIMPLIFIED_STATUS_LABEL[simplifiedStatus]}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              WORK_CARD_TONE_STYLE[state.tone]
            )}
          >
            {state.tone === "emergency" && <AlertTriangle className="h-2.5 w-2.5" />}
            {state.label}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5 md:p-6">
        <Acknowledgement message={message} isError={isError} />

        {/* ReplyFlow V4 (P1.D) — the same canonical "what did I just send"
         * preview as approving from a conversation thread
         * (conversation-story.tsx), not a separate, plainer banner.
         * Replaces the old sendFailedReason-only banner this screen used
         * to show on its own — that was the actual behavioural gap: the
         * API always returned confirmationText, only this screen never
         * showed it. */}
        <AnimatePresence initial={false}>
          {showSentPreview && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-border bg-card p-3.5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {sendFailedReason ? "This is what I tried to send" : "Sent to the customer"}
                </p>
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-[13px] leading-relaxed text-primary-foreground">
                    {sentPreviewText}
                  </div>
                </div>
                {sendFailedReason ? (
                  <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-red-700">
                    The booking is confirmed, but the WhatsApp message didn&apos;t send: {sendFailedReason}
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-muted-foreground">Delivered over WhatsApp.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status actions — what this card needs from the owner right now, first. */}
        {!isTerminal && (
          <SettleCard delay={0} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className={SECTION_HEADING}>Actions</h2>
            <div className="flex flex-wrap gap-2">
              {isDraft && (
                <>
                  <motion.button
                    {...press}
                    onClick={approve}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve booking
                  </motion.button>
                  <motion.button
                    {...press}
                    onClick={() => transitionTo("cancelled", "Rejected — this won't be booked.")}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-[13px] font-semibold text-muted-foreground disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </motion.button>
                </>
              )}
              {card.status === "booked" && (
                <>
                  <motion.button
                    {...press}
                    onClick={() => transitionTo("in_progress", "Marked as in progress.")}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <PlayCircle className="h-4 w-4" /> Start job
                  </motion.button>
                  <motion.button
                    {...press}
                    onClick={() => transitionTo("cancelled", "Cancelled.")}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-[13px] font-semibold text-muted-foreground disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> Cancel
                  </motion.button>
                </>
              )}
              {card.status === "in_progress" && (
                <>
                  <motion.button
                    {...press}
                    onClick={() => transitionTo("completed", "Nice. That one's finished.")}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Mark completed
                  </motion.button>
                  <motion.button
                    {...press}
                    onClick={() => transitionTo("cancelled", "Cancelled.")}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-[13px] font-semibold text-muted-foreground disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> Cancel
                  </motion.button>
                </>
              )}
              {!["draft", "booked", "in_progress"].includes(card.status) && (
                <span className="text-[13px] text-muted-foreground">Needs a decision — see Conversations for the pending enquiry.</span>
              )}
            </div>
          </SettleCard>
        )}

        {/* ReplyFlow V4 (P0.A) — the Work Card → Job Record link. Only
         * offered once the job is genuinely completed: customer,
         * address, issue, notes, and analysed photos all flow in
         * automatically (app/api/work-cards/[id]/job-doc/route.ts) —
         * nothing here asks the owner to retype anything already
         * known. Once generated, this becomes "View report" instead,
         * never a second, competing way to create the same document. */}
        {card.status === "completed" && (
          <SettleCard delay={0} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className={SECTION_HEADING}>Report</h2>
            <p className="mb-3 text-[13px] text-muted-foreground">
              {jobDocId
                ? "The customer-facing report for this job."
                : "Turn this completed job into a professional, customer-facing report — nothing here gets retyped."}
            </p>
            <motion.button
              {...press}
              onClick={generateOrOpenReport}
              disabled={generatingReport}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              {generatingReport ? "Generating…" : jobDocId ? "View report" : "Generate report"}
            </motion.button>
          </SettleCard>
        )}

        {/* Contact & address — tap to call, tap to navigate. */}
        <Reveal index={1}>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className={SECTION_HEADING}>Customer</h2>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold">{card.customerName}</span>
                {card.conversationId && (
                  <Link
                    href={`/dashboard/conversations/${card.conversationId}`}
                    className="flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> View conversation
                  </Link>
                )}
              </div>
              {card.customerPhone && (
                <a href={`tel:${card.customerPhone}`} className="flex items-center gap-2 text-[13.5px] text-primary hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {card.customerPhone}
                </a>
              )}
              {/* "Surface, don't build" — only ever appears when the
               * owner genuinely stored a preference; consistent with
               * the identical treatment on the conversation view. */}
              {communicationGuidance && (
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">{communicationGuidance}</p>
              )}
              {!editing && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {card.address ? (
                    <div className="min-w-0 flex-1">
                      <a
                        href={mapsHref(card.address)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[13.5px] text-primary hover:underline"
                      >
                        {card.address} <Navigation className="h-3 w-3 shrink-0" />
                      </a>
                      {!card.addressConfirmed && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            <AlertTriangle className="h-2.5 w-2.5" /> Address unconfirmed
                          </span>
                          <button
                            onClick={confirmAddress}
                            disabled={busy}
                            className="text-[11.5px] font-semibold text-primary hover:underline disabled:opacity-50"
                          >
                            Confirm address
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[13.5px] text-muted-foreground">No address yet.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* The job itself, and everything owner-editable. */}
        <Reveal index={2}>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">The job</h2>
              {!editing && (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                <Field label="Issue">
                  <input
                    value={issue}
                    onChange={(e) => setIssue(e.target.value)}
                    // Production hardening — a real "boiler
                    // leakingLeaking boiler - kitchen sink" value found
                    // in production data: typing into a pre-filled
                    // field without clearing it first silently
                    // concatenates instead of replacing. Auto-selecting
                    // on focus means the first keystroke replaces the
                    // whole value, matching what most people expect.
                    onFocus={(e) => e.target.select()}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Address">
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Not yet known"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Conversation summary">
                  <textarea
                    value={conversationSummary}
                    onChange={(e) => setConversationSummary(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Collected details (parking, access, anything volunteered)">
                  <textarea
                    value={collectedDetails}
                    onChange={(e) => setCollectedDetails(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Appointment time">
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Estimated value (£)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    placeholder="Not set"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary"
                  />
                </Field>
                <Field label="Notes">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:border-primary"
                  />
                </Field>
                <div className="flex gap-2 pt-1">
                  <motion.button
                    {...press}
                    onClick={saveEdit}
                    disabled={busy || !issue.trim()}
                    className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Save
                  </motion.button>
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-xl border border-border px-4 py-2 text-[13px] font-semibold text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 text-[13.5px]">
                <Row label="Issue" value={card.issue} />
                <Row label="Conversation summary" value={card.conversationSummary} placeholder="Nothing recorded yet." />
                <Row label="Collected details" value={card.collectedDetails} placeholder="Nothing volunteered yet." />
                <Row label="Appointment" value={formatDateTime(card.scheduledFor)} placeholder="No time set." />
                <Row label="Estimated value" value={card.estimatedValue != null ? `£${card.estimatedValue.toFixed(2)}` : null} placeholder="Not set." />
                <Row label="Notes" value={card.notes} placeholder="Nothing added." />
              </div>
            )}
          </div>
        </Reveal>

        {/* ReplyFlow V2 — real, already-analysed customer photos. Never
         * rendered when there are none, exactly like every other
         * optional section on this page. */}
        {photos.length > 0 && (
          <Reveal index={3}>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className={SECTION_HEADING}>Photos</h2>
              <div className="space-y-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="overflow-hidden rounded-xl border border-border/60">
                    {photo.url && (
                      // eslint-disable-next-line @next/next/no-img-element -- a per-job signed URL, not an optimizable static asset
                      <img src={photo.url} alt="Photo sent by the customer" className="max-h-72 w-full object-cover" />
                    )}
                    <div className="space-y-1.5 bg-muted/30 px-3.5 py-3 text-[12.5px] leading-snug">
                      <p>
                        <span className="font-semibold text-foreground">Visible: </span>
                        <span className="text-muted-foreground">{photo.visibleSummary}</span>
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">Possible — not certain: </span>
                        <span className="text-muted-foreground">{photo.possibleSummary}</span>
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">Can&apos;t tell without an in-person look: </span>
                        <span className="text-muted-foreground">{photo.unknownNote}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        {completedSiblingCount > 0 && (
          <Reveal index={4}>
            <p className="rounded-xl bg-muted/50 px-4 py-2.5 text-[12.5px] text-muted-foreground">
              {completedSiblingCount} completed job{completedSiblingCount === 1 ? "" : "s"} with this customer before.
            </p>
          </Reveal>
        )}

        <p className="pb-2 text-[11.5px] text-muted-foreground">
          Created {formatDate(card.createdAt)}
          {card.approvedAt && ` · Approved ${formatDate(card.approvedAt)}`}
          {card.completedAt && ` · Completed ${formatDate(card.completedAt)}`}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, placeholder }: { label: string; value: string | null; placeholder?: string }) {
  return (
    <div>
      <p className="text-[11.5px] font-semibold text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 whitespace-pre-wrap", !value && "text-muted-foreground/70")}>{value || placeholder || "—"}</p>
    </div>
  );
}
