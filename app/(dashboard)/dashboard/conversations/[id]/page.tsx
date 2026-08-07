import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CUSTOMER_MEDIA_BUCKET } from "@/lib/reply-engine/media-storage";
import { ConversationStory } from "@/components/dashboard/conversations/conversation-story";
import { statusLabel, groupForStatus } from "@/lib/conversations";
import { parseAvailability, nextAvailableSlot, toDateString } from "@/lib/availability";
import { toConversationState } from "@/lib/reply-engine/understanding/state";
import { buildWorkCardDraft } from "@/lib/work-card";
import {
  relationshipStrengthFor,
  buildRelationshipSummary,
  buildCommunicationGuidance,
  type CustomerJob,
} from "@/lib/customer-memory-signals";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversation — ReplyFlow" };

/**
 * A conversation opens with its story (what's been collected, where
 * things stand, the obvious next action) before the messages — the
 * owner should never have to read a whole thread to understand it
 * (Conversations V1: five-second rule).
 */
export default async function ConversationDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS (0003) scopes this to the signed-in owner's business.
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, business_id, customer_name, customer_phone, status, ai_state, created_at, communication_preference")
    .eq("id", params.id)
    .maybeSingle();

  if (!conversation) notFound();

  const [{ data: existingWorkCards }, { data: allWorkCards }, { data: messages }, { data: business }, { data: pendingDrafts }, { data: conversationPhotos }] = await Promise.all([
    // A rejected draft can be followed by a fresh one on the same
    // conversation — most-recent-first + limit(1) so this never
    // breaks once more than one Work Card row exists here
    // (maybeSingle() errors on ambiguous multiple rows).
    supabase
      .from("work_cards")
      .select("id, issue, scheduled_for, status, notes")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(1),
    // Trust Ladder V1 companion (Candidate 1) — the same real job
    // history relationshipStrengthFor()/buildRelationshipSummary()
    // already read on the Customer page (app/(dashboard)/dashboard/
    // customers/[id]/page.tsx), fetched here too so that same, exact
    // computation can run where the owner is actually deciding how to
    // handle this customer. A conversation is unique per
    // (business_id, customer_phone), so this conversation_id's full
    // work_cards history *is* this customer's full history — no new
    // relationship concept, the same one the Customer page already uses.
    supabase
      .from("work_cards")
      .select("id, issue, status, scheduled_for, completed_at, notes, created_at, estimated_value")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("messages")
      .select("id, direction, body, message_type, storage_path, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("businesses")
      .select("business_name, availability, opening_time, closing_time")
      .eq("id", conversation.business_id)
      .maybeSingle(),
    // The Reply Engine's most recent still-open draft for this
    // conversation (Sprint 10A) — same most-recent-first + limit(1)
    // pattern as Work Cards above, for the same reason.
    supabase
      .from("reply_drafts")
      .select(
        "id, draft_text, final_text, intent, confidence, requires_escalation, escalation_reason, facts_used, status"
      )
      .eq("conversation_id", conversation.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1),
    // Phase B — the already-computed VISIBLE/POSSIBLE analysis for any
    // photo in this conversation, keyed by message_id below so it can
    // render right under the photo it belongs to.
    supabase
      .from("conversation_photos")
      .select("message_id, visible_summary, possible_summary")
      .eq("conversation_id", conversation.id),
  ]);

  const allMessages = messages ?? [];
  const photoCount = allMessages.filter((m) => m.message_type !== "text").length;
  const photoAnalysisByMessageId = new Map((conversationPhotos ?? []).map((p) => [p.message_id, p]));

  // Signed URLs, generated server-side with the service role — the
  // customer-media bucket is private with no policy granted to
  // `authenticated` at all (0024_customer_photos.sql), so the only way
  // in is here, after the RLS-scoped `conversations` select above has
  // already proven this signed-in owner actually owns this conversation.
  const imageMessages = allMessages.filter((m) => m.message_type === "image" && m.storage_path);
  const signedUrlByMessageId = new Map<string, string>();
  if (imageMessages.length > 0) {
    const service = createServiceClient();
    const signedResults = await Promise.all(
      imageMessages.map((m) => service.storage.from(CUSTOMER_MEDIA_BUCKET).createSignedUrl(m.storage_path as string, 3600))
    );
    imageMessages.forEach((m, i) => {
      const url = signedResults[i]?.data?.signedUrl;
      if (url) signedUrlByMessageId.set(m.id, url);
    });
  }
  const group = groupForStatus(conversation.status);
  const latestCustomerMessage = [...allMessages].reverse().find((m) => m.direction === "inbound")?.body ?? null;

  // Trust Ladder V1 companion (Candidate 1) — reusing
  // relationshipStrengthFor()/buildRelationshipSummary() exactly as
  // the Customer page already does, not a second version of either.
  // waitingMinutes is deliberately passed as null: this page's own
  // status badge (rendered just above) already shows whether the
  // conversation is waiting, so repeating it in the summary sentence
  // would be exactly the kind of detail that doesn't help the owner's
  // decision here, per the founder's own instruction to leave out
  // whatever doesn't earn its place.
  const customerJobs: CustomerJob[] = (allWorkCards ?? []).map((j) => ({
    id: j.id,
    jobTitle: j.issue,
    status: j.status,
    scheduledFor: j.scheduled_for,
    completedAt: j.completed_at,
    notes: j.notes,
    createdAt: j.created_at,
    estimatedValue: j.estimated_value,
  }));
  const completedJobCount = customerJobs.filter((j) => j.status === "completed").length;
  const mostRecentJob =
    [...customerJobs]
      .filter((j) => j.status === "completed")
      .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())[0] ?? null;
  const relationshipStrength = relationshipStrengthFor(completedJobCount);
  const relationshipSummary = buildRelationshipSummary({
    name: conversation.customer_name || conversation.customer_phone,
    conversationStartedAt: conversation.created_at,
    completedJobCount,
    mostRecentJob,
    waitingMinutes: null,
  });

  // "Surface, don't build" (2026-08-02) — the owner's own stored
  // communication_preference, already editable on the Customer page,
  // shown here as guidance rather than a raw field precisely because
  // this is the screen with the "Call customer" button right on it —
  // the one moment that preference could actually change what the
  // owner does next. null when nothing's stored, so the common case
  // renders nothing extra at all.
  const communicationGuidance = buildCommunicationGuidance(
    conversation.customer_name || conversation.customer_phone,
    conversation.communication_preference
  );

  // A real, honest suggestion — the same diary rules the Diary page's
  // own preview line uses, never a fabricated understanding of this
  // specific conversation's content. Scoped to a day, never a time.
  const suggestedSlot = business
    ? nextAvailableSlot(
        parseAvailability(business.availability, business.opening_time, business.closing_time),
        new Date()
      )
    : null;

  // The Work Card pipeline (DOCS/SPECS/Work-Card-Object.md) — a
  // deterministic draft of the automatic fields, assembled from this
  // conversation's real Conversation State. Never shown as fact until
  // the owner creates and reviews the Work Card; only pre-fills it.
  const workCardDraft = buildWorkCardDraft(toConversationState(conversation.ai_state));

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3.5">
        <Link
          href="/dashboard/conversations"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
          aria-label="Back to all conversations"
        >
          <ChevronLeft className="h-[18px] w-[18px]" />
        </Link>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold text-primary">
          {(conversation.customer_name || conversation.customer_phone).slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold">{conversation.customer_name || conversation.customer_phone}</p>
          <p className="truncate text-[12px] text-muted-foreground">{conversation.customer_phone}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            group === "waiting" && "border-amber-200 bg-amber-50 text-amber-700",
            group === "active" && "border-primary/20 bg-accent text-primary",
            group === "booked" && "border-success/25 bg-success/10 text-success",
            group === "done" && "border-border bg-muted text-muted-foreground"
          )}
        >
          {statusLabel(conversation.status)}
        </span>
      </div>

      <ConversationStory
        conversationId={conversation.id}
        businessId={conversation.business_id}
        businessName={business?.business_name ?? "The team"}
        status={conversation.status}
        customerName={conversation.customer_name}
        customerPhone={conversation.customer_phone}
        messageCount={allMessages.length}
        photoCount={photoCount}
        existingWorkCard={existingWorkCards?.[0] ?? null}
        workCardDraft={workCardDraft}
        latestCustomerMessage={latestCustomerMessage}
        suggestedSlotDate={suggestedSlot ? toDateString(suggestedSlot.date) : null}
        suggestedSlotLabel={suggestedSlot?.label ?? null}
        pendingDraft={pendingDrafts?.[0] ?? null}
        relationshipStrength={relationshipStrength}
        relationshipSummary={relationshipSummary}
        communicationGuidance={communicationGuidance}
      />

      <div className="flex-1 space-y-3 overflow-y-auto p-5 md:p-6">
        {allMessages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing has been said yet — I&apos;ll bring every message here.
          </p>
        ) : (
          allMessages.map((m) => (
            <div key={m.id} className={cn("flex", m.direction === "inbound" ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed",
                  m.direction === "inbound"
                    ? "rounded-bl-sm bg-muted text-foreground"
                    : "rounded-br-sm bg-primary text-primary-foreground"
                )}
              >
                {m.message_type === "image" && signedUrlByMessageId.has(m.id) ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a per-conversation signed URL, not an optimizable static asset */}
                    <img
                      src={signedUrlByMessageId.get(m.id)}
                      alt="Photo sent by the customer"
                      className="mb-1.5 max-h-64 w-full rounded-lg object-cover"
                    />
                    {m.body && m.body !== "[image message]" && <p>{m.body}</p>}
                    {photoAnalysisByMessageId.has(m.id) && (
                      <div className="mt-1.5 rounded-lg bg-background/60 px-2.5 py-2 text-[12px] leading-snug text-muted-foreground">
                        <p>
                          <span className="font-semibold text-foreground">Visible: </span>
                          {photoAnalysisByMessageId.get(m.id)!.visible_summary}
                        </p>
                        <p className="mt-1">
                          <span className="font-semibold text-foreground">Possible: </span>
                          {photoAnalysisByMessageId.get(m.id)!.possible_summary}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  m.body
                )}
                <div
                  className={cn(
                    "mt-1 text-[10.5px]",
                    m.direction === "inbound" ? "text-muted-foreground" : "text-primary-foreground/70"
                  )}
                >
                  {new Date(m.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/*
        No free-form composer yet (Sprint 10A) — the only outbound path
        today is approving an AI-drafted reply above. A disabled input
        would imply functionality that isn't real (Trust before features).
      */}
    </div>
  );
}
