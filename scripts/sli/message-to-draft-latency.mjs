// Master Execution Plan 0.3 — SLI: message-to-draft latency.
//
// Elapsed time between a real inbound customer message landing
// (messages.created_at) and the reply pipeline producing its draft
// (reply_drafts.created_at), joined via the existing unique
// customer_message_id key — no new instrumentation needed, both
// columns have existed since Sprint 9/10A.
//
// Excludes Test Conversations and the adversarial QA suite's synthetic
// traffic (both use the Ofcom 07700 900xxx reserved range) so this
// reflects real customer-facing latency, not internal testing.
//
// Usage: node scripts/sli/message-to-draft-latency.mjs [days]
// Requires .env.local. Read-only — safe to re-run any time.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function loadEnv() {
  const raw = fs.readFileSync(path.join(repoRoot, ".env.local"), "utf8");
  return Object.fromEntries(
    raw
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const TEST_PHONE_PREFIX = "4477009"; // Ofcom reserved-for-fiction range — never a real customer.
const days = Number(process.argv[2]) || 30;

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: drafts, error } = await supabase
    .from("reply_drafts")
    .select("customer_message_id, created_at")
    .not("customer_message_id", "is", null)
    .gte("created_at", since)
    .limit(5000);
  if (error) throw new Error(error.message);

  const messageIds = drafts.map((d) => d.customer_message_id);
  if (messageIds.length === 0) {
    console.log(`No reply_drafts in the last ${days} day(s).`);
    return;
  }

  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("id, created_at, from_number")
    .in("id", messageIds);
  if (msgError) throw new Error(msgError.message);

  const messageById = new Map(messages.map((m) => [m.id, m]));
  const deltasMs = [];

  for (const draft of drafts) {
    const message = messageById.get(draft.customer_message_id);
    if (!message) continue;
    if (message.from_number && message.from_number.startsWith(TEST_PHONE_PREFIX)) continue;
    const delta = new Date(draft.created_at).getTime() - new Date(message.created_at).getTime();
    if (delta >= 0) deltasMs.push(delta); // negative deltas would indicate a data anomaly, not a real measurement
  }

  deltasMs.sort((a, b) => a - b);
  const p50 = percentile(deltasMs, 50);
  const p95 = percentile(deltasMs, 95);
  const max = deltasMs[deltasMs.length - 1];

  console.log(`Message-to-draft latency — last ${days} day(s), real customer traffic only`);
  console.log(`Sample size: ${deltasMs.length}`);
  console.log(`p50: ${(p50 / 1000).toFixed(2)}s`);
  console.log(`p95: ${(p95 / 1000).toFixed(2)}s`);
  console.log(`max: ${(max / 1000).toFixed(2)}s`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
