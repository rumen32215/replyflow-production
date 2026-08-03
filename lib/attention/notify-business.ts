import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { describeConnectionHealth } from "@/lib/front-desk-signals";
import { TEST_CONVERSATION_PHONE } from "@/lib/test-conversation";
import { classifyAttentionTier, crossesQuietHours, type AttentionSnapshot } from "./tiering";
import { shouldDeliver } from "./delivery-decision";
import { composeAttentionEmail } from "./copy";
import { deliverEmail } from "./deliver-email";
import { recordProductEvent } from "@/lib/product-events";
import { recordErrorEvent } from "@/lib/error-events";

type ServiceClient = ReturnType<typeof createServiceClient>;

export interface NotifyBusinessInput {
  supabase: ServiceClient;
  now: Date;
  appUrl: string;
  business: {
    id: string;
    ownerId: string;
    businessName: string;
    whatsappConnected: boolean;
    openingTime: string;
    closingTime: string;
  };
}

export type NotifyBusinessOutcome = "sent" | "skipped_no_signal" | "skipped_suppressed" | "skipped_no_owner_email" | "failed";

/**
 * Owner Attention Architecture — one business's full delivery decision,
 * end to end: gather the real, already-computed signals (§1), classify
 * (§2–§3), decide (§4), compose (§0's permanent principle), deliver
 * (§6), record. Called once per business per cron tick
 * (`app/api/cron/attention/route.ts`) — every step here is cheap and
 * safe to run frequently, by design.
 *
 * Best-effort throughout: a failure here must never affect a real
 * customer interaction, matching every other background job in this
 * codebase.
 */
export async function notifyBusiness(input: NotifyBusinessInput): Promise<NotifyBusinessOutcome> {
  const { supabase, now, appUrl, business } = input;

  try {
    const { data: testConversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("business_id", business.id)
      .eq("customer_phone", TEST_CONVERSATION_PHONE)
      .maybeSingle();
    const testConversationId = testConversation?.id ?? null;

    let pendingQuery = supabase
      .from("reply_drafts")
      .select("id, conversation_id, requires_escalation")
      .eq("business_id", business.id)
      .eq("status", "pending");
    if (testConversationId) pendingQuery = pendingQuery.neq("conversation_id", testConversationId);
    const { data: pendingReplies } = await pendingQuery;

    const { data: whatsappConnection } = await supabase
      .from("whatsapp_connections")
      .select("token_expires_at")
      .eq("business_id", business.id)
      .maybeSingle();

    const connectionHealth = describeConnectionHealth({
      connected: business.whatsappConnected,
      tokenExpiresAt: whatsappConnection?.token_expires_at ?? null,
      now,
    });

    const snapshot: AttentionSnapshot = {
      pendingReplyCount: pendingReplies?.length ?? 0,
      hasEscalatedPendingReply: (pendingReplies ?? []).some((d) => d.requires_escalation),
      connectionStatus: connectionHealth.status,
    };

    const tier = classifyAttentionTier(snapshot);
    if (tier === "none") return "skipped_no_signal";

    const { data: lastNotified } = await supabase
      .from("product_events")
      .select("created_at")
      .eq("business_id", business.id)
      .eq("event_type", "attention.notified")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const deliver = shouldDeliver({
      tier,
      now,
      lastNotifiedAt: lastNotified?.created_at ? new Date(lastNotified.created_at) : null,
      openingTime: business.openingTime,
      closingTime: business.closingTime,
      crossesQuietHours: crossesQuietHours(snapshot),
    });
    if (!deliver) return "skipped_suppressed";

    const { data: owner } = await supabase.auth.admin.getUserById(business.ownerId);
    const ownerEmail = owner?.user?.email;
    if (!ownerEmail) return "skipped_no_owner_email";

    const email = composeAttentionEmail({
      businessName: business.businessName,
      pendingReplyCount: snapshot.pendingReplyCount,
      hasEscalatedPendingReply: snapshot.hasEscalatedPendingReply,
      connectionStatus: snapshot.connectionStatus,
      appUrl,
    });

    const sent = await deliverEmail({ to: ownerEmail, subject: email.subject, text: email.text });
    if (!sent) return "failed";

    await recordProductEvent({
      eventType: "attention.notified",
      businessId: business.id,
      context: { tier, pendingReplyCount: snapshot.pendingReplyCount, escalated: snapshot.hasEscalatedPendingReply },
    });
    return "sent";
  } catch (err) {
    console.error("[attention] notifyBusiness failed:", err);
    await recordErrorEvent({
      severity: "warning",
      source: "attention.notify_failed",
      businessId: business.id,
      message: "notifyBusiness threw — this business may not have been notified about a real pending item.",
      error: err,
    });
    return "failed";
  }
}
