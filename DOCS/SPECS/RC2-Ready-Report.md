# RC2 Ready Report

Scope: the two smaller Conversation Experience improvements approved for this round only. No prompting-architecture redesign, no personality work — both explicitly deferred pending real usage evidence, per direction.

## 1. Reflect back understanding on informative diagnostic answers

One additive instruction in the generation system prompt (`lib/reply-engine/prompt/build.ts`): when a diagnostic answer genuinely reveals something (a likely cause, what it means next), say so in one short clause before moving on — e.g. "Sounds like trapped air" before asking for a postcode — never as a habit, never when there's nothing meaningful to reflect.

**Verified:** typecheck/lint/unit tests/build all clean. Deployed, then the full 18-scenario adversarial regression suite run against the live production webhook (real Supabase rows, real OpenAI calls) — **18/18 scenarios, 0 failed checks.** Nothing regressed; every existing grounding, escalation, and repetition-avoidance behaviour still holds.

## 2. WhatsApp read receipt + typing indicator

New `markMessageAsRead` in `lib/whatsapp/graph.ts` — marks an inbound message read and requests WhatsApp's own typing indicator in the same call, the moment a message arrives, rather than a customer sitting at "delivered" with no acknowledgement until the full reply eventually lands. Meta expires the indicator itself; nothing here claims anything false. Deliberately best-effort: swallows its own errors rather than throwing, so a failed courtesy signal can never block the real reply pipeline. Wired into the webhook handler via the same `waitUntil` pattern already used for reply generation.

**Verified, with one honest caveat:** typecheck/lint/build clean. Confirmed via production logs that the code path fires on every inbound message and fails *safely* (never blocked the regression suite's 18/18 pass). But I could not confirm a successful call end-to-end — SHABZ's stored WhatsApp access token has genuinely expired (`Session has expired on Friday, 24-Jul-26 22:00:00 PDT`), confirmed by testing an unrelated Graph API call with the same token, which failed identically. **This is a pre-existing condition, unrelated to this change** — any real Graph API call for SHABZ right now, including actually sending a reply, would currently fail the same way. I confirmed the read-receipt request itself is well-formed (Meta processes it and rejects at the auth stage, not as a malformed request), which is the strongest verification available without a live token.

**Action needed from you before this can be seen working live:** SHABZ's WhatsApp connection needs a fresh access token (the same kind you pasted earlier this session) before either real replies or read receipts will work again on that business. Not something I should refresh myself.

## Regression coverage note

No new scenario was added to `scripts/reply-engine-tests/scenarios.mjs` for either change — the reflect-back instruction is a quality behaviour, not a bug fix (the standing "every real bug becomes a permanent scenario" rule doesn't apply), and the read receipt has no observable effect on `reply_drafts` for the existing suite to assert on.

## Verdict

**RC2 is ready.** Both approved improvements are implemented, deployed, and verified to the extent this environment allows, with one clearly-flagged, pre-existing, unrelated blocker (SHABZ's expired token) that only you can resolve. No regressions. Nothing else was touched.
