// Master Execution Plan 0.3 — SLI: reply-engine "silent drop" rate.
//
// generateReplyForMessage's outer catch (lib/reply-engine/generate-reply.ts)
// logs and swallows any uncaught error rather than throwing, by design —
// but that means a total pipeline failure leaves no reply_drafts row at
// all, indistinguishable at a glance from "nothing happened yet." This
// measures exactly that: real inbound customer messages, for businesses
// that are ready to act alone today, with zero corresponding
// reply_drafts row.
//
// Caveat, stated plainly rather than hidden: "ready today" uses each
// business's CURRENT ai_configurations state, not its state at the
// historical moment the message arrived (that isn't versioned). For a
// business that has been ready for a while — true for real production
// traffic — this is an honest approximation, not an exact retroactive
// truth. Good enough for an initial SLO baseline; not good enough to
// silently upgrade into a precise historical audit without saying so.
//
// This does NOT capture a classify()/generateReplyDraft() call that
// errored but still produced a low-confidence/escalated draft — that
// path already degrades gracefully by design (see classify.ts/
// generate.ts's own catch blocks) and is currently indistinguishable
// from a genuinely low-confidence real message. Flagged as a real gap
// in the accompanying SLI/SLO document, not solved here.
//
// Usage: node scripts/sli/silent-drop-rate.mjs [days]
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

async function main() {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // "Ready to act alone" mirrors generate-reply.ts's own Readiness Gate:
  // all three teaching fields non-empty.
  const { data: configs, error: configError } = await supabase
    .from("ai_configurations")
    .select("business_id, system_prompt, business_rules, escalation_rules");
  if (configError) throw new Error(configError.message);

  const readyBusinessIds = new Set(
    configs
      .filter((c) => c.system_prompt?.trim() && c.business_rules?.trim() && c.escalation_rules?.trim())
      .map((c) => c.business_id)
  );
  if (readyBusinessIds.size === 0) {
    console.log("No businesses are currently ready to act alone — nothing to measure yet.");
    return;
  }

  const { data: inbound, error: msgError } = await supabase
    .from("messages")
    .select("id, business_id, from_number, created_at")
    .eq("direction", "inbound")
    .gte("created_at", since)
    .limit(5000);
  if (msgError) throw new Error(msgError.message);

  const realInbound = inbound.filter(
    (m) => readyBusinessIds.has(m.business_id) && !(m.from_number && m.from_number.startsWith(TEST_PHONE_PREFIX))
  );
  if (realInbound.length === 0) {
    console.log(`No real inbound messages for ready businesses in the last ${days} day(s).`);
    return;
  }

  const { data: drafts, error: draftError } = await supabase
    .from("reply_drafts")
    .select("customer_message_id")
    .in(
      "customer_message_id",
      realInbound.map((m) => m.id)
    );
  if (draftError) throw new Error(draftError.message);

  const messageIdsWithDrafts = new Set(drafts.map((d) => d.customer_message_id));
  const dropped = realInbound.filter((m) => !messageIdsWithDrafts.has(m.id));

  console.log(`Silent drop rate — last ${days} day(s), real customer traffic, ready businesses only`);
  console.log(`Real inbound messages: ${realInbound.length}`);
  console.log(`With no reply_drafts row at all: ${dropped.length}`);
  console.log(`Rate: ${((dropped.length / realInbound.length) * 100).toFixed(2)}%`);
  if (dropped.length > 0) {
    console.log(`Dropped message ids (for manual investigation):`, dropped.map((m) => m.id));
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
