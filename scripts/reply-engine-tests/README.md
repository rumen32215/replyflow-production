# Reply Engine adversarial regression suite

Drives the real production webhook (real signature, real Supabase rows, real
OpenAI calls) with adversarial and edge-case conversations, and asserts on
the actual behaviour — not a mocked-LLM unit test, because the bugs this
suite exists to catch live in what the model actually does with the prompt,
not in isolated deterministic logic.

## Running it

```
node scripts/reply-engine-tests/run.mjs                # run every scenario
node scripts/reply-engine-tests/run.mjs "sarcasm"       # filter by name substring
```

Requires `.env.local` pointed at the target environment (`WHATSAPP_APP_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`) and a real WhatsApp
connection + configured business there. Costs real OpenAI calls and takes
several minutes — run it before/after real reply-engine changes, not on
every commit. Test conversations are cleaned up automatically at the end of
a run (phone numbers in the Ofcom fictional range, `07700 900xxx`).

## The rule

Every real bug found through adversarial testing gets added to
`scenarios.mjs` permanently, not just fixed and forgotten — that's the
point of this suite existing as a checked-in file rather than another
throwaway script. Three of the current scenarios are named `REGRESSION —`
for exactly this reason.
