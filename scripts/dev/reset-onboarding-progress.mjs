// Founder review (2026-08-04) — "I already have a permanent test
// account I want to keep using... can onboarding progress for this
// one account be safely reset without affecting any other users? Can
// we log back into this account and be returned to the first
// onboarding screen repeatedly?" Researched against the actual code
// paths rather than assumed:
//
//   - `onboarding_completed` is one boolean on that account's own
//     `businesses` row (unique per owner_id) — every route that
//     decides "onboarding or dashboard" (app/page.tsx,
//     /onboarding/preparing) reads exactly this field, nothing else.
//   - Logging back in already returns you to /onboarding/preparing
//     once it's false — app/page.tsx already redirects there for any
//     signed-in user whose business isn't onboarding_completed yet.
//     No new app code needed for that part.
//   - Login never re-checks email verification (that's only ever
//     checked at signup and at WhatsApp connection) — so once an
//     account exists and is verified, every future reset-and-retry
//     cycle is a plain login, never touching the inbox at all.
//
// This is deliberately a *different*, less destructive operation than
// scripts/dev/reset-test-account.mjs: it never touches auth.users,
// never deletes anything, and only ever updates the exact columns
// /api/onboarding/prepare itself writes on ONE row, scoped by
// owner_id — the same column RLS already uses to isolate every
// business from every other. Reusing a real, permanent email
// (deliberately no "+" alias requirement here, unlike the other
// script — that guard would defeat the actual point of this one) is
// safe specifically because nothing here can affect a different
// account: the explicit email argument resolves to exactly one
// owner_id, and the update is filtered by that id alone.
//
// Standalone and human-run only, same as every other script in
// scripts/ — never wired into dev/build/deploy.
//
// Usage: node scripts/dev/reset-onboarding-progress.mjs "rmsavov1@gmail.com"

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
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

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function findUserByEmail(supabase, email) {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }
  throw new Error("Searched 50 pages of users without finding a match or reaching the end — aborting rather than guessing.");
}

// Matches the businesses table's own column defaults for a brand new
// row (supabase/migrations/0001_init.sql, 0006_replyflow_v2.sql) —
// exactly the fields /api/onboarding/prepare itself writes, nothing
// more (business_knowledge, whatsapp_connected, stripe fields etc.
// belong to later parts of the product and are deliberately untouched).
const ONBOARDING_FIELD_RESET = {
  business_name: "Your business",
  trade: "plumbing",
  service_areas: [],
  opening_time: "08:00",
  closing_time: "17:30",
  availability: {},
  onboarding_completed: false,
};

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/dev/reset-onboarding-progress.mjs "you@example.com"');
    process.exit(1);
  }

  const env = loadEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
    process.exit(1);
  }
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Target Supabase project: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`Looking up: ${email}\n`);

  const user = await findUserByEmail(supabase, email);
  if (!user) {
    console.log(
      "No account with that email yet. This script only resets onboarding\n" +
      "progress for an account that already exists — sign up once normally\n" +
      "first, then use this script for every retest after that."
    );
    return;
  }

  const { data: business, error: lookupError } = await supabase
    .from("businesses")
    .select("id, business_name, trade, onboarding_completed")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (lookupError) {
    console.error(`Business lookup failed: ${lookupError.message}`);
    process.exit(1);
  }
  if (!business) {
    console.log("Account exists but has no businesses row yet (unusual — normally created at signup). Nothing to reset; just log in and it will be created automatically.");
    return;
  }

  console.log(`Found business ${business.id}:`);
  console.log(`  business_name: ${business.business_name}`);
  console.log(`  trade: ${business.trade}`);
  console.log(`  onboarding_completed: ${business.onboarding_completed}\n`);

  if (!business.onboarding_completed) {
    console.log("onboarding_completed is already false — logging in will already return to /onboarding/preparing. Nothing to do.");
    return;
  }

  console.log("This will reset onboarding_completed to false and clear the fields onboarding");
  console.log("itself writes (business_name, trade, service_areas, hours, availability) back");
  console.log("to their defaults, on this ONE business row only. Nothing else is touched —");
  console.log("not conversations, not WhatsApp connection, not Business/Receptionist knowledge.\n");
  console.log("Note: since the account already exists, logging in lands directly on");
  console.log("/onboarding/preparing (screen 5) — it won't re-ask the three pre-account");
  console.log("questions. To retest those, visit /hire/name directly while signed out.\n");

  const confirmation = await ask(`Type the email address again to confirm: `);
  if (confirmation.trim().toLowerCase() !== email.toLowerCase()) {
    console.log("Confirmation did not match — aborted, nothing changed.");
    process.exit(1);
  }

  const { error: updateError } = await supabase
    .from("businesses")
    .update(ONBOARDING_FIELD_RESET)
    .eq("id", business.id)
    .eq("owner_id", user.id); // belt and braces — matches RLS's own scoping even though this client bypasses RLS

  if (updateError) {
    console.error(`Reset failed: ${updateError.message}`);
    process.exit(1);
  }

  console.log(`\nDone. Log in as ${email} and you'll land back on /onboarding/preparing.`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
