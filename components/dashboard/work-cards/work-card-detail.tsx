"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { press, SettleCard, Reveal, EASE } from "@/components/shared/motion";
import { Acknowledgement, useAcknowledgement } from "@/components/shared/acknowledgement";
import { createClient } from "@/lib/supabase/client";
import { WORK_CARD_TONE_STYLE, type WorkCardState } from "@/lib/work-card-state";
import { toDateTimeLocalValue, mapsHref, formatDateTime, formatDate } from "@/lib/work-card-format";
import { cn } from "@/lib/utils";

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

const SECTION_HEADING = "mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground";

export function WorkCardDetail({
  workCard,
  state,
  completedSiblingCount,
}: {
  workCard: WorkCardDetailData;
  state: WorkCardState;
  completedSiblingCount: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { message, isError, acknowledge, softError } = useAcknowledgement();

  const [card, setCard] = useState(workCard);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sendFailedReason, setSendFailedReason] = useState<string | null>(null);

  const [issue, setIssue] = useState(card.issue);
  const [address, setAddress] = useState(card.address ?? "");
  const [conversationSummary, setConversationSummary] = useState(card.conversationSummary ?? "");
  const [collectedDetails, setCollectedDetails] = useState(card.collectedDetails ?? "");
  const [scheduledFor, setScheduledFor] = useState(toDateTimeLocalValue(card.scheduledFor));
  const [estimatedValue, setEstimatedValue] = useState(card.estimatedValue != null ? String(card.estimatedValue) : "");
  const [notes, setNotes] = useState(card.notes ?? "");

  const isDraft = card.status === "draft";
  const isTerminal = card.status === "completed" || card.status === "cancelled";
  const isActiveBooking = card.status === "booked" || card.status === "in_progress";

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
    try {
      const res = await fetch(`/api/work-cards/${card.id}/approve`, { method: "POST" });
      const payload = await res.json();
      setBusy(false);
      if (!res.ok) {
        softError();
        return;
      }
      setCard({ ...card, status: "booked" });
      if (!payload.sent) setSendFailedReason(payload.sendError || "Couldn't send the confirmation.");
      acknowledge(payload.sent ? "Booked — confirmation sent." : "Booked — but the confirmation didn't send.");
      router.refresh();
    } catch {
      setBusy(false);
      softError();
    }
  }

  async function transitionTo(next: string, ackText: string) {
    if (busy) return;
    setBusy(true);
    const extra = next === "completed" ? { completed_at: new Date().toISOString() } : {};
    const { error } = await supabase
      .from("work_cards")
      .update({ status: next, ...extra })
      .eq("id", card.id);
    setBusy(false);
    if (error) {
      softError();
      return;
    }
    setCard({ ...card, status: next, ...(next === "completed" ? { completedAt: new Date().toISOString() } : {}) });
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
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            WORK_CARD_TONE_STYLE[state.tone]
          )}
        >
          {state.tone === "emergency" && <AlertTriangle className="h-2.5 w-2.5" />}
          {state.label}
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5 md:p-6">
        <Acknowledgement message={message} isError={isError} />

        {sendFailedReason && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            Booked, but the confirmation message didn&apos;t send: {sendFailedReason}
          </div>
        )}

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

        {completedSiblingCount > 0 && (
          <Reveal index={3}>
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
