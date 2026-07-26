# ReplyFlow V1 First-Run Experience — Product Proposal

**Proposal only — no implementation until agreed.** The account-creation-to-WhatsApp journey, redesigned around one question: does this step make the owner feel like they're hiring a receptionist, or filling in software? Every decision below is checked against the five principles as stated, in this order of authority when they conflict: confidence > receptionist-not-software > simplicity > premium feel > everything else. A screen that feels beautiful but doesn't build confidence has failed. A screen that's honest but ugly still needs fixing — but never at confidence's expense.

---

## 0. What already exists and is being built on, not discarded

Six things shipped earlier in this engagement are load-bearing for this proposal and are reused, not redesigned:

- **The real, single reasoning engine** (`lib/reply-engine/live-reply.ts` + `generateReplyForMessage`) — genuinely one brain already, proven across Test Conversations, the coaching preview, and real WhatsApp. Every "she replies" moment in this proposal calls this, never a second system.
- **Meet Your Receptionist's honest-recap pattern and The Promise** (`03-Trust-Experience.md` §2–3) — the actual words she says, reused, not rewritten.
- **Test Conversations** (`/dashboard/receptionist/try`) — already real, already adversarial-friendly ("Try to break me"), already excludes itself from Front Desk/Conversations.
- **The WhatsApp Proof-Before-Ask gate** (RC2-M1) — connecting WhatsApp already can't happen before proof exists; this proposal changes *what counts as proof*, not whether the gate exists.
- **The coaching mechanism** (C1–C6) — a real reply, debounced, with an honest thinking state, reacting to a scenario. This is the mechanism "Teach" and "Test" both run on.
- **The existing `KnowledgeTabs` strip** (Overview / Facts / Behavior) — its own doc comment already calls it *"the rename-not-rewrite version... no routes moved, no data-fetching changed."* That was a deliberate half-measure at the time. This proposal is its completion, not a new idea.

---

## 1. The journey, end to end

| Step | What it is | Gate to enter | Gate to leave |
|---|---|---|---|
| 1. Account | Sign up, verify email | — | Real, verified session |
| 2. One-minute setup | Business name, trade, service area, hours | Verified session | Five real answers, nothing more |
| 3. Meet your receptionist | A brief, honest introduction using exactly what's known so far | Setup complete | Owner acknowledges her |
| 4. Teach your receptionist | One continuous surface, not three pages | Met her | Owner decides she knows enough to test — never forced, always revisitable |
| 5. Test your receptionist | Real adversarial conversations, real engine | Reachable any time after Teach opens | At least one genuine exchange completed |
| 6. Connect WhatsApp | Proof-before-ask, now gated on Test, not just Meet | A real Test exchange has happened | Real number connected |
| 7. Run the business | Front Desk, Conversations, Customers | WhatsApp connected (or skipped, by choice) | — (ongoing) |

The single structural change this table implies, stated once so it isn't buried: **Meet moves earlier and gets thinner. Test moves later and becomes the real proof gate.** Today, one moment (`handover_confirmed_at`) does both jobs — introduction and proof. This proposal splits them, because the new sequence needs two different signals at two different times. Detailed in §3.

---

## 2. Step by step, with the reasoning

### Step 1 — Account
Already close to the bar. Signup and `verify-email` are already minimal, honest, and undecorated. No redesign proposed here — flagged so it isn't silently skipped, not because it needs work.

### Step 2 — One-minute setup

**Five fields, confirmed against what's collected today:** business name and trade already exist in onboarding. Service area, opening days, and opening hours do not — today they default silently (`opening_time`/`closing_time` to 08:00–17:30, `service_areas` to empty) and only ever get asked about later, deep in the Business page. Asking these five up front, and nothing else, is a genuinely new but small collection surface, not a reuse.

**Trade: five options, not eight.** Today's list (`lib/trades.ts`) has eight (plumbing, electrical, landscaping, building, cleaning, heating, roofing, painting) plus a generic fallback. The proposal's five — Plumber, Electrician, Painter & Decorator, Builder, Roofer — is a real narrowing, not a renaming. **This has one concrete consequence that must be decided explicitly, not discovered later: SHABZ (heating) is a real, currently-connected pilot business outside the new five.** Existing businesses on a trade outside the five must keep working exactly as they do today — the restriction applies to *new* signups' trade-selection screen only; `normalizeTrade()`'s fallback already handles anything unrecognised gracefully, so no data migration is required, only a decision that the five-option screen is additive UI, not a retroactive filter.

**Why these five fields and no others:** each one is required before she can say anything real in Step 3. A description, a personality trait, a payment method — none of those are needed for her to say "we cover Manchester and we're open weekdays 8 to 5:30." Everything else genuinely waits for Step 4, which is the whole point of moving it there.

