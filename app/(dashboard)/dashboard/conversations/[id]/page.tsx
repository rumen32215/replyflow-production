import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConversationStory } from "@/components/dashboard/conversations/conversation-story";
import { statusLabel, groupForStatus } from "@/lib/conversations";
import { parseAvailability, nextAvailableSlot, toDateString } from "@/lib/availability";
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
    .select("id, business_id, customer_name, customer_phone, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!conversation) notFound();

  const [{ data: messages }, { data: existingJobs }, { data: business }, { data: pendingDrafts }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, direction, body, message_type, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true }),
    // A rejected draft can be followed by a fresh one on the same
    // conversation — most-recent-first + limit(1) so this never
    // breaks once more than one job row exists here (maybeSingle()
    // errors on ambiguous multiple rows).
    supabase
      .from("jobs")
      .select("id, job_title, scheduled_for, status, notes")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("businesses")
      .select("business_name, availability, opening_time, closing_time")
      .eq("id", conversation.business_id)
      .maybeSingle(),
    // The Reply Engine's most recent still-open draft for this
    // conversation (Sprint 10A) — same most-recent-first + limit(1)
    // pattern as jobs above, for the same reason.
    supabase
      .from("reply_drafts")
      .select(
        "id, draft_text, final_text, intent, confidence, requires_escalation, escalation_reason, facts_used, status"
      )
      .eq("conversation_id", conversation.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const allMessages = messages ?? [];
  const photoCount = allMessages.filter((m) => m.message_type !== "text").length;
  const group = groupForStatus(conversation.status);
  const latestCustomerMessage = [...allMessages].reverse().find((m) => m.direction === "inbound")?.body ?? null;

  // A real, honest suggestion — the same diary rules the Diary page's
  // own preview line uses, never a fabricated understanding of this
  // specific conversation's content. Scoped to a day, never a time.
  const suggestedSlot = business
    ? nextAvailableSlot(
        parseAvailability(business.availability, business.opening_time, business.closing_time),
        new Date()
      )
    : null;

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
        existingJob={existingJobs?.[0] ?? null}
        latestCustomerMessage={latestCustomerMessage}
        suggestedSlotDate={suggestedSlot ? toDateString(suggestedSlot.date) : null}
        suggestedSlotLabel={suggestedSlot?.label ?? null}
        pendingDraft={pendingDrafts?.[0] ?? null}
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
                {m.body}
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
