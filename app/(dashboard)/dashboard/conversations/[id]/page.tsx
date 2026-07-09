import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversation — ReplyFlow" };

export default async function ConversationDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS (see supabase/migrations/0003) already scopes this to the
  // signed-in owner's own business — a conversation id belonging to
  // someone else simply returns no row here, not a 403.
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, customer_name, customer_phone, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!conversation) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, direction, body, message_type, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

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
        <Badge variant={conversation.status === "open" ? "success" : "outline"} className="shrink-0">
          {conversation.status}
        </Badge>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-6">
        {!messages || messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No messages in this conversation yet.</p>
        ) : (
          messages.map((m) => (
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
        No message-sending yet — outbound messages require the AI
        Conversations engine / a "send via WhatsApp" API call, neither
        of which exists yet. A disabled composer here would imply
        functionality that isn't real; leaving it out until sending is
        actually wired up is the more honest state.
      */}
    </div>
  );
}
