// Master Execution Plan 1.1 — a plain, queryable summary of
// error_events, deliberately not a dashboard. Answers the Monitoring
// Philosophy's own questions directly: is ReplyFlow healthy, are
// failures increasing, broken down by source and severity so a real
// pattern (not a single noisy occurrence) stands out.
//
// Usage: node scripts/monitoring/error-summary.mjs [hours]
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

const hours = Number(process.argv[2]) || 24;

async function main() {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("error_events")
    .select("severity, source, business_id, message, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);

  console.log(`Error events — last ${hours}h`);
  console.log(`Total: ${rows.length}\n`);

  if (rows.length === 0) {
    console.log("Nothing recorded — either genuinely healthy, or nothing has exercised these code paths yet.");
    return;
  }

  const bySource = {};
  for (const row of rows) {
    const key = `${row.severity} — ${row.source}`;
    bySource[key] ??= { count: 0, latest: row.created_at, sample: row.message };
    bySource[key].count++;
  }

  const sortedBySeverity = Object.entries(bySource).sort(([a], [b]) => {
    const rank = { critical: 0, error: 1, warning: 2 };
    return rank[a.split(" — ")[0]] - rank[b.split(" — ")[0]];
  });

  for (const [key, s] of sortedBySeverity) {
    console.log(`${key}: ${s.count} (most recent: ${s.latest})`);
    console.log(`  e.g. "${s.sample}"`);
  }

  const criticalCount = rows.filter((r) => r.severity === "critical").length;
  if (criticalCount > 0) {
    console.log(`\n${criticalCount} critical event(s) in this window — investigate before anything else.`);
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
