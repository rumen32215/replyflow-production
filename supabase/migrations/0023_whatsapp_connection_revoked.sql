-- ReplyFlow — 0023: WhatsApp connection revoke detection (Phase A —
-- Production Foundation)
--
-- describeConnectionHealth() (lib/front-desk-signals.ts) already
-- distinguishes connected / expiring_soon / expired / not_connected
-- purely from token_expires_at — but nothing before this could tell
-- "the token hasn't expired yet" apart from "Meta has actually revoked
-- our access" (a real OAuth error code 190 on a real Graph API call),
-- which silently looked identical to a healthy connection.
--
-- revoked_at is set the moment that's actually observed (send /
-- mark-as-read / the token-refresh cron — see
-- lib/whatsapp/connection-health-alert.ts's markConnectionRevoked) and
-- takes precedence over the expiry-based statuses once set. Never
-- cleared automatically — reconnecting creates a fresh row via
-- app/api/whatsapp/connect's upsert, which is the correct "this is
-- healthy again" signal.

alter table public.whatsapp_connections
  add column if not exists revoked_at timestamptz;

grant select (revoked_at) on public.whatsapp_connections to authenticated;

notify pgrst, 'reload schema';