**Hours, kept genuinely simple:** one open/close time applied to whichever days are toggled on, defaulting to Mon–Fri (matching today's DB default). This is a fast preset, not a rebuild of the Diary — the existing Booking Rules page (already praised in the Owner Journey Review as "already does everything the redesign asked for") remains the place for real per-day customisation, notice periods, and lunch breaks. Setup seeds it; Booking Rules still owns it.

### Step 3 — Meet your receptionist (thinner, earlier, still honest)

She introduces herself with exactly the five facts just given — nothing invented, nothing padded to sound more finished than it is. This is a real, deliberate change from today's Meet, which currently requires full Business Knowledge *and* all three Receptionist topics before it says anything at all (`lib/receptionist-handover.ts`'s readiness gate). Under this proposal, Meet's bar drops to "the five setup facts exist" — which is always true the moment Step 2 finishes.

**Why this is still honest, not a step backward:** the current recap already has an explicit `"empty"` state for exactly this situation — *"I haven't learned much about you yet... Let's fix that first."* The new Meet simply has a real, always-true floor to stand on (five real facts) instead of an all-or-nothing gate. She says what she knows, says plainly that there's more to learn, and moves the owner into Step 4 — the introduction a new hire gets on day one, not the exit interview.

### Step 4 — Teach your receptionist (one surface, not three pages)

**What merges:** Business (`/dashboard/business`), Receptionist (`/dashboard/receptionist`), and Everything I Know (`/dashboard/everything-i-know`) become one destination. The `KnowledgeTabs` strip already treats these as one relationship split across three routes for navigational convenience — this proposal finishes that thought instead of maintaining the split.

**Everything I Know specifically is retired, not merged in.** Its job — showing confidence and gaps — is already duplicated inline on both Business and Receptionist today (`brain.gaps`, "Where things stand," "How well I know your style"). A single merged teaching surface can show the same honest gap list inline, contextually, next to whatever's actually incomplete — a separate "confidence dashboard" page becomes redundant the moment there's only one page to have confidence about.

**Regrouping, not concatenating:** simply stacking today's seven sections (identity, scope, commercial, good-to-know, behaviours, rules, escalation) end to end would be more page, not less. Proposed regrouping into five natural sections, closer to how a real handover conversation actually flows:

1. **About you & what you do** — name, description, personality, services, areas, jobs declined.
2. **How you work** — payment methods, guarantees, emergency call-outs and fee.
3. **How you'd like me to talk and act** — tone (with the real, live example already built), behaviours, house rules.
4. **When to bring you in** — escalation, unchanged in substance, still using the real scenario-question framing already written.
5. **Things customers ask** — FAQs, unchanged; already the best-executed section on the current page (verbatim, word-for-word answers, explicitly promised as such).

**The open decision this section forces — read before agreeing to anything else:** the brief's own example teaching lines — *"We don't work weekends," "Always ask for photos," "We don't repair flat roofs," "We don't give prices until we've seen photos"* — are free-text, natural-language statements. Today, free text in any teaching field is stored **verbatim, unparsed**, appended to `system_prompt`/`business_rules` as-is. Making these examples actually work as *the* way to teach — rather than examples of what a chip *represents* — requires parsing free text into structured facts (e.g., recognising "we don't repair flat roofs" as a declined-service entry, not just prose). **This is the same natural-language extraction capability specified as Phase 3 in the original Hiring Experience Redesign and explicitly deferred twice since, pending real pilot evidence.** This proposal does not resolve that tension by building it quietly. Two honest options:
- **(a)** Keep today's structured mechanisms (chips, direct questions, a free-text field that's stored as supplementary notes) and simply write their prompts and framing in the same natural voice as the brief's examples — "Tell me anything I should never do" *feels* like the brief's examples even though it's still backed by a chip-and-notes mechanism underneath. No new capability, ships now.
- **(b)** Actually build free-text-to-structured-fact extraction, so "we don't repair flat roofs" really does become a real, structured declined-service entry. Real, valuable, and exactly the kind of thing this project has consistently said needs real pilot evidence first, not a v1 guess.
**Recommendation: (a) for this V1.** The feeling the brief is describing is achievable through voice and framing alone; the harder capability stays exactly where the last three documents already, deliberately, left it.

### Step 5 — Test your receptionist

Already built, already real (`/dashboard/receptionist/try`, powered by the same `generateReplyForMessage`/coaching engine). What changes here is only *when it's reached* — after Teach, not gated behind a full-completion recap the way Meet used to require. Category coverage (routine, booking, pricing, emergency, complaint) stays exactly as already designed in `03-Trust-Experience.md` §4.

### Step 6 — Connect WhatsApp

**The gate changes, and this is the direct consequence of moving Meet earlier.** Today (RC2-M1), WhatsApp is gated on `handover_confirmed_at` — a reasonable proxy when Meet only ever happened *after* full teaching. Once Meet happens early and thin, `handover_confirmed_at` alone is no longer a meaningful proof signal for this gate. **This proposal requires a new, explicit signal: a real Test Conversations exchange has actually happened.** Concretely, whether at least one non-`notReady` reply has ever been generated against the reserved test conversation for this business — a fact already knowable from existing `reply_drafts` rows, not a new data model. WhatsApp's redirect condition (`app/(dashboard)/dashboard/whatsapp/page.tsx`) moves from checking `handover_confirmed_at` to checking this. Everything else about the gate (unconnected-path-only, never affects an already-connected business) stays identical to the RC2-M1 implementation.

### Step 7 — Run the business

