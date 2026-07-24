import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendReplyToCustomer } from "@/lib/reply-engine/send";

export const runtime = "nodejs";

/**
 * Product Guarantee 3: the owner must always have a way to reach their
 * customer, even when the AI produces no draft — a real gap found in
 * live testing, where a conversation with no reply_drafts row had no
 * reply mechanism at all beyond "Call customer." Mirrors the same
 * auth/ownership/server-only pattern as reply-drafts' approve route
 * (id:app/api/reply-drafts/[id]/route.ts) for the same reason: sending
 * uses the business's stored WhatsApp Graph API access token, which
 * must never reach the browser. Reuses sendReplyToCustomer — the one
 * real send implementation both the AI-draft path and this manual
 * fallback path share, so bookkeeping (the outbound message row,
 * last_message_at, conversation status) never drifts between the two.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "A message is required." }, { status: 400 });

  const service = createServiceClient();

  const { data: conversation } = await service
    .from("conversations")
    .select("id, business_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const { data: business } = await service
    .from("businesses")
    .select("id, owner_id")
    .eq("id", conversation.business_id)
    .maybeSingle();
  if (!business || business.owner_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const result = await sendReplyToCustomer({
    supabase: service,
    businessId: conversation.business_id,
    conversationId: conversation.id,
    text,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
