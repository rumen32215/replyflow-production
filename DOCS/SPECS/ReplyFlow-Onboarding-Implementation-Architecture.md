# ReplyFlow Onboarding Implementation Architecture

**The concrete "how" for the redesigned onboarding flow.** Companion to `DOCS/CONSTITUTION/15-ReplyFlow-Onboarding-Experience-Architecture.md` (the "why") and `DOCS/CONSTITUTION/16-ReplyFlow-Employment-Philosophy.md` (frozen, permanent — every decision below exists to satisfy it, not the other way round). Unlike those two, this is a spec: expected to move as building proceeds, not permanent.

**Status: V20 revision (2026-08-05).** The V19 build (this document's previous version) shipped a route-per-question flow with correct copy that still tested as a wizard — the founder's own words after using it live: *"I never once had the feeling I've just hired someone. I simply felt like I was filling out information."* This revision changes the interaction model itself, per doc 15's own §2 reversal of its earlier "keep discrete routes" conclusion. Sections 1, 3, and 4 below are rewritten; §2, §5, §6 carry forward with updates noted inline.

---

## 1. The flow

| Moment | Where it lives | Needs an account? | What happens |
|---|---|---|---|
| Name, trade, service area | One view, one route (`/hire`) — no navigation between them | No | Three real questions inside a single continuous encounter (doc 15 §3). Each answer commits live to the store, appends a permanent line to a visible acknowledgment stack, and triggers one micro-interaction (§4). Trade auto-advances on tap; name and area keep an explicit action stating the outcome, never "Continue." |
| Account | `/signup`, a real route change | Creates the account | The one unavoidable credential form — a distinct, focused moment (password managers and autofill genuinely need this), reframed around continuity and ownership rather than security, and showing a condensed recap of what's already been learned so it reads as the same encounter continuing. |
| Preparing | `/onboarding/preparing`, protected | Yes | The real `POST /api/onboarding/prepare` call; facts already known settle into view while it resolves; ends with one CTA into the real handoff. |
| → | `/dashboard/receptionist/meet` | Yes | Doc 04's territory, untouched. |

No progress bar, no step counter, no "Continue." No pronoun assigned anywhere in this copy (doc 16 §3.14) — first person or by name.

---

## 2. Doc 16 compliance — carried forward from V19, plus what's new

Everything checked in the V19 pass (§3.1 no institutional voice, §3.2 no labeled boxes, §3.3 no step counters, §3.4 no generic buttons, §3.5 no fabricated demos, §3.8 no document metaphors, §3.11 no upgrade framing, §3.12 no scale-revealing language, §4.1–2 acknowledge and reflect facts, §4.4 proof before permission) still holds structurally — none of those constraints are affected by collapsing routes into one view. Two additions this revision:

- **§3.14 (no hardcoded pronoun)** — every "she/her" instance found in the built V19 screens (preparing-receptionist, service-area-step, signup-form) rewritten to first person or name. Checked by grep against the actual customer-facing strings, not by inspection alone.
- **§4.1, sharpened** — acknowledgment is no longer just "immediate and specific," it's now also *cumulative and visible*: each answer's acknowledgment line stays on screen as the next question appears, rather than disappearing when its screen would previously have unmounted. This is what makes "watching someone come to life" (doc 15 §0) literal rather than aspirational — the owner can see the record being built, not just trust that it happened.

---

## 3. The single-view architecture

**Route collapse.** `app/(hire)/hire/name/`, `/trade/`, `/area/` (three page routes from V19) are deleted. A single `app/(hire)/hire/page.tsx` renders one new component, `components/onboarding/hiring-conversation.tsx`, which owns local state (`step: "name" | "trade" | "area"`) and advances via `setStep()` — never `router.push()`. `(hire)/hire/layout.tsx` keeps its logo/aurora chrome but drops the per-route `AnimatePresence key={pathname}` transition, since there's only one path now. `middleware.ts` needs no changes — `/hire` falls outside its three protected prefixes exactly as `/hire/*` did.

**Retired components.** `business-name-step.tsx`, `trade-step.tsx`, `service-area-step.tsx`, and `receptionist-presence.tsx` are deleted. Their input mechanics (name validation, the trade-card grid, the area input) become internal render sections of `hiring-conversation.tsx`; `receptionist-presence.tsx`'s job (reacting to each answer) becomes local state in the same component, since its original reason for existing — surviving a route change via Next.js layout persistence — no longer applies once there's no route change to survive.

**Service area becomes a set.** `hooks/use-onboarding-store.ts`'s `serviceArea: string` becomes `serviceAreas: string[]`, with a dedicated `setServiceAreas` action matching the existing `setOpenDays` shape. The UI reuses the dashboard's own chip-editor pattern (`components/dashboard/business/business-memory.tsx`'s private `ChipEditor`, extracted to `components/shared/chip-editor.tsx` so both surfaces import the same component) rather than a free-text sentence — this also removes a real workaround: `/api/onboarding/prepare/route.ts` previously did `service_areas: serviceArea ? [serviceArea] : []`, wrapping a single string for a database column that has always been an array. The route now accepts `serviceAreas: string[]` directly.

**Hours stay collapsed by default**, same stated line as V19 ("Open weekdays, 8am till 5:30pm — tell me if that's wrong"). Disclosing now shows plain-language presets (current default / earlier start / every day / "set exact hours") before falling back to the existing day-grid-and-time-picker editor, kept only for genuinely custom schedules rather than shown immediately.

---

## 4. Micro-interactions

One shared "commit" motion, reused for every answer: the receptionist's identity mark does a brief scale-and-glow settle (built from the existing `GrowingCheck` primitive in `components/shared/motion.tsx`, not a new animation system). On mobile, the same moment fires a single `navigator.vibrate(10)`, feature-detected (`"vibrate" in navigator`) and silently absent on desktop or unsupported browsers — net-new to this codebase, deliberately minimal. Nothing else: no confetti, no progress counters, no gamification.

---

## 5. Final copy — updated for de-gendering and reframing

Carried forward from V19 where unchanged; updated where doc 16 §3.14 or the founder's account-screen note applies:

- **Preparing screen, settled state, heading line:** *"I know enough to get started."* (was "She's ready.")
- **Preparing screen, CTA:** *"Let's get to work."* (was "Let's put her to work.")
- **Preparing screen, in-flight caption:** *"Getting to know {business name}."* — unchanged, already first-person-safe.
- **Signup, heading:** *"One more thing before I start."* (was "...before she starts.")
- **Signup, subheading:** reframed from security language ("kept safe, and only ever yours") to continuity/ownership: *"So everything I've just learned stays with me, and only you can see it."*
- **Signup, CTA:** *"Make it official."* — unchanged; addressed to the owner's action, not a pronoun assignment.
- **Acknowledgment stack copy:** see doc 15 §3 for the three lines, each rewritten to explain why the fact matters, not just confirm it.

---

## 6. What doesn't change

Doc 04's territory — Meet Your Receptionist, Test Conversations, Shadowing — untouched. The five real facts collected (now: name, trade, service area**s**, hours, days). `buildHandoverRecap`'s readiness logic. The visual language — cards, gradient, `EASE`, the existing motion primitives — all reused. `/api/onboarding/prepare`'s core responsibility (create the business row) and `ensureBusinessRow`'s idempotency, unchanged beyond accepting an array for service areas directly instead of wrapping a string.

---

## 7. Status

V20 revision complete as written above. Doc 15 has been revised in parallel to match (its own §2 now documents *why* the route-per-screen conclusion was reversed, on direct evidence from testing rather than desk research). Landing-page phone-preview aliveness and a real maps/radius picker for service area were both raised during review and are explicitly out of scope for this revision — flagged as follow-up candidates, not silently dropped.
