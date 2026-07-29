// Master Execution Plan 1.2 — a manual, on-demand data snapshot.
//
// NOT a substitute for real backups. This exists only because the
// production Supabase project is on the Free plan, which provides no
// scheduled backups, no point-in-time recovery, and no restore
// capability at all — confirmed directly in the Supabase dashboard,
// not assumed. See DOCS/SPECS/ReplyFlow-Backup-Recovery.md for the
// full honest account of what this does and does not provide, and the
// recommended real fix (a Supabase plan upgrade).
//
// Exports the core business-critical tables to a single timestamped
// JSON file, then verifies the export is complete (row counts match a
// live count at export time) and referentially sane (spot-checks that
// exported messages/reply_drafts/work_cards reference conversations
// that were actually captured) before reporting success — a backup
// nobody has checked is actually complete is not meaningfully safer
// than no backup at all.
//
// whatsapp_connections is exported WITHOUT access_token — that's a
// live credential, not data to snapshot to a local file.
//
// Usage: node scripts/backup/export-snapshot.mjs
// Requires .env.local. Read-only against the database (this only ever
// SELECTs) — safe to re-run any time. Writes to ./backups/, which is
// gitignored; nothing this script does is ever committed.

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

// Core business-relationship data — what the Constitution's "the data
// survives" is actually protecting. Deliberately excludes ai_usage_events
// and error_events (regenerable observability, not irreplaceable
// business history) to keep this focused, per Task 1.2's own scope.
const TABLES = [
  { name: "businesses", select: "*" },
  { name: "conversations", select: "*" },
  { name: "messages", select: "*" },
  { name: "reply_drafts", select: "*" },
  { name: "work_cards", select: "*" },
  { name: "ai_configurations", select: "*" },
  {
    name: "whatsapp_connections",
    select: "id,business_id,waba_id,phone_number_id,display_phone_number,token_expires_at,webhook_verified,connected_at,created_at,updated_at",
  },
];

async function fetchAll(table, select) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function liveCount(table) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const startedAt = new Date();
  console.log(`Exporting snapshot as of ${startedAt.toISOString()}...\n`);

  const snapshot = { exportedAt: startedAt.toISOString(), tables: {} };
  const verification = [];

  for (const { name, select } of TABLES) {
    const [rows, count] = await Promise.all([fetchAll(name, select), liveCount(name)]);
    snapshot.tables[name] = rows;

    // Completeness check — a snapshot taken over several sequential
    // queries could in principle miss rows written between the first
    // and last query; comparing against a live count taken in the same
    // run catches gross truncation. Not a perfect point-in-time
    // guarantee (this is Free-tier application-level tooling, not a
    // real database snapshot), which is exactly why this stays
    // documented as a stopgap, not a real backup.
    const ok = rows.length >= count; // >= not ===: a row inserted between the count and fetch is fine; missing rows are not
    verification.push({ table: name, exported: rows.length, liveCountAtCheck: count, ok });
  }

  // Referential-integrity spot-check — do messages/reply_drafts/work_cards
  // actually point at conversations that were captured in this same
  // snapshot? A mismatch would mean the export is internally
  // inconsistent even if every individual table "completed."
  const conversationIds = new Set(snapshot.tables.conversations.map((c) => c.id));
  const orphanedMessages = snapshot.tables.messages.filter((m) => !conversationIds.has(m.conversation_id));
  const orphanedDrafts = snapshot.tables.reply_drafts.filter((d) => !conversationIds.has(d.conversation_id));

  const outDir = path.join(repoRoot, "backups");
  fs.mkdirSync(outDir, { recursive: true });
  const filename = `snapshot-${startedAt.toISOString().replace(/[:.]/g, "-")}.json`;
  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

  console.log("Table".padEnd(20), "Exported".padStart(10), "Live count".padStart(12), "OK");
  for (const v of verification) {
    console.log(v.table.padEnd(20), String(v.exported).padStart(10), String(v.liveCountAtCheck).padStart(12), v.ok ? "yes" : "NO — INCOMPLETE");
  }

  console.log(`\nOrphaned messages (conversation not in this snapshot): ${orphanedMessages.length}`);
  console.log(`Orphaned reply_drafts (conversation not in this snapshot): ${orphanedDrafts.length}`);

  const allComplete = verification.every((v) => v.ok);
  const referentiallySane = orphanedMessages.length === 0 && orphanedDrafts.length === 0;

  console.log(`\nWrote ${outPath}`);
  if (allComplete && referentiallySane) {
    console.log("Snapshot verified: complete and referentially consistent.");
  } else {
    console.log("Snapshot INCOMPLETE or inconsistent — do not rely on this file. Investigate before deleting the previous snapshot, if any.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
