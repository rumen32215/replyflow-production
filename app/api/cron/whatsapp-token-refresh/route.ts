import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { refreshLongLivedToken, WhatsAppAuthError } from "@/lib/whatsapp/graph";
import { markConnectionRevoked } from "@/lib/whatsapp/connection-revoke";
import { recordErrorEvent } from "@/lib/error-events";

export const runtime = "nodejs";
export const maxDuration = 60;

// Days ahead of expiry to attempt a refresh — deliberately wider than
// front-desk-signals.ts's own 3-day "expiring_soon" warning window, so
// a healthy connection refreshes itself well before an owner would
// ever see that warning. Meta's long-lived-token exchange
// (fb_exchange_token) only works on a token that hasn't expired yet,
// which is the whole reason this runs proactively rather than
// reactively.
const REFRESH_WINDOW_DAYS = 7;

/**
 * WhatsApp Token Health (Phase A — Production Foundation). Same
 * CRON_SECRET auth convention as app/api/cron/attention/route.ts —
 * default deny, an unset or mismatched secret rejects, never silently
 * allows.
 *
 * Only ever touches connections with a known expiry inside the refresh
 * window and no existing revoke — a connection with no token_expires_at
 * at all (a token Meta issued as effectively non-expiring) has nothing
 * to refresh, matching describeConnectionHealth's own "no known expiry
 * is fine" semantics.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const refreshBy = new Date(Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: connections, error } = await supabase
    .from("whatsapp_connections")
    .select("id, business_id, access_token, token_expires_at")
    .is("revoked_at", null)
    .not("token_expires_at", "is", null)
    .lte("token_expires_at", refreshBy);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let refreshed = 0;
  let revoked = 0;
  let failed = 0;

  for (const connection of connections ?? []) {
    try {
      const result = await refreshLongLivedToken(connection.access_token);
      await supabase
        .from("whatsapp_connections")
        .update({
          access_token: result.access_token,
          token_expires_at: result.expires_in ? new Date(Date.now() + result.expires_in * 1000).toISOString() : null,
        })
        .eq("id", connection.id);
      refreshed += 1;
    } catch (err) {
      if (err instanceof WhatsAppAuthError) {
        await markConnectionRevoked(supabase, connection.business_id, "cron.whatsapp_token_refresh_auth_error");
        revoked += 1;
      } else {
        // Transient (network, rate limit, Meta-side hiccup) — not a
        // confirmed revoke, so leave the connection as-is and try
        // again on tomorrow's tick rather than guessing.
        console.error("[whatsapp token refresh] failed for connection", connection.id, err);
        await recordErrorEvent({
          severity: "warning",
          source: "cron.whatsapp_token_refresh_failed",
          businessId: connection.business_id,
          message: "Scheduled WhatsApp token refresh failed — will retry on the next run.",
          error: err,
        });
        failed += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, checked: connections?.length ?? 0, refreshed, revoked, failed });
}
