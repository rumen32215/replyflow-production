-- ReplyFlow — 0018: Column-level privileges on whatsapp_connections
-- (Master Execution Plan 1.4)
--
-- Found during the 1.4 security/access audit: migration 0003 granted
-- `select` on the whole whatsapp_connections table to `authenticated`,
-- which technically includes access_token — a real, live WhatsApp
-- Graph API credential, in plaintext. No current code path actually
-- selects it client-side (both dashboard pages that read this table
-- select an explicit safe column list, verified directly), but RLS
-- alone was the only thing standing between an authenticated owner's
-- own browser session and their own raw API credential — one future
-- `select("*")` away from a real credential leak to client JS. The
-- Constitution's own principle applies here even though it was
-- written about model prompts, not database grants: "defence in
-- depth, not a single point of failure" (07-Engineering-Principles.md
-- §7).
--
-- Postgres column-level privileges close this at the same layer RLS
-- already operates at — no application code changes needed, since the
-- correct code was already avoiding this column; this makes doing the
-- wrong thing by accident impossible instead of merely unlikely.
-- access_token remains fully readable via the service-role key (which
-- bypasses grants entirely), unaffected — every real read of it
-- already happens server-side (lib/reply-engine/send.ts,
-- app/api/webhooks/whatsapp/route.ts, app/api/whatsapp/connect/route.ts).

revoke select on public.whatsapp_connections from authenticated;

grant select (
  id,
  business_id,
  waba_id,
  phone_number_id,
  display_phone_number,
  token_expires_at,
  webhook_verified,
  connected_at,
  created_at,
  updated_at
) on public.whatsapp_connections to authenticated;

notify pgrst, 'reload schema';
