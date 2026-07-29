# AI Model Router — Insights Log

**Not a design document.** Per explicit founder instruction alongside Master Execution Plan 0.2: no AI Model Router gets designed or built yet. This is a running log of real observations surfaced from production telemetry (`ai_usage_events`, shipped in 0.1) while implementing 0.2, kept so a future Model Router gets designed from evidence rather than assumptions. Add to it opportunistically as more real data accumulates; don't let it drift into a design doc on its own.

---

## Observations from 0.2's implementation and verification (2026-07-29)

**Both model tiers are currently the same model.** `.env.example` defaults `OPENAI_MODEL_SMALL` and `OPENAI_MODEL_LARGE` to `gpt-4o-mini` — already flagged as a finding in `ReplyFlow-Constitution-Compliance-Roadmap.md` L1. Real telemetry confirms this has a real, measurable consequence: sampled real calls average **$0.000417/call** for `understanding.classify` (the "small" tier) versus **$0.000419/call** for `prompt.generate` (the "large" tier) — statistically indistinguishable, because there is currently no real cost difference between the two tiers to route around. A Model Router has nothing to route to yet; that's a prerequisite decision (does a genuinely cheaper model get introduced for one tier?), not something this task should presume.

**Classification isn't obviously the "lighter" call.** In the same sample, `understanding.classify` averaged **2,298 input tokens**, `prompt.generate` averaged **2,494** — close enough that "small tier = small prompt" isn't a safe assumption to design a router against. Both calls carry a comparable amount of context today.

**A real, concrete router candidate surfaced: tone-preview calls.** The Receptionist teaching page (`receptionist-playground.tsx`) fires one *main* live-reply call plus **three tone-example calls** (friendly/professional/concise) on every debounced taught change — all at the same "large" tier as the real reply the owner will actually approve. The three tone examples exist purely to let the owner compare tone side by side; the accuracy/quality bar for "an illustrative example" is arguably lower than for "the reply that's about to be sent to a real customer." If a genuinely cheaper/faster tier is ever introduced, these three calls are a concrete, low-risk place to route to it first — nothing about a customer-facing reply's correctness depends on them. This is an observation, not a recommendation to act on yet.

**Latency is not currently measured.** `ai_usage_events` captures tokens and estimated cost (0.1's scope) but not call duration. A future Model Router will need to weigh latency against cost and quality per tier — that tradeoff can't be evaluated on real data until latency is actually captured. **Recommendation for whoever scopes the Model Router task:** add a duration column to `ai_usage_events` (or a sibling table) and let it collect real data for a period before designing thresholds, rather than guessing at "cheap tier feels slow" without evidence.

**Current real cost is not yet a pressing concern.** Real observed spend across this task's verification (~122 real calls, a mix of the 0.1 regression run and 0.2's own smoke test) totalled roughly **$0.05**. At today's volume, the case for a Model Router is about *quality/speed tuning per call type*, not urgent cost pressure — worth keeping in mind so the eventual router is designed to serve the right goal, not a false one.

---

## Observations from 0.4's tier-consolidation investigation (2026-07-29)

**The tier abstraction is exactly the plumbing a router will need — this is the finding, not a side note.** 0.4 asked "should the small/large tier split be consolidated away, since both resolve to the same model?" The investigation's answer was no (see the Master Execution Plan's 0.4 entry for the full reasoning) — and the reason why is directly relevant here: `ModelTier`, the per-call-site `tier` argument already threaded through `classify.ts`/`generate.ts`, and the env-var-based model mapping in `providers/openai.ts` are already a complete, working routing seam. A future Model Router doesn't need new plumbing to attach to — it needs (a) a real second model worth routing to, and (b) evidence about where it's safe to send traffic. Both are still missing; the wiring isn't.

**Confirmed with full telemetry, not a sample: every real call ever recorded used the same model.** All 122 `ai_usage_events` rows since 0.1 shipped show exactly one distinct `model` value (`gpt-4o-mini`), regardless of `tier`. This isn't a "some calls differ" situation — the two tiers have never once actually diverged in production. Whatever a router eventually optimises for, it's optimising from a genuine blank slate, not adjusting an existing imbalance.

**A concrete gap for router design, surfaced by trying to reason about the tone-preview candidate again:** to know whether the three tone-example calls (or any other call site) could safely move to a cheaper model, a router needs to compare *outcome quality* between models — but `ai_usage_events` has no link to `reply_drafts.confidence`/`requires_escalation`, and tone-preview calls aren't persisted as drafts at all (they're preview-only, never saved). There's currently no way to answer "would a cheaper model have produced an equally good reply here" from data — only cost/token data exists, not quality data. **Recommendation for whoever scopes the Model Router:** decide how outcome quality gets measured per call (even a lightweight signal — e.g. whether a human later edited/rejected a draft that came from a given model) before designing routing rules, not after.

---

## When to pick this back up

Per the founder's own framing: when a real milestone is reached (meaningful production volume, or a concrete quality/latency/cost problem observed in the wild), design the Model Router from `ai_usage_events` data at that point, and add it to `DOCS/SPECS/ReplyFlow-Master-Execution-Plan.md` as a new, explicitly-scoped task — citing the real numbers gathered here plus whatever's accumulated since.
