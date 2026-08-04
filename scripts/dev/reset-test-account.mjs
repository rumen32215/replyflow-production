// V17 founder review (2026-08-04) — "research the cleanest engineering
// approach that allows onboarding to be developed and tested rapidly
// without requiring a new email address every time... do not simply
// remove authentication." Confirmed directly with the founder: local
// development currently points at the SAME Supabase project as
// production (no separate dev project exists yet). That fact ruled
// out the two most obvious fixes — no code change here (or anywhere
// in the app) touches how authentication works, and this script does
// not, and must never, run automatically as part of `next dev` or any
// build/deploy step. It is a standalone, human-run tool, same
// category as scripts/backup/export-snapshot.mjs.
//
// What this actually does: deletes ONE auth user by email (via the
// service-role admin API), which cascades to their `businesses` row
// for free (`owner_id references auth.users(id) on delete cascade`,
// confirmed in supabase/migrations/0001_init.sql) — so a developer can
// sign up with the exact same email/password over and over while
// testing the onboarding flow, instead of needing a fresh address
// every run.
//
// This does NOT solve the "leave ReplyFlow to check your inbox" part
// of the brief — that's genuinely a Supabase project setting
// ("Authentication -> Providers -> Email -> Confirm email"), not
// something a script or app code should toggle, and it must never be
// switched off on the shared project this repo currently points at
// (that would let real customers skip email verification too). The
// safe fix for that half is creating a separate, free Supabase
// project for local development and pointing .env.local at it — then
// "Confirm email" can be switched off there alone, with zero effect on
// production. See the founder-facing writeup for the exact steps;
// this script is useful either way (a shared project today, or a
// dedicated dev project later) since reusing one email is valuable
// regardless of the verification setting.
//
// Safety, because this runs against whatever project .env.local
// currently points at, which today IS production:
//   1. Requires an explicit email argument — no default, no "reset
//      everything" mode exists.
//   2. Refuses any email that doesn't contain "+" — plus-addressing
//      (test+onboarding@you.com) is the universal convention for a
//      disposable/test variant; a genuine customer signup essentially
//      never looks like this, so it's a real (if not perfect) guard
//      against fat-fingering a real account.
//   3. Prints the target Supabase URL and the resolved account before
//      doing anything, and requires typing the account's email back
//      to confirm — not just "y" — so this can never be muscle-memory
//      confirmed without actually reading what's about to happen.
//   4. Read-only (listUsers) until the moment of explicit confirmation;
//      the only mutating call in the whole script is the single
//      deleteUser at the end.
//
// Usage: node scripts/dev/reset-test-account.mjs "you+onboarding-test@example.com"

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
    if (data.users.length < perPage) return null; // last page, not found
  }
  throw new Error("Searched 50 pages of users without finding a match or reaching the end — aborting rather than guessing.");
}

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: node scripts/dev/reset-test-account.mjs \"you+onboarding-test@example.com\"");
    process.exit(1);
  }
  if (!email.includes("+")) {
    console.error(
      "Refusing: this email doesn't look like a test alias (no \"+\" in the local part).\n" +
      "Use plus-addressing, e.g. you+onboarding-test@example.com — this is the one\n" +
      "guard standing between this script and a real customer account, given local\n" +
      "development currently points at the same Supabase project as production."
    );
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
    console.log("No user found with that email — nothing to reset. (This is not an error: it's exactly the state you want before a first signup.)");
    return;
  }

  console.log(`Found user ${user.id}, created ${user.created_at}.`);
  console.log("This will permanently delete this auth user and (via cascade) their businesses row.\n");

  const confirmation = await ask(`Type the email address again to confirm deletion: `);
  if (confirmation.trim().toLowerCase() !== email.toLowerCase()) {
    console.log("Confirmation did not match — aborted, nothing deleted.");
    process.exit(1);
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error(`Delete failed: ${deleteError.message}`);
    process.exit(1);
  }

  console.log(`\nDone. ${email} is free to sign up with again.`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
