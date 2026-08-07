import type { ConnectionHealthStatus } from "@/lib/front-desk-signals";

/**
 * Owner Attention Architecture §0's permanent principle, applied to
 * wording: every line here names a real, specific piece of
 * responsibility ("2 replies waiting for your OK"), never a vague
 * activity ping ("something happened"). Pure and deterministic — no
 * templating engine, no I/O; the delivery layer decides *whether* to
 * send (tiering.ts, delivery-decision.ts), this only decides *what it
 * says* once that's already been decided.
 */

export interface AttentionCopyInput {
  businessName: string;
  pendingReplyCount: number;
  hasEscalatedPendingReply: boolean;
  connectionStatus: ConnectionHealthStatus;
  appUrl: string;
}

export interface AttentionEmail {
  subject: string;
  text: string;
}

function headline(input: AttentionCopyInput): string {
  if (input.connectionStatus === "revoked") {
    return "Your WhatsApp connection was disconnected — customers may not be reaching you";
  }
  if (input.connectionStatus === "expired") {
    return "Your WhatsApp connection has expired — customers may not be reaching you";
  }
  if (input.hasEscalatedPendingReply) {
    return input.pendingReplyCount > 1
      ? `${input.pendingReplyCount} replies waiting for your OK — one of them is urgent`
      : "A reply is waiting for your OK — it's urgent";
  }
  if (input.connectionStatus === "expiring_soon") {
    return "Your WhatsApp connection expires soon";
  }
  return input.pendingReplyCount > 1 ? `${input.pendingReplyCount} replies waiting for your OK` : "A reply is waiting for your OK";
}

/**
 * Deliberately plain text, not an HTML template — at pilot scale, the
 * words are what matters, and a plain-text email reads reliably in
 * every mail client without the added surface of a template renderer.
 * Revisit only once real usage asks for it (same "earns its place"
 * discipline the Pilot Plan already applies everywhere else).
 */
export function composeAttentionEmail(input: AttentionCopyInput): AttentionEmail {
  const line = headline(input);
  const link = `${input.appUrl}/dashboard`;

  return {
    subject: `ReplyFlow — ${line}`,
    text: `Hi,\n\n${line}.\n\nOpen ReplyFlow to take a look: ${link}\n\n— ReplyFlow`,
  };
}
