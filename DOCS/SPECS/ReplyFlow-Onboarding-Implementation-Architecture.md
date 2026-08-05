# ReplyFlow Onboarding Implementation Architecture

**The concrete "how" for the redesigned onboarding flow.** Companion to `DOCS/CONSTITUTION/15-ReplyFlow-Onboarding-Experience-Architecture.md` (the "why," now partially stale against this document — see §7) and `DOCS/CONSTITUTION/16-ReplyFlow-Employment-Philosophy.md` (frozen, permanent — every decision below exists to satisfy it, not the other way round). Unlike those two, this is a spec: expected to move as building proceeds, not permanent.

**Status: approved and frozen (2026-08-05).** All four open decisions from the original proposal are now settled — §3's three conflicts, §4's copy — and one new permanent rule was added during this review (§6). Nothing below is still open. Implementation begins from this document as written.

---

## 1. The flow

Real screens, real order, what exists on each side of the account boundary:

| Screen | Route (proposed) | Needs an account? | What she does |
|---|---|---|---|
| 1. Business name | new, pre-account (see §3.1) | No | Opens in her own voice, one question, reflects the name back specifically the moment it's valid (doc 16 §4.1–2) |
| 2. Trade | same route group | No | Auto-advances on tap (doc 16 §3.4 — no button ceremony around an already-complete decision); reflects trade-specific vocabulary back |
| 3. Service area | same route group | No | One real question (where); hours/days pre-filled with a stated, correctable default, never a three-field interrogation |
| 4. Save this | `/signup`, repositioned | Creates the account | Framed as protecting what's already been said, not a gate before it — the only screen in the flow that is unavoidably a credential form, and named honestly as the one place that's true (doc 16 §1, §10) |
| 5. Preparing | `/onboarding/preparing`, now genuinely protected | Yes | The real `POST /api/onboarding/prepare` call; facts already known settle into view while it resolves; ends with one CTA into the real handoff |
| → | `/dashboard/receptionist/meet` | Yes | Doc 04's territory, untouched |

No progress bar, no step counter (doc 16 §3.3). No "Continue" — screen 1 and 3 keep a single action button, but it states the outcome, never the word "Continue" (doc 16 §3.4); screen 2 has no button at all.

---

## 2. Doc 16 compliance, mapped explicitly

Not asserted — checked, rule by rule, against what's actually being proposed:

- **§3.1 (no institutional voice)** — the failure states on screens 1–5 are written in her voice ("that didn't quite go through — let's try that again"), never a raw error or generic toast. Applies equally to the credential screen's own real failure modes (a taken email, a weak password) — those get rewritten in her voice too, not left as Supabase's default copy.
- **§3.2 (no labeled boxes)** — one question per screen, no field captions, conversational framing throughout screens 1–3.
- **§3.3 (no step counters)** — confirmed removed. Nothing replaces it; a three-question conversation doesn't need a fraction.
- **§3.4 (no generic buttons)** — addressed per screen above.
- **§3.5 (no fabricated demos)** — already decided (doc 15 §2); the real proof conversation lives entirely in the real handoff (doc 04 §2), not duplicated here.
- **§3.8 (no document metaphors)** — "Save & exit" is retired; see §4 for the replacement.
- **§3.11 (no upgrade/version framing)** — not directly applicable to first-run onboarding, but the failure-retry copy on screen 5 is written as her trying again, not "retry request."
- **§3.12 (no scale-revealing language)** — nothing on any of these five screens references aggregate usage. Confirmed clean by construction, not by omission.
- **§4.1–2 (acknowledge, reflect facts)** — the receptionist-presence reactions from doc 15 §3, unchanged in substance, now confirmed appropriate under doc 16 §5: this *is* day one, so full acknowledgment is the correct calibration, not a violation of the decay rule. The decay rule governs the *rest of the product* over months, not this five-minute window.
- **§4.4 (proof before permission)** — she never asks for WhatsApp access or any real permission during this flow; the only thing asked for is the account itself, and that's framed honestly as what it is (§4 below).

---

## 3. Real conflicts with existing technical structure — resolved

Three were found by checking the proposal against actual code rather than assuming it would fit. All three are now decided.

### 3.1 Middleware gates all of `/onboarding/*` behind authentication — decided: Option B

`middleware.ts` redirects any unauthenticated request to `/onboarding/*` straight to `/login`. Screens 1–3 have no account yet by design.

