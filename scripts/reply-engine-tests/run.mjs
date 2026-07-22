// Runs every scenario in scenarios.mjs against the real production Reply
// Engine pipeline, prints a pass/fail summary, and cleans up test data
// afterward. Usage:
//
//   node scripts/reply-engine-tests/run.mjs           # run everything
//   node scripts/reply-engine-tests/run.mjs "Sarcastic"  # filter by name substring
//
// Requires .env.local pointing at the target environment. Costs real
// OpenAI API calls — this is a deliberate trade-off (see harness.mjs) so
// it should be run before/after real reply-engine changes, not on every
// commit.

import { runScenario, cleanupTestData } from "./harness.mjs";
import { scenarios, freshPhone } from "./scenarios.mjs";

const filter = process.argv[2];
const toRun = filter ? scenarios.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase())) : scenarios;

if (toRun.length === 0) {
  console.log(`No scenarios matched "${filter}".`);
  process.exit(1);
}

console.log(`Running ${toRun.length} scenario(s)${filter ? ` matching "${filter}"` : ""}...`);

const allFailures = [];
for (const scenario of toRun) {
  const outcome = await runScenario(scenario.name, freshPhone(), scenario.steps);
  allFailures.push(...outcome.failures);
}

console.log(`\n\n============================================================`);
console.log(`SUMMARY: ${toRun.length} scenario(s), ${allFailures.length} failed check(s)`);
console.log(`============================================================`);
if (allFailures.length > 0) {
  for (const f of allFailures) {
    console.log(`\nFAIL — ${f.scenario} / ${f.step}`);
    console.log(`  ${f.description ?? f.error}`);
    if (f.detail) console.log(`  detail: ${f.detail}`);
  }
}

const cleaned = await cleanupTestData();
console.log(`\nCleaned up ${cleaned} test conversation(s).`);

process.exit(allFailures.length > 0 ? 1 : 0);
