import "server-only";
import { formatIncidentAlertText } from "./incident-alert-format";

/**
 * Master Execution Plan 1.3 — active alerting for critical incidents,
 * closing the gap 1.1 deliberately left open ("this does not yet
 * produce an alert"). Deliberately the simplest real mechanism: a
 * generic webhook POST, not a vendor SDK — no new account is needed to
 * write or deploy this, only to eventually point it somewhere real.
 * Works unmodified with Slack or Discord incoming webhooks (both
 * accept `{"text": "..."}`), or any custom endpoint that accepts JSON.
 *
 * Inert by design until INCIDENT_ALERT_WEBHOOK_URL is set — no channel
 * exists yet, so this honestly does nothing in production today rather
 * than simulating a delivery that isn't real. See
 * DOCS/SPECS/ReplyFlow-Incident-Response.md for what's needed to
 * activate it.
 *
 * Called from lib/error-events.ts's one chokepoint, not from each
 * individual call site — every current and future `critical` event
 * gets alerting for free, matching the "one instrumented chokepoint"
 * discipline already used for ai_usage_events (0.1) and error_events
 * itself (1.1).
 */
export interface CriticalIncident {
  source: string;
  message: string;
  businessId: string | null;
}

export async function notifyCriticalIncident(incident: CriticalIncident): Promise<void> {
  const webhookUrl = process.env.INCIDENT_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return; // no channel configured — honestly inert, not simulated

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: formatIncidentAlertText(incident) }),
    });
  } catch (err) {
    // A failed notification must never compound the incident it's
    // reporting — same discipline as recordErrorEvent itself.
    console.error("[incident-alert] failed to send notification:", err);
  }
}