**Decided:** move screens 1–3 into a new, already-unauthenticated route group (sibling to the existing `(auth)` group, which already contains public routes like `/signup` and `/login`), leaving `/onboarding/*`'s existing protection completely untouched. The account boundary becomes the literal boundary between route groups: nothing protected is reachable until screen 4 creates a real session. Rejected explicitly: loosening middleware to exempt specific paths — approved instead as the option that doesn't touch the trust boundary of code that already works correctly.

### 3.2 `/welcome` and the direct-session redirect already disagreed, today, before any of this was built — decided: retire `/welcome`

`signup-form.tsx` sends a session granted immediately at signup straight to `/onboarding/business-name`; only the email-verification-required path (`emailRedirectTo`'s `next=/welcome`) ever reached `/welcome`. A real, pre-existing inconsistency, not introduced by this redesign.

**Decided:** `/welcome` retires completely. Its purpose — she speaks first — merges into screen 1, which already opens in her voice before the first real question. Both entry paths land on screen 1 directly. There is no scenario left where a separate greeting screen exists before or after it.

### 3.3 Email verification — verified, not assumed: not currently live

Queried the actual Supabase project directly (`/auth/v1/settings`) rather than leaving this as a design assumption, per instruction. Result: **`mailer_autoconfirm: true`.** Every signup on this project grants an immediate session — `data.session` is never null in practice today, and the `/verify-email` path is not a live concern for this flow as it currently stands.

The fallback code path (handling a null session gracefully, resuming at screen 5 rather than re-asking screens 1–3 if verification were ever required) stays in the implementation regardless — cheap to keep, consistent with this codebase's existing discipline of never assuming a Supabase setting stays fixed forever — but it is not the primary path being designed around, and testing effort should be weighted accordingly.

---

## 4. Final copy — screens 4 and 5

"Launch ReplyFlow" is rejected outright, not softened — *launch* is what happens to software. "Let her answer," floated during review, was rejected too: correct in spirit, weak as a button (a status, not an action the owner is taking). Decided:

- **Screen 5, settled state, heading line:** *"She's ready."* — a status, not an action, exactly as strong stated plainly.
- **Screen 5, the CTA itself:** *"Let's put her to work."* — an action, phrased as something the owner and she do together, matching the trade-audience voice already established throughout this product (direct, warm, no corporate polish) rather than a solitary, software-flavoured command.
- **Screen 5, the small caption shown while the real setup call is in flight:** *"Getting to know {business name}."* — specific to this business by construction, never a generic "Setting up your receptionist."
- **Screen 4 (credentials), heading:** *"One more thing before she starts."* — honest about what this screen is (doc 16 §1's boundary: this is the one place the illusion doesn't need to hold, because nothing about account creation is pretending to be her) without resorting to document-metaphor language.
- **Screen 4, the CTA:** *"Make it official."* — avoids "Save," which reads too close to the banned document metaphor (doc 16 §3.8) despite meaning something different here; "official" ties directly to the hiring frame instead (a hire being made official is real, ordinary language, not a metaphor borrowed from software).

---

## 5. What doesn't change

Doc 04's territory — Meet Your Receptionist, Test Conversations, Shadowing — untouched, exactly as doc 15 already scoped. The five real facts collected. `buildHandoverRecap`'s readiness logic (already correctly fires the moment a service area exists, confirmed against the live code this session). The visual language — cards, gradient, `EASE`, the existing motion primitives — all reused, none reinvented.

---

## 6. One rule added during this review: the word "onboarding" is never customer-facing

Added to doc 16 §3 as permanent item 13, applied here as its first concrete instance: the word "onboarding" (or any synonym — "setup," "getting started") never appears in copy the owner reads, on any of the five screens or the handoff beyond them. It stays exactly where it already lives today — code, routes (`/onboarding/*` as a URL is fine; nobody reads a URL as a sentence), comments, this document — and nowhere else. Checked against the current codebase before writing this: every existing user-facing string already satisfies this without having been told to; the only occurrences of the word anywhere in `components/onboarding/` are identifiers, imports, routes, and comments. The implementation's job is to keep it that way through every rewritten screen, not to fix a violation that doesn't currently exist.

---

## 7. Status

All decisions closed. Doc 15 (`DOCS/CONSTITUTION/15-ReplyFlow-Onboarding-Experience-Architecture.md`) still reflects an earlier draft — its own progress bar, "Continue" buttons, and "Launch" CTA all predate this document and doc 16's final form — and needs a revision pass to stop disagreeing with what's actually being built, tracked as the first task of implementation, not a blocker to starting it.
