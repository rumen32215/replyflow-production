import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { recordErrorEvent } from "@/lib/error-events";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Records a real, observed revoke (Graph API error code 190 — see
 * WhatsAppAuthError in lib/whatsapp/graph.ts) the first time it's
 * seen. Idempotent by design: once revoked_at is set, later calls are
 * a no-op rather than repeatedly overwriting "when this was first
 * detected" or spamming error_events. Called from the few real places
 * a stored access_token is actually used against the Graph API — never
 * inferred from anything else.
 *
 * Deliberately its own file, not part of connection-health-alert.ts:
 * that module stays pure (no Supabase, no I/O) so its own tests can
 * import it directly under plain `node --test`, matching every other
 * lib/*.ts pure-logic convention here. This one is real I/O and
 * belongs behind the same "server-only" guard as recordErrorEvent.
 */
export async function markConnectionRevoked(supabase: ServiceClient, businessId: string, source: string): Promise<void> {
  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("id, revoked_at")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!connection || connection.revoked_at) return;

  await supabase.from("whatsapp_connections").update({ revoked_at: new Date().toISOString() }).eq("id", connection.id);

  await recordErrorEvent({
    severity: "critical",
    source,
    businessId,
    message:
      "Meta reported this business's WhatsApp access token as invalid or revoked (OAuth error 190) — the connection needs to be reconnected.",
  });
}
