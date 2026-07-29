# ReplyFlow Customer Support Workflow

**Master Execution Plan 1.5.** Constitution: *"ReplyFlow will never leave a business owner wondering whether their business is being looked after. Whether the answer is action, advice or reassurance, the owner should always feel supported"* (`00-Founder-Constitution.md`, Product Promise). Operations Blueprint §5: *"Zero support tooling or channel exists today. No support email, no help widget, no way for a real owner to reach a real person"* — confirmed still true by direct investigation before writing this document, not assumed.

This is a short, written workflow — not a helpdesk platform. Blueprint §5 is explicit that the MVP bar is low: *"doesn't need to be a full helpdesk platform yet; a well-organised shared inbox is enough at this stage."*

---

## Honest current state

**No real, monitored inbox exists yet, and this document cannot create one.** A support channel is a real commitment — an actual address, and a real person actually checking it — not something engineering can stand up unilaterally, the same honest wall Task 1.2 (backup/recovery, blocked on a Supabase plan the founder hasn't upgraded) and Task 1.6 (privacy/ToS review, blocked on a qualified reviewer) already hit. **Success criteria "a real inbox exists, is monitored" is not met by this task**, stated plainly rather than rounded away.

What *is* built, so that turning the channel on is a one-line configuration step rather than further engineering once a real address is chosen:

- A `SUPPORT_EMAIL` environment variable (`.env.example`), unset by default.
- A "Get help" section on `/dashboard/settings` (`app/(dashboard)/dashboard/settings/page.tsx`) that renders a `mailto:` link to that address — **only when `SUPPORT_EMAIL` is actually set.** It stays absent otherwise, deliberately: showing a support surface nobody's watching would be a claim with no backing, the opposite of the Product Promise this task exists to serve.

**To activate:** set `SUPPORT_EMAIL` to a real address the founder is genuinely checking — a plain existing inbox (the founder's own email, or a new alias forwarding to it) satisfies Blueprint §5's "well-organised shared inbox is enough at this stage" bar. No new tooling required. Once set, the Settings section appears automatically on the next deploy — no further code change.

---

## Response-time expectation

Blueprint §5 asks for *"an honest, even informal, response-time expectation… stated to early customers rather than left unsaid."* Recommended, not unilaterally fixed as fact: **within one business day, usually sooner** — realistic for a single-founder, pilot-stage product, and the exact wording already used in the Settings "Get help" copy. Adjust directly in `app/(dashboard)/dashboard/settings/page.tsx` if the founder wants a different commitment; this is a business decision, this document only proposes a defensible default.

---

## Runbook — the two most likely failure modes

### 1. "The AI said something wrong"

An owner reports the receptionist told a customer something inaccurate — a wrong price, a service claim that isn't true, a policy that isn't real. Unlike a pipeline failure (`reply-engine.classify_failed`/`generate_failed`, already covered by `ReplyFlow-Incident-Response.md`'s severity table), this is a reply that was *delivered successfully* but is *substantively wrong* — nothing in `error_events` will ever surface this on its own; it only surfaces because the owner tells us.

1. **Get the specifics.** Which conversation, roughly when, what was said. `error-summary.mjs` won't help here — go straight to `conversations`/`messages` for that business.
2. **Read the real transcript**, not just the one message in isolation — `components/dashboard/conversations/conversation-story.tsx`'s `factSourceSummary` pattern (the same one that already explains "why she said that" to the owner in-product) is the right lens: find the `reply_drafts` row, check `facts_used` against what was actually taught (`business_knowledge`, `ai_configurations`).
3. **Classify what actually went wrong** — this determines the fix, and matters more than how upset the report sounds:
   - **A taught fact was ignored or misapplied** (e.g. the call-out fee amount was taught but the reply quoted something else, or omitted it) — a real reply-engine defect. Escalate to a code fix; add the exact scenario to `scripts/reply-engine-tests/scenarios.mjs` per the adversarial-suite discipline (`07-Engineering-Principles.md` §5) so it can never silently regress.
   - **Nothing was ever taught on this topic**, so the receptionist fell back to something generic or declined to answer — not a defect; the honest fix is teaching the fact (`/dashboard/receptionist?topic=...`), not a code change.
   - **The fact was taught correctly and the reply reflected it accurately**, and the disagreement is the owner wanting to change their own answer — not a bug at all; direct them to update the teaching, nothing to escalate.
4. **Tell the owner plainly**, reusing `ReplyFlow-Incident-Response.md`'s general template and its "no invented cause before it's known" discipline — the same voice standard applies to a wrong-reply report as to a system outage.
5. **Postmortem, only if it was a real defect** — same habit as `ReplyFlow-Incident-Response.md` §"Postmortem habit": what happened, why, who was told, and (for a reply-engine bug specifically) the new permanent scenario is the concrete "what changes as a result."

### 2. "My WhatsApp connection broke"

Already fully specified — reuse `ReplyFlow-Incident-Response.md` directly rather than duplicating it here: its severity table already classifies this as **customer-visible outage**, and its walkthrough (§"Walkthrough against a real incident") already worked through this exact failure mode against real production data (the QA business's stale token, first surfaced by `error-summary.mjs`). The owner-communication template it provides is written specifically for this scenario and is ready to use as-is.

---

## Dry runs (required before calling this workflow complete)

**Failure mode 2 (broken WhatsApp) — already satisfied.** `ReplyFlow-Incident-Response.md`'s own required walkthrough *is* a dry run of this exact scenario, performed against a real incident rather than an invented one. Not repeated here — cited, per this document's own "don't duplicate what 1.3 already built" principle.

**Failure mode 1 (wrong AI reply) — walked through here, since no equivalent existed anywhere yet.** A constructed scenario, grounded in SHABZ's real, actual taught data (not a fabricated business) — clearly a dry run, not a real incident:

> **Scenario:** SHABZ's owner emails asking why the receptionist told a customer "there's no call-out fee for emergency visits," when SHABZ genuinely charges one.
>
> 1. **Specifics gathered** (step 1): which customer, roughly when — the owner names the conversation.
> 2. **Transcript read** (step 2): the linked `reply_drafts` row's `facts_used` is checked against `business_knowledge`/`ai_configurations` for this business.
> 3. **Classified** (step 3): two real possibilities this runbook has to actually distinguish, not collapse into one:
>    - If `chargesCalloutFee` was genuinely taught as `true` with a real amount, and the reply nonetheless said there's no fee — that's the **taught-fact-ignored** case: a real defect, escalated to a scenario in `scripts/reply-engine-tests/scenarios.mjs` (a customer asking about a taught call-out fee, asserting the reply states it correctly — directly extends the suite's existing payment-grounding coverage, `lib/reply-engine/*.test.ts`'s "a payment question that correctly cites the taught fact passes" scenario family).
>    - If `chargesCalloutFee` was never actually set (still `null`/unconfirmed) — that's the **nothing taught yet** case: not a defect; the honest reply-engine behaviour for an untaught fact is to avoid inventing one, so the real fix is teaching it, not a code change.
> 4. **Owner told**, per the template in `ReplyFlow-Incident-Response.md`, once which of the two above is actually true — never before.
> 5. **Postmortem**, only in the first branch — the second branch closes with the owner teaching the fact, nothing further to record.
>
> This dry run confirms the runbook's step 3 branching is the genuinely load-bearing decision — the same customer report reads as either a real bug or a non-issue depending on what was actually taught, and the runbook forces checking that before reacting to either branch.

---

## What this task did and did not close

- **Built:** the `SUPPORT_EMAIL`-gated Settings surface, a recommended response-time expectation, and a complete two-failure-mode runbook — one entirely new (wrong AI reply), one correctly reused rather than duplicated (broken WhatsApp, already in `ReplyFlow-Incident-Response.md`). Both dry-run per success criteria.
- **Not closed, honestly:** a real, monitored inbox — that step needs the founder to designate and commit to checking a real address; setting `SUPPORT_EMAIL` is the entire remaining step once that decision is made.
