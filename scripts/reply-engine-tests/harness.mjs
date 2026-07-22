// Reply Engine adversarial regression suite — the harness.
//
// This drives the REAL production webhook (real signature, real Supabase
// rows, real OpenAI calls) rather than importing reply-engine functions
// directly, because the bugs worth catching here live in what the model
// actually does with the prompt, not in isolated deterministic logic —
// a mocked-LLM unit test would not have caught any of the real bugs this
// suite was built to prevent (see scenarios.mjs for the running list).
//
// Requires .env.local (WHATSAPP_APP_SECRET, SUPABASE_SERVICE_ROLE_KEY,
// NEXT_PUBLIC_SUPABASE_URL) and a real WhatsApp connection + configured
// business in the target environment. Run with `node scripts/reply-engine-tests/run.mjs`.
//
// Every draft lookup is keyed on the exact customer_message_id, never on
// "the latest draft since timestamp X" — earlier ad-hoc test scripts in
// this project used timestamp-window polling and it produced real,
// confusing false readings whenever two turns' background processing
// overlapped even slightly. This harness exists specifically so that
// class of bug can never recur here.

import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
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
export const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const WEBHOOK_URL = env.QA_WEBHOOK_URL || "https://replyflow-production.vercel.app/api/webhooks/whatsapp";
const PHONE_NUMBER_ID = env.QA_PHONE_NUMBER_ID || "1181767535019359";
export const BUSINESS_ID = env.QA_BUSINESS_ID || "fa01c62e-9083-4616-879d-b07b86d90b83";
const APP_SECRET = env.WHATSAPP_APP_SECRET;

// The UK's reserved-for-fiction number range (Ofcom 07700 900xxx) — never
// a real subscriber, safe to "message" even if a send attempt fires.
const TEST_PHONE_PREFIX = "4477009";

let counter = 0;
function nextWaId() {
  counter += 1;
  return `wamid.SUITE${Date.now()}.${counter}.${Math.random().toString(36).slice(2, 8)}`;
}

function sign(rawBody) {
  return "sha256=" + createHmac("sha256", APP_SECRET).update(rawBody, "utf8").digest("hex");
}

async function postWebhook({ from, name, text, waId }) {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "test-entry",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: PHONE_NUMBER_ID },
              contacts: [{ profile: { name }, wa_id: from }],
              messages: [
                { from, id: waId, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } },
              ],
            },
          },
        ],
      },
    ],
  };
  const raw = JSON.stringify(payload);
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": sign(raw) },
    body: raw,
  });
  return { status: res.status, body: await res.text() };
}

async function findMessageRow(waId) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data } = await supabase.from("messages").select("id").eq("whatsapp_message_id", waId).maybeSingle();
    if (data) return data.id;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

async function findDraft(customerMessageId) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data } = await supabase
      .from("reply_drafts")
      .select(
        "id, draft_text, intent, understanding_confidence, confidence, category, requires_escalation, escalation_reason, facts_used, would_auto_send, safety_reasons, status"
      )
      .eq("customer_message_id", customerMessageId)
      .maybeSingle();
    if (data) return data;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

async function getConversation(customerPhone) {
  const { data } = await supabase
    .from("conversations")
    .select("id, status, ai_state")
    .eq("business_id", BUSINESS_ID)
    .eq("customer_phone", customerPhone)
    .maybeSingle();
  return data;
}

/**
 * Sends one customer message and returns { draft, state, conversationId }
 * once the exact draft for THIS message (identified by its own
 * whatsapp_message_id -> messages.id -> reply_drafts.customer_message_id
 * chain) exists — never a timestamp-window guess.
 */
export async function turn(from, name, text) {
  const waId = nextWaId();
  const send = await postWebhook({ from, name, text, waId });
  if (send.status !== 200) throw new Error(`webhook POST failed: ${send.status} ${send.body}`);

  const messageId = await findMessageRow(waId);
  if (!messageId) throw new Error(`message row never appeared for waId ${waId}`);

  const draft = await findDraft(messageId);
  const convo = await getConversation(from);

  return { draft, state: convo?.ai_state ?? null, conversationId: convo?.id ?? null, customerText: text };
}

/** One scenario is a named sequence of turns, each with assertions run
 * against that turn's result. Assertions receive the turn result plus
 * an accumulating array of all prior results in this scenario, so later
 * turns can check things like "did an earlier turn's fact get honoured." */
export async function runScenario(name, from, steps) {
  const results = [];
  const failures = [];
  console.log(`\n============================================================`);
  console.log(`SCENARIO: ${name}`);
  console.log(`============================================================`);

  for (const step of steps) {
    // setupOnly steps never send a customer message at all — they only
    // run a direct DB action (e.g. inserting a pre-existing job) against
    // the conversation the previous turn already established. An
    // earlier version of this harness sent every step's `text` as a
    // real webhook message even for setup steps, polluting the
    // conversation with a spurious extra customer message — fixed here.
    if (step.setupOnly) {
      const conversationId = results[results.length - 1]?.conversationId;
      console.log(`\n[${step.label}] (setup only, no message sent)`);
      if (step.setup) {
        await step.setup({ supabase, BUSINESS_ID, conversationId, results });
      }
      continue;
    }

    let result;
    try {
      result = await turn(from, "QA Suite", step.text);
    } catch (err) {
      failures.push({ scenario: name, step: step.label, error: `turn() threw: ${err.message}` });
      console.log(`\n[${step.label}] Customer: "${step.text}"`);
      console.log(`  ERROR: ${err.message}`);
      continue;
    }
    results.push(result);
    console.log(`\n[${step.label}] Customer: "${step.text}"`);
    if (result.draft) {
      console.log(`  Reply [${result.draft.status}/${result.draft.category}]: "${result.draft.draft_text}"`);
    } else {
      console.log(`  Reply: (no draft found within poll window)`);
    }

    if (step.setup) {
      await step.setup({ supabase, BUSINESS_ID, conversationId: result.conversationId, results });
    }

    if (step.expect) {
      const checks = step.expect({ result, results, state: result.state });
      for (const check of checks) {
        if (check.pass) {
          console.log(`  PASS: ${check.description}`);
        } else {
          console.log(`  FAIL: ${check.description}`);
          failures.push({ scenario: name, step: step.label, description: check.description, detail: check.detail });
        }
      }
    }
  }

  return { name, failures, results };
}

export async function cleanupTestData() {
  const { data: convos } = await supabase
    .from("conversations")
    .select("id")
    .eq("business_id", BUSINESS_ID)
    .like("customer_phone", `${TEST_PHONE_PREFIX}%`);
  const ids = (convos ?? []).map((c) => c.id);
  if (ids.length === 0) return 0;
  await supabase.from("reply_drafts").delete().in("conversation_id", ids);
  await supabase.from("jobs").delete().in("conversation_id", ids);
  await supabase.from("messages").delete().in("conversation_id", ids);
  await supabase.from("conversations").delete().in("id", ids);
  return ids.length;
}

export { TEST_PHONE_PREFIX };
