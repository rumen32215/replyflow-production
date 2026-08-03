import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isEmailDeliveryConfigured } from "@/lib/attention/deliver-email";
import { notifyBusiness, type NotifyBusinessOutcome } from "@/lib/attention/notify-business";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Owner Attention Architecture (`DOCS/CONSTITUTION/14-...md`) — the
 * periodic tick behind both the "now" and "today" tiers. Deliberately
 * one shared code path for both: a business's own fresh snapshot at
 * tick time decides its tier, so there's no separate "urgent" cron and
 * "routine" cron to keep in sync — see `lib/attention/tiering.ts`.
 *
 * Auth: verified against CRON_SECRET (Vercel's own documented
 * convention — an `Authorization: Bearer <CRON_SECRET>` header sent
 * automatically once the env var and `vercel.json` schedule are both
 * set). Default is genuinely deny, same discipline as `lib/admin.ts`'s
 * `isAdminEmail()` — an unset or mismatched secret rejects, never
 * silently allows.
 *
 * A safe, cheap no-op today: RESEND_API_KEY / ATTENTION_FROM_EMAIL are
 * unset in production, so this returns "not configured" without
 * touching a single business row — activating real delivery is a
 * founder operational task, exactly like SUPPORT_EMAIL/ADMIN_EMAILS.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  if (!isEmailDeliveryConfigured()) {
    return NextResponse.json({ ok: true, configured: false, message: "Email delivery is not configured yet." });
  }

  const supabase = createServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const now = new Date();

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id, owner_id, business_name, whatsapp_connected, opening_time, closing_time")
    .eq("whatsapp_connected", true)
    .eq("notify_new_enquiry", true);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const outcomes: Record<NotifyBusinessOutcome, number> = {
    sent: 0,
    skipped_no_signal: 0,
    skipped_suppressed: 0,
    skipped_no_owner_email: 0,
    failed: 0,
  };

  for (const business of businesses ?? []) {
    const outcome = await notifyBusiness({
      supabase,
      now,
      appUrl,
      business: {
        id: business.id,
        ownerId: business.owner_id,
        businessName: business.business_name,
        whatsappConnected: business.whatsapp_connected,
        openingTime: business.opening_time,
        closingTime: business.closing_time,
      },
    });
    outcomes[outcome] += 1;
  }

  return NextResponse.json({ ok: true, configured: true, businessesChecked: businesses?.length ?? 0, outcomes });
}
