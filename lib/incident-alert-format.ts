/**
 * Pure formatting logic for incident-alert.ts, deliberately kept free
 * of the `server-only` guard so it can be unit-tested directly — the
 * same split used elsewhere (pricing.ts, error-events-format.ts,
 * ai-rate-limit-policy.ts).
 */
export function formatIncidentAlertText(incident: { source: string; message: string; businessId: string | null }): string {
  return [
    "🔴 ReplyFlow critical incident",
    incident.message,
    `source: ${incident.source}`,
    incident.businessId ? `business: ${incident.businessId}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
