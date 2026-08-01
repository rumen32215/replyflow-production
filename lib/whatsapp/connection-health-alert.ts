import { describeConnectionHealth } from "@/lib/front-desk-signals";
import type { ErrorSeverity } from "@/lib/error-events";

export interface ConnectionHealthAlert {
  severity: ErrorSeverity;
  source: string;
  message: string;
}

/**
 * SLI follow-up (ReplyFlow-SLIs-SLOs.md §2, "WhatsApp-disconnect
 * detection time") — turns a connection's real token_expires_at into
 * an error_events-shaped alert, or null when there's nothing worth
 * recording. Pure wrapper around the existing, already-tested
 * describeConnectionHealth() so the webhook handler (the one real
 * chokepoint every inbound message already passes through) has
 * something to call without duplicating that logic.
 *
 * The caller owns dedup and the actual write — this only decides
 * *whether* something is wrong and how urgent it is, matching every
 * other pure-logic-extraction convention in this codebase.
 */
export function buildConnectionHealthAlert(input: { tokenExpiresAt: string | null; now: Date }): ConnectionHealthAlert | null {
  const health = describeConnectionHealth({ connected: true, tokenExpiresAt: input.tokenExpiresAt, now: input.now });

  if (health.status === "expired" && health.message) {
    return { severity: "critical", source: "webhook.whatsapp_token_expired", message: health.message };
  }
  if (health.status === "expiring_soon" && health.message) {
    return { severity: "warning", source: "webhook.whatsapp_token_expiring_soon", message: health.message };
  }
  return null;
}
