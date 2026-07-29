# ReplyFlow Data Practices Audit

**Master Execution Plan 1.6.** Its own text is explicit that the actual deliverable — *"a reviewed, published privacy policy and ToS"* — needs a qualified legal reviewer, not engineering time. That remains true, and **this document is not that deliverable.** It's the honest, factual prerequisite a reviewer needs before they can write one: *"a qualified legal review of how customer conversation data is collected, processed by a third-party AI provider, retained, and deleted"* has never been answerable, anywhere, until the collecting/processing/retaining/deleting itself was written down in one place. This document is that write-down — traced directly against the real schema and code (`supabase/migrations/*.sql`, `lib/reply-engine/`, `app/api/`), never assumed. **Success criteria is not met by this document** — no policy is drafted here, no legal conclusion is reached, and "reviewed, published" still requires the reviewer this task has always depended on.

---

## 1. What's collected, and where it lives

Everything below is in Supabase Postgres, one row per business (`owner_id = auth.uid()`), RLS-scoped — see `ReplyFlow-Security-Access-Baseline.md` (1.4) for the access-control detail, not repeated here.

| Table | What it holds | Whose data |
|---|---|---|
| `businesses` | Owner's business name, phone, trade, hours, service areas, logo, description, services, callout-fee policy, diary rules, taught business knowledge (personality, declined jobs, guarantees, payment methods, certifications, parking/access notes, emergency notes) | The business owner (ReplyFlow's customer) |
| `whatsapp_connections` | WABA/phone number IDs, and a live plaintext WhatsApp Graph API `access_token` | The business owner's WhatsApp Business credential |
| `conversations` | End customer's phone number, name (from WhatsApp's own contact profile), status, last message preview, an owner-entered communication preference | The business owner's customer (a real member of the public) |
| `messages` | Full inbound/outbound message text, direction, WhatsApp message ID, timestamps | The business owner's customer — this is the actual conversation content |
| `reply_drafts` | AI-drafted reply text, intent/confidence, which taught facts were used, escalation reason | AI-authored, but reflects the customer's message |
| `work_cards` | Job/issue description, address, collected details (parking/access notes volunteered mid-conversation), AI-drafted conversation summary | Mix of owner-entered and customer-volunteered |
| `ai_configurations` | Owner-authored tone, rules, FAQs | The business owner only |
| `ai_usage_events` | Token counts, cost, model, call site | No message content |
| `error_events` | Opaque IDs, error strings, route names — **verified by design never to include message or reply content** (`lib/error-events.ts`'s `context` type is restricted to primitives specifically to prevent this) | No customer content |

**The customer-identifying, conversation-content-bearing tables are `conversations` and `messages`.** Everything else is either the business owner's own data or AI/operational metadata.

---

## 2. Third parties that see real customer data

**OpenAI** (the third-party AI provider named in this task's own objective) — reached only through one chokepoint, `lib/reply-engine/llm/client.ts`. **Nothing is redacted or anonymized before sending.** Two real API calls per customer message:
- **Classification** (`understanding/classify.ts`): the raw new message text, plus recent conversation history (both directions, verbatim).
- **Reply generation** (`prompt/build.ts`): the business's operational facts, the customer relationship summary, recent conversation history verbatim, and **the customer's name or phone number** alongside the new message text.

OpenAI genuinely receives customer PII (name/phone) and full message content, per real customer message, with no anonymization step anywhere in the pipeline.

**Meta (WhatsApp Cloud API)** — the transport for every message in both directions. Inbound messages arrive via Meta's webhook (signature-verified) with message body, sender's number, and WhatsApp's own contact profile name; outbound replies are sent back through Meta's Graph API using the business's `access_token`. Meta's own platform sees every message.

**Supabase** — hosts the database, plus Supabase Auth (owner emails/credentials) and Storage (a **publicly readable** bucket for uploaded business logos — no customer data in it).

**Vercel** — hosts the application and its API routes; holds the service-role key (which bypasses RLS entirely) in its environment variables. Vercel's own function logs are outside this codebase's control, though nothing in the webhook/classification code path deliberately logs message content to them.

**Confirmed absent:** no analytics, tracking, email, or SMS service of any kind is integrated anywhere in the codebase (verified against `package.json` and a repo-wide script-tag search) — no additional subprocessor beyond the four above touches real customer data today.

---

## 3. Retention

**No automatic retention or expiry policy exists anywhere in the codebase** — confirmed by a repo-wide search for any scheduled purge/cron job; none exists. Every `conversations`/`messages`/`reply_drafts` row persists indefinitely until the owning business itself is deleted.

The one manual backup tool that exists (`scripts/backup/export-snapshot.mjs`, 1.2) deliberately excludes `whatsapp_connections.access_token` (a live credential) and the two purely-operational tables (`ai_usage_events`, `error_events` — "regenerable observability, not irreplaceable business history," per its own comment) from any snapshot, but includes customer names, phone numbers, and full message bodies as-is in any snapshot file it produces. Those snapshot files, once created, are not tracked or automatically deleted by anything in this codebase — see `ReplyFlow-Backup-Recovery.md` for its own honest "no retention policy" statement about the snapshots themselves.

---

## 4. Deletion

`app/api/account/delete/route.ts` deletes the business's own row, which **cascades** (via `on delete cascade` foreign keys, present on every content table) through `conversations`, `messages`, `reply_drafts`, `work_cards`, `ai_configurations`, `ai_usage_events`, `error_events`, and `whatsapp_connections` — including the `access_token` and all message content — then deletes the Supabase Auth user itself.

**What this does not, and cannot, reach:**
- Any local snapshot file already produced by the manual backup tool — this codebase has no knowledge of files sitting outside its own database.
- Anything already sent to OpenAI or Meta in past API calls — deletion there, if it happens at all, is governed entirely by those providers' own retention policies; no deletion/redaction request to either provider exists anywhere in this codebase.

---

## 5. What this document deliberately does not do

This is a factual trace of the real system, not a legal instrument. It does not, and should not be read to:
- State a lawful basis for processing, under UK GDPR or otherwise.
- Confirm whether Data Processing Agreements exist with OpenAI or Meta, or whether international-transfer safeguards are in place — these are real open questions a reviewer needs to answer, not assumed here either way.
- Describe a data-subject-rights process (access, correction, erasure requests) beyond the one real technical capability that exists today (full account deletion, §4).
- Draft any actual privacy policy or terms-of-service language.

**Task 1.6's success criteria — "a reviewed, published privacy policy and ToS exist" — remains unmet.** What this closes is the honest prerequisite: a reviewer now has an accurate, current account of what the system actually does, rather than starting from nothing.
