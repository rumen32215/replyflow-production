// Master Execution Plan 3.2 — usage analytics summary.
//
// Deliberately not a single monolithic query: some facts genuinely
// needed a new events table (product_events — draft edited, an
// owner's explicit approve distinct from auto-send, and the first
// real onboarding-wizard completion, none of which had a queryable
// trace anywhere before this task); others already have a real,
// dedicated timestamp on an existing table and don't need a duplicate
// event — escalation frequency (reply_drafts.requires_escalation) and
// Work Card lifecycle (work_cards.created_at/approved_at/completed_at)
// are both derived directly here, matching the same house style
// already used in scripts/sli/*.mjs: prefer deriving from existing
// columns over adding a new sink, only add one when the fact genuinely
// isn't captured anywhere yet. See
// DOCS/SPECS/ReplyFlow-Usage-Analytics.md for the full reasoning.
//
// Usage: node scripts/analytics/usage-summary.mjs [days]
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

const days = Number(process.argv[2]) || 30;

function count(rows) {
  return rows?.length ?? 0;
}

async function main() {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  console.log(`Usage analytics summary — last ${days} day(s)\n`);

  // --- New product_events (draft approved/edited/rejected, onboarding signup completed) ---
  const { data: events, error: eventsError } = await supabase
    .from("product_events")
    .select("event_type")
    .gte("created_at", since)
    .limit(20000);
  if (eventsError) throw new Error(eventsError.message);

  const byType = new Map();
  for (const e of events ?? []) byType.set(e.event_type, (byType.get(e.event_type) ?? 0) + 1);

  console.log("Product events (new, first captured by Master Execution Plan 3.2):");
  if (byType.size === 0) {
    console.log("  None yet in this window.");
  } else {
    for (const [type, n] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${n}`);
    }
  }
  const approved = byType.get("draft.approved") ?? 0;
  const edited = byType.get("draft.edited") ?? 0;
  const rejected = byType.get("draft.rejected") ?? 0;
  const resolved = approved + edited + rejected;
  if (resolved > 0) {
    console.log(
      `  Approve/edit/reject ratio: ${((approved / resolved) * 100).toFixed(0)}% / ${((edited / resolved) * 100).toFixed(0)}% / ${((rejected / resolved) * 100).toFixed(0)}%` +
        " (edit is counted independently — a draft can be edited and then approved or rejected)"
    );
  }

  // --- Escalation frequency (derived — already real columns on reply_drafts) ---
  const { data: drafts, error: draftsError } = await supabase
    .from("reply_drafts")
    .select("requires_escalation")
    .gte("created_at", since)
    .limit(20000);
  if (draftsError) throw new Error(draftsError.message);

  const totalDrafts = count(drafts);
  const escalated = (drafts ?? []).filter((d) => d.requires_escalation).length;
  console.log("\nEscalation frequency (derived from reply_drafts.requires_escalation):");
  console.log(`  Total drafts: ${totalDrafts}`);
  console.log(`  Escalated: ${escalated}`);
  console.log(`  Rate: ${totalDrafts > 0 ? ((escalated / totalDrafts) * 100).toFixed(2) : "0.00"}%`);

  // --- Work Card lifecycle (derived — already real timestamp columns) ---
  const { data: cards, error: cardsError } = await supabase
    .from("work_cards")
    .select("status, created_at, approved_at, completed_at")
    .gte("created_at", since)
    .limit(20000);
  if (cardsError) throw new Error(cardsError.message);

  const totalCards = count(cards);
  const booked = (cards ?? []).filter((c) => c.approved_at).length;
  const completed = (cards ?? []).filter((c) => c.completed_at).length;
  console.log("\nWork Card lifecycle (derived from work_cards.created_at/approved_at/completed_at):");
  console.log(`  Created: ${totalCards}`);
  console.log(`  Booked (approved_at set): ${booked}`);
  console.log(`  Completed: ${completed}`);

  console.log(
    "\nNote: onboarding-wizard drop-off between individual screens (business name / trade / service area) has no" +
      " per-step timestamp anywhere yet — only the final onboarding.signup_completed moment is captured. A real," +
      " named remaining gap, not measured here — see DOCS/SPECS/ReplyFlow-Usage-Analytics.md."
  );
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
