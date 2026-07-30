import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { factSourceSummary } from "@/lib/fact-source-summary";
import { formatDateTime } from "@/lib/work-card-format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversation — ReplyFlow Admin" };
export const dynamic = "force-dynamic";

/**
 * Master Execution Plan 3.3 — the read-only half of "a business's
 * conversation history alongside its stored reasoning trace." Reuses
 * `factSourceSummary` (the exact function the owner's own Conversations
 * page already uses for "Based on…") rather than reimplementing it —
 * everything else here is deliberately new and simpler than
 * ConversationStory: that component is a heavy, interactive Client
 * Component whose every action (approve/edit/reject/send) assumes and
 * writes through the *current session's own* RLS-checked ownership, so
 * reusing it directly for a different business's conversation would
 * either silently fail every action or require disabling RLS in a way
 * that defeats tenant isolation. Support and incident investigation
 * only ever needs to read here, never act — approving or sending stays
 * the owner's own job, on their own dashboard.
 */
export default async function AdminConversationPage({ params }: { params: { id: string } }) {
  const service = createServiceClient();

  const { data: conversation } = await service
    .from("conversations")
    .select("id, business_id, customer_name, customer_phone, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!conversation) notFound();

  const [{ data: business }, { data: messages }, { data: drafts }] = await Promise.all([
    service.from("businesses").select("business_name").eq("id", conversation.business_id).maybeSingle(),
    service
      .from("messages")
      .select("id, direction, body, created_at")
      .eq("conversation_id", params.id)
      .order("created_at", { ascending: true }),
    service
      .from("reply_drafts")
      .select("customer_message_id, status, draft_text, final_text, confidence, category, requires_escalation, escalation_reason, facts_used, created_at")
      .eq("conversation_id", params.id)
      .order("created_at", { ascending: true }),
  ]);

  const draftByMessage = new Map((drafts ?? []).map((d) => [d.customer_message_id, d]));

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/businesses/${conversation.business_id}`} className="text-[12.5px] text-slate-400 hover:text-slate-200">
          ← {business?.business_name ?? "Business"}
        </Link>
        <h1 className="mt-1 text-[20px] font-bold tracking-tight">{conversation.customer_name || conversation.customer_phone}</h1>
        <p className="text-[13px] text-slate-400">
          {conversation.customer_phone} · {conversation.status}
        </p>
      </div>

      <div className="space-y-3">
        {(messages ?? []).map((m) => {
          const draft = draftByMessage.get(m.id);
          const reasoning = draft ? factSourceSummary(draft.facts_used) : null;
          return (
            <div key={m.id} className="space-y-1.5">
              <div
                className={cn(
                  "max-w-xl rounded-lg border p-3 text-[13.5px]",
                  m.direction === "inbound" ? "border-slate-800 bg-slate-900" : "ml-auto border-sky-900 bg-sky-950/60"
                )}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {m.direction === "inbound" ? "Customer" : "Sent"} · {formatDateTime(m.created_at)}
                </p>
                <p className="whitespace-pre-wrap text-slate-100">{m.body}</p>
              </div>
              {draft && (
                <div className="ml-2 max-w-xl rounded-lg border border-dashed border-slate-700 bg-slate-900/50 p-2.5 text-[12px] text-slate-400">
                  <p>
                    <span className="font-semibold text-slate-300">Reasoning trace</span> · status: {draft.status} · confidence:{" "}
                    {draft.confidence} · category: {draft.category}
                    {draft.requires_escalation && <span className="ml-1 font-semibold text-amber-400">· escalated</span>}
                  </p>
                  {draft.escalation_reason && <p className="mt-1">Escalation reason: {draft.escalation_reason}</p>}
                  {reasoning && <p className="mt-1">Based on: {reasoning}</p>}
                  {draft.final_text && draft.final_text !== draft.draft_text && (
                    <p className="mt-1">
                      Edited from: <span className="italic">&ldquo;{draft.draft_text}&rdquo;</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {(messages ?? []).length === 0 && <p className="text-[13px] text-slate-500">No messages yet.</p>}
      </div>
    </div>
  );
}
