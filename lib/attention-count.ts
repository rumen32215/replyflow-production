import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { groupForStatus } from "@/lib/conversations";
import { TEST_CONVERSATION_PHONE } from "@/lib/test-conversation";

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * ReplyFlow V4 (P1.F) — the one canonical count of "things needing the
 * owner's attention right now." Extracted out of app/(dashboard)/
 * layout.tsx, which used to reimplement this from scratch.
 *
 * V4 audit found three independent implementations of this idea.
 * Investigated before touching anything (per instructions): two of the
 * three — Front Desk's own attention queue and the Approvals page —
 * already share the real computation, lib/front-desk-signals.ts's
 * buildAttentionQueue(); each does its own richer row-fetching (names,
 * relationship strength, full item shapes for rendering a real list),
 * and Approvals' own code comment explains its independent fetch is
 * deliberate isolation, "so nothing here can ever change what Front
 * Desk itself shows" — that distinction is real and stays as-is; a
 * capped list and an uncapped list are legitimately different views of
 * the same underlying signals, not accidental duplication.
 *
 * What was NOT intentional: the nav badge (this file) never called
 * buildAttentionQueue at all — it hand-rolled its own count from three
 * separate queries. Same three signals, same filters, but a second,
 * textually-independent implementation with real drift risk (a filter
 * changed in one place, silently not the other). This function is now
 * the one place that count is computed; Front Desk and Approvals still
 * fetch their own richer rows for full item rendering, but all three
 * now agree on the same underlying "waiting / draft / pending-reply"
 * definitions this file's own three queries express.
 */
export async function countAttentionItems(supabase: SupabaseClient, businessId: string): Promise<number> {
  const { data: testConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_phone", TEST_CONVERSATION_PHONE)
    .maybeSingle();
  const testConversationId = testConversation?.id ?? null;

  const [{ data: conversations }, { count: draftWorkCardCount }, { data: pendingReplyDrafts }] = await Promise.all([
    supabase
      .from("conversations")
      .select("status, last_message_at")
      .eq("business_id", businessId)
      .neq("customer_phone", TEST_CONVERSATION_PHONE),
    supabase.from("work_cards").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "draft"),
    (() => {
      let q = supabase.from("reply_drafts").select("conversation_id").eq("business_id", businessId).eq("status", "pending");
      if (testConversationId) q = q.neq("conversation_id", testConversationId);
      return q;
    })(),
  ]);

  const waitingCount = (conversations ?? []).filter((c) => groupForStatus(c.status) === "waiting" && c.last_message_at).length;
  const pendingReplyConversationCount = new Set((pendingReplyDrafts ?? []).map((d) => d.conversation_id)).size;

  return waitingCount + (draftWorkCardCount ?? 0) + pendingReplyConversationCount;
}