Out of scope for this proposal's redesign — Front Desk, Conversations, Customers already exist and aren't part of the first-run journey. The one connection worth stating: once Teach is a single ongoing surface rather than a one-time onboarding gate, "revisit Knowledge" during real operation becomes a return trip to the *same* place first-run already introduced, not a different, colder settings area discovered later.

---

## 3. Architecture consequences, named explicitly

- **The readiness/handover model splits into two real signals**, not one overloaded one: *"has she been introduced"* (five setup facts exist — always true post-setup) and *"has she actually proven herself"* (a real Test exchange happened — gates WhatsApp). Both are cheap, already-derivable facts; this is a re-pointing of existing gates, not new infrastructure.
- **The five-trade restriction is UI-only for new signups.** No migration, no retroactive effect on SHABZ or any other existing business on a trade outside the five.
- **Everything I Know's route can be retired** once its gap-surfacing is inline elsewhere — a real page-count reduction (three teaching-adjacent routes become one), matching "reduce page count wherever possible" concretely rather than aspirationally.
- **No second reasoning engine is introduced anywhere in this proposal.** Every "she replies" moment — Meet's recap generation (still the existing deterministic, non-LLM `buildHandoverRecap`, which was never the fake engine — it's a plain, honest data-to-sentence function, not a stand-in reasoning system), Teach's live examples, Test's exchanges, real WhatsApp — traces to the same real pipeline or the same honest deterministic recap function that already existed.

---

## 4. Premium feel — what "Stripe/Linear/Notion/Framer/Vercel/Raycast/Apple" means concretely

Not a visual redesign spec — a set of concrete, checkable commitments to hold the eventual implementation against:

- **Restraint over decoration.** No gradient hero banners, no illustration filler, no marketing-site flourishes inside the product. Calm surfaces, real content, generous whitespace over dense information.
- **Motion with purpose, not motion for its own sake.** The existing debounced-save pattern, the typing/thinking states, and `SettleCard`'s entrance timing are already in this register — extend the same restraint to any new screen rather than inventing a new animation vocabulary.
- **One clear action per screen**, always the visually loudest thing on it — matching Principle 3 exactly ("every screen answers one question").
- **Typography and hierarchy do the organising**, not borders and background-colour blocks. Fewer boxes, more rhythm.
- **Every empty, loading, and error state is written in her voice**, never a generic system message — already true in most of the existing product (the honest "empty" states, the soft-error copy); this is a bar to hold on every new screen, not a new invention.
- **Mobile is the primary surface, not an afterthought** — this audience is on a phone, on a job, between tasks. Every screen in this proposal should be designed at 390–430px first.

---

## 5. Inventory — retired, reused, newly built

**Retired:** Everything I Know as a separate route (folded inline). The current three-tab `KnowledgeTabs` strip (replaced by one continuous surface — nothing to switch between). The old, full-completion Meet readiness gate (replaced by the five-fact floor).

**Reused, unchanged in substance:** the real reasoning engine and every safety guarantee it carries; Test Conversations; The Promise; the coaching mechanism (C1–C6); the Booking Rules/Diary page; all chip and free-text teaching controls (regrouped, not rebuilt); the WhatsApp connect page's UI once reached.

**Newly built:** the one-minute setup screen (service area, opening days, opening hours as real onboarding fields); the five-trade selection screen; Meet's new, lighter readiness computation; the merged Teach surface's information architecture (five sections replacing seven); the "real Test exchange happened" signal gating WhatsApp.

**Explicitly not built, by conscious decision (§2, Step 4):** free-text-to-structured-fact extraction. Still the same deferred capability it's been for months; not smuggled in through this redesign.

---

## 6. Proposed implementation sequence, once agreed

Treated as one cohesive release, per instruction — but built and verified in a real dependency order, the same discipline as every prior phase in this project:

1. **Onboarding**: the new five-field setup screen, five-trade restriction, seeding Booking Rules' initial hours.
2. **Meet's new readiness computation** (the five-fact floor) — smallest, most isolated change, verifiable on its own against a fresh account.
3. **The merged Teach surface** — the largest single piece; built once, verified against both a fresh account and real production data (SHABZ) to confirm nothing already taught is lost or misread in the new grouping.
4. **The new WhatsApp gate** (real-Test-exchange signal) — depends on Teach and Test both being reachable in the new order.
5. **Retire Everything I Know and the old tab strip**, once nothing links to them and the new surface's inline gap-panels are confirmed working.
6. **Full regression**: adversarial suite (reply engine untouched, but re-confirmed), a fresh-account walkthrough on mobile and desktop, and a real-production-data pass against every currently-connected business, not just SHABZ.

---

## 7. What this proposal deliberately does not do

Redesign Front Desk, Conversations, Customers, or Approvals — untouched, out of scope. Add any new capability the project has already, deliberately deferred (personality data shape, correction/learning loop, free-text extraction). Change any safety guarantee, escalation category, or fact-grounding rule — all inherited exactly as-is from the one real engine. Force existing businesses through any part of this new sequence — this is the *first-run* experience; a business that already exists keeps using the product exactly as it does today, with no forced migration.
