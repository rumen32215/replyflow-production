# V1 First-Run Completion Report

Implements `DOCS/SPECS/ReplyFlow-V1-First-Run-Proposal.md` as one cohesive product refinement — the full account-creation-to-WhatsApp journey redesigned around the six stated product decisions. Deployed, regression tested, and verified against real production data.

---

## Every screen removed, merged, or resequenced — and why

### Removed

- **`/dashboard/business`** (Business Profile) — no longer a destination. Redirects to `/dashboard/receptionist`, forwarding `?topic=` so every existing deep link still lands on the right field.
- **`/dashboard/everything-i-know`** (Knowledge dashboard) — no longer a destination. Redirects to `/dashboard/receptionist`. Its real job (confidence and gaps) was already duplicated inline on both Business and Receptionist ("Where things stand," "How well I know your style") — a separate confidence dashboard is redundant once there's only one teaching surface to have confidence about.
- **`components/dashboard/knowledge-tabs.tsx`** — the Overview/Facts/Behavior tab strip. Its own doc comment already called it *"the rename-not-rewrite version... no routes moved, no data-fetching changed"* — a deliberate half-measure at the time. Deleted, not just unused.
- **`components/dashboard/everything-i-know/*`** (four components) and **`lib/everything-i-know-signals.ts`** — deleted outright, not relocated. Two of the four (recent-changes timestamps, customer counts) were genuinely non-duplicated content, removed on a direct application of Principle 6 ("every screen should either increase confidence or help run the business — if it does neither, question whether it belongs"). Neither clearly did either; customer counts belong more naturally on the Customers page if that's ever revisited.
- **"Your business" as a Quick Action** — removed from Front Desk's four quick actions, since it now points at the same destination as "Receptionist." Replaced with "Test your receptionist," a genuinely distinct, newly-important destination in the redesigned journey.
- **Trade selection's "Other" option** — removed for new signups. Existing businesses on any of the previously-supported eight trades are completely unaffected.

### Merged

- **Business Profile + Receptionist + Everything I Know → "Teach your receptionist"** (`/dashboard/receptionist`). One route, one scroll, no tab-switching. Internally, `BusinessMemory` and `ReceptionistPlayground` remain the two components they always were — same save logic, same data-loss defence (RC1), same live coaching engine (C1–C6) — composed together on one page rather than reachable as separate destinations. Per instruction, internal separation is an implementation detail the owner never sees; only headers, tab navigation, and page boundaries were removed.
- **Primary nav's "Knowledge" entry → "Receptionist"** — same position in the sidebar and bottom tab bar, repointed to the merged page, icon changed from Brain to Headset to match.

### Resequenced

- **Onboarding**: business name → trade (5 options) → **service area (new)** → **opening days & hours (new)** → preparing. Three genuinely new fields — confirmed against the actual current implementation that none of these were previously collected in onboarding; they defaulted silently (`08:00`–`17:30`, empty service areas) and were only ever asked later, deep in Business Profile.
- **Preparing → Meet Your Receptionist** (was → Front Desk). The one-minute setup's entire premise is that she already knows enough to say something real the instant it finishes; landing on Front Desk first delayed that moment for no reason.
- **Meet Your Receptionist's readiness floor**: dropped from "all Business Knowledge and all three Receptionist topics taught" to "a service area exists" — always true the instant onboarding completes. Test Conversations' own Readiness Gate is completely unchanged; its existing honest "not ready" fallback (never touched by this change) is what keeps an early Test attempt safe, not this recap's bar.
- **WhatsApp's Proof-Before-Ask gate** (RC2-M1): re-pointed from `handover_confirmed_at` (no longer a meaningful proof signal once Meet is thin and early) to a real, freshly-derived signal — at least one genuine `reply_drafts` row against the reserved test conversation. Never written for the honest "not ready" fallback, only for an actually-generated reply. Still only guards the *unconnected* path; an already-connected business is never affected.
- **Front Desk's Setup Journey**: reordered Meet → Teach → Test → Connect WhatsApp, matching the new sequence exactly.

---

## What did not change

No new personality data shape. No correction/learning-loop data model. No new database columns beyond three onboarding fields (`service_areas`, `opening_time`/`closing_time`, `availability`) written into columns that already existed. Every safety guarantee, escalation category, and fact-grounding rule is inherited unchanged from the one real reply engine — itself completely untouched by this refinement. `BusinessMemory` and `ReceptionistPlayground`'s internal save logic, debouncing, and data-loss defence are byte-for-byte the same code, just composed on one page instead of two.

---

## Regression testing performed

1. **Full typecheck/lint/unit tests/build** — clean at every stage, including after the one fix below (64 tests passing throughout).
2. **Adversarial regression suite**, run twice (before and after the journey-gate fix) — **18/18 scenarios, 0 failed checks** both times, confirming the reply engine's real production behaviour is completely unaffected by any part of this change.
3. **Full fresh-account journey**, real mobile viewport (430×932), end to end: signup → onboarding (5-trade restriction confirmed, no "Other") → service area → hours → preparing → lands on Meet (confirmed: real recap using only the 5 setup facts, mentions the real service area, shows the confirm prompt) → confirm handover → Test Conversations *before* teaching correctly shows the honest "not ready" message (the safety net holds) → WhatsApp correctly redirects away → Teach page confirmed to show *both* Receptionist and Business content on one scroll, no leftover tab strip → taught behaviours/rules/escalation via real chip taps → Test Conversations *after* teaching now produces a real reply → WhatsApp now reachable. Every stage passed.
4. **Real production data**: every currently-connected business (one — SHABZ) verified against the new Teach page (loads with real data, no console errors), Front Desk (loads correctly), and WhatsApp (stays connected, never redirected).

## One real bug found during real-data verification, and fixed

SHABZ — live, connected, handover-confirmed since before "test" existed as a tracked step — had its actual Test Conversations activity reset at some point (the reserved test conversation's row didn't exist). The new "test" step's honest done-check correctly read false, but nothing exempted it the way "meet" already exempts pre-existing businesses, so Front Desk briefly showed the setup checklist to a mature, fully operational business. Fixed: `journeyComplete` now also short-circuits true whenever `whatsappConnected` is true — a real, connected number is the strongest possible proof a business already finished onboarding under whatever rules applied at the time, and must never be retroactively re-locked behind a step introduced afterwards. Re-verified clean after the fix.

---

## Would a busy plumber understand this in under a minute?

Held against every screen in this change:

- **One-minute setup**: five short, single-purpose screens, each answering exactly one question. Yes.
- **Meet Your Receptionist**: a short recap of five real facts, one honest question ("Have I understood you correctly?"). Yes.
- **Teach your receptionist**: one continuous scroll, progressive disclosure (one section open at a time), each section's own plain-language question. This is the largest, most information-dense screen in the journey — still answerable in under a minute per section, though the page as a whole is a multi-minute activity by design (it's teaching, not a single decision).
- **Test your receptionist**: type a message or tap a real scenario, read a real reply. Yes.
- **Connect WhatsApp**: one button, reached only once it's earned. Yes.

---

## Status

**Complete, deployed, and verified.** Stopping here per instruction. RC2 remains paused at M8a, then M11, ready to resume once this is reviewed.
