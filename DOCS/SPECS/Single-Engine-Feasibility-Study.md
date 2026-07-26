# Single Conversation Engine — Feasibility Study

**Study only — no implementation, no Behaviour redesign, RC2 remains paused.** One question: can `buildPreviewConversation()` (the deterministic simulator) and `generateReplyForMessage()` (the real pipeline) become one engine, without losing instant responses, deterministic previews where they genuinely belong, safety, latency, or reliability?

**Answer: yes — but not by making today's instant, per-keystroke preview call the real pipeline directly.** That specific behaviour is physically incompatible with a real model call, full stop, regardless of engineering effort. What's actually achievable, and what closes the "two brains" gap completely, is narrower and more precise: **stop asking one mechanism to do two different jobs, and make sure the one that claims "this is what she'd really say" is always genuinely real.**

---

## 1. What each mechanism actually is, precisely

**`buildPreviewConversation()`** (`lib/receptionist.ts`) — synchronous, in-browser, zero-latency, zero-cost, deterministic. Recomputed on *every* render: every chip toggle, every keystroke in a notes field, because the Receptionist page's live phone preview updates continuously as the owner edits, before anything is even saved.

**`generateReplyForMessage()`** (`lib/reply-engine/generate-reply.ts`) — a real orchestrator: idempotency check → fetch a real conversation → fetch real `ai_configurations` → the Readiness Gate (requires all three receptionist topics genuinely taught) → `assembleContext()` (real DB reads) → `classifyMessage()` (one real LLM call, small tier) → `generateReplyDraft()` (one real LLM call, large tier) → `evaluateSafety()` → writes a real `reply_drafts` row. Built to run server-side, against a real, persisted conversation, with real latency (multiple seconds) and real cost (two model calls).

These were never actually the same job. One answers *"if a customer said X, what would today's saved configuration produce, right now, for free"* — a hypothetical, continuous, cheap simulation. The other answers *"given this real customer's real message in a real conversation, what does the real receptionist say"* — an expensive, real, side-effecting operation. `buildPreviewConversation` has been quietly standing in for both.

---

## 2. The part that makes unification actually feasible: the reasoning core is already decoupled from persistence

This is the concrete, checkable fact the whole answer rests on. `generateReplyDraft()` (`lib/reply-engine/prompt/generate.ts`) — the function that actually calls the model and produces reply text — takes a plain `ReplyContext` object and an `UnderstandingResult`, and returns a generated reply. It does not itself touch the database, does not check the Readiness Gate, and does not know anything about a real conversation existing. Those responsibilities belong entirely to `generateReplyForMessage()`, the orchestrator wrapped around it.

`ReplyContext` (`lib/reply-engine/context/types.ts`, populated by `assembleContext()`) is a plain data shape — `businessProfile`, `receptionist` (tone/behaviours/rules/escalation/faqs), `diary`, `customerMemory`, `conversationHistory`, `customerJobs`, `currentBooking`, `newMessage`. Every one of those fields is either directly derivable from the owner's *in-browser, not-yet-saved* teaching state, or legitimately absent for a hypothetical scenario (no real customer memory or conversation history exists yet, and the existing prompt-construction code already handles those fields being null — confirmed directly in `buildCustomerContextBlock`/`buildFactsBlock`).

This means a preview surface could construct a `ReplyContext` by hand from draft state plus a canned scenario message, and call `generateReplyDraft()` directly — the exact same prompt construction, the exact same model, the exact same instructions the real pipeline uses — without a real conversation, without the Readiness Gate, without any database write. That is a genuinely single engine: one function decides what she'd say, everywhere, always.

---

## 3. What this costs, honestly, against each UX property named

**Instant responses — partially given up, on purpose.** A real model call takes a few seconds; there's no way around that, and pretending otherwise would just recreate the same dishonesty this whole investigation exists to remove. What's actually preserved: the *continuous, per-keystroke* feedback loop doesn't need to be a fabricated conversation at all. Confirming what was just taught ("Got it — I'll mention the call-out fee before they're surprised by it") can stay instant and deterministic, because it isn't claiming to simulate a customer exchange — it's reflecting back a fact, the same honest acknowledgment pattern already used elsewhere in this product (the FAQ editor's reflect-back acks, the group-completion messages). What changes: anything that *shows an example reply* — the tone comparison, "watch this become a real conversation" — becomes a real, debounced-or-on-demand call, a few seconds of an honest "thinking" state (reusing the typing-dots pattern already built), not a live-as-you-type simulation.

**Deterministic previews where appropriate — redefined, not removed.** "Appropriate" no longer means "simulating what a customer conversation would look like" — nothing should claim that without being real. It means confirming a specific taught fact, which is a legitimately different, smaller job a deterministic function can still honestly do.

**Safety — unaffected or improved.** A preview call can run through the same Safety Layer as production (interesting for showing an owner *why* a reply would or wouldn't auto-send) or skip it entirely (it's advisory, nothing is being sent) — either is a real option, neither compromises anything, since nothing a preview generates is ever actually delivered to a customer.

**Latency — real, and needs to be named honestly in any future UI**, a few seconds for anything that shows a genuine example, never for the fact-confirmation moments.

**Reliability — a new failure mode that doesn't exist today.** The current simulator can't fail; a real model call can (timeout, API error). This needs a graceful, non-blocking fallback — advisory UI, not a hard error, matching the pattern already used for failed draft generation elsewhere in the product. Real, addressable, not a blocker.

**Cost — a genuinely new, real operating cost.** Every on-demand or debounced preview call is a real token spend during onboarding, where today it's free. Worth sizing before committing, but not a reason this is infeasible — it's a real number, not an unknown risk.

**One additional, favourable simplification specific to preview mode:** a canned scenario's *intent* doesn't change based on what's being taught — "my boiler's not heating up" is always a returning-problem enquiry, regardless of tone or rules. The Understanding classification step could be precomputed once per scenario rather than re-run on every preview call, cutting the real cost to one model call (Generation) instead of two.

---

## 4. Answering the question directly

**Can ReplyFlow move to a single conversation engine without compromising onboarding? Yes.**

Not by forcing the continuous, instant, per-keystroke preview to become a real model call — that would be a genuine regression, and isn't necessary anyway. By recognising that today's simulator was doing two jobs, keeping the one that's legitimately cheap and deterministic (confirming a taught fact) exactly as fast as it is today, and routing the other one (showing what she'd actually say) through the real reasoning core — `generateReplyDraft()`, already decoupled from persistence — via a new, lightweight, DB-free invocation path that hands it a hand-built `ReplyContext` instead of one assembled from a real conversation.

**Engineering size:** small–medium. The hard part — a reasoning core that doesn't require a real conversation to run — already exists; it just isn't exposed for this use yet. The net-new work is a thin server route that builds a `ReplyContext` from draft state and calls `generateReplyDraft()` directly, plus deciding, case by case, which existing "simulated conversation" moments become real (debounced/on-demand) versus which become an honest fact-confirmation instead of a simulated exchange.

---

## 5. What this study is deliberately not deciding

Not which specific moments on the Behaviour page become real-but-delayed versus honest-acknowledgment-and-instant — that's the Behaviour redesign this study was explicitly asked not to do. Not whether or when to build it — that's a separate decision, same as the coaching proposal. This only answers the narrower, prior question: is a single engine physically and architecturally achievable without sacrificing what today's split was built to protect. It is.

RC2 resumes at **M8a**, then **M11**, once this and the coaching direction are decided.
