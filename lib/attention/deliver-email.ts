import "server-only";

/**
 * The one real channel implementation reaches for first (doc 14 §6),
 * kept deliberately swappable: nothing outside this file knows an
 * email is involved at all — `notify-business.ts` calls `deliverEmail`
 * with a plain `{to, subject, text}`, exactly the shape a future
 * interrupt-capable channel's own adapter would also accept.
 *
 * A raw REST call via `fetch`, not the `resend` SDK — same minimal-
 * dependency choice `lib/incident-alert.ts` already made for its own
 * webhook ("a generic webhook POST, not a vendor SDK"). Resend's API
 * is a single JSON POST; a whole SDK isn't needed for one call site.
 *
 * Inert by design until RESEND_API_KEY and ATTENTION_FROM_EMAIL are
 * both set — honestly does nothing in production today rather than
 * simulating a delivery that isn't real, the same convention
 * SUPPORT_EMAIL/ADMIN_EMAILS/INCIDENT_ALERT_WEBHOOK_URL already use.
 */
export interface AttentionEmailDelivery {
  to: string;
  subject: string;
  text: string;
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.ATTENTION_FROM_EMAIL);
}

export async function deliverEmail(delivery: AttentionEmailDelivery): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ATTENTION_FROM_EMAIL;
  if (!apiKey || !from) return false; // no channel configured — honestly inert, not simulated

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: delivery.to, subject: delivery.subject, text: delivery.text }),
    });
    return response.ok;
  } catch (err) {
    // A failed notification must never compound the situation it's
    // reporting — same discipline as lib/incident-alert.ts.
    console.error("[attention] failed to deliver email:", err);
    return false;
  }
}
