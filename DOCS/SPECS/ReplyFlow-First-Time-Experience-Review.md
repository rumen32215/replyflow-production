# ReplyFlow First-Time Experience Review

**Study only — no redesign, no implementation.** The Brain Loop, Trust Ladder, Learning Memory, Adaptation Architecture, Owner Attention Architecture, and core engineering are stable. This document is the start of a new phase — Experience Polish — whose only job is making the first-time journey, from a stranger's first click to their first minute inside Front Desk, feel like a world-class product. Every finding below is traced to real, current code and real, current copy — no screen was redesigned or assumed to produce this.

**Companion, not a duplicate:** `ReplyFlow-Owner-Journey-Review.md` already studied the onboarding-to-WhatsApp journey in depth (sequence enforcement, personality proof, page consistency) and its findings stand. This document starts earlier — before a visitor has even created an account — and asks a different question of every screen, including ones the Owner Journey Review already covered: not just *is this clear*, but *does this feel like the best version of itself has been considered*. Where the two documents genuinely overlap, this one says so rather than re-deriving the same finding under a new name.

---

## The governing test

> **Would a first-time visitor feel, within the first ten seconds, that they've found something built specifically for them — or would they feel like they've landed on "a SaaS product," interchangeable with a hundred others?**

Every finding below is judged against this, and against one more, borrowed directly from this task's own brief: **does this screen create aspiration, or does it just explain a feature?** Apple's onboarding doesn't answer "what does this do" — it makes someone think "I want this" before they've thought to ask. That's the bar this review is using, not "is this screen functional" (nearly everything below already clears that bar).

**Now a permanent law, not just this review's test:** `06-Experience-Architecture.md` has been amended with the sharpened form of this rule — *"every screen must answer one emotional question before it's allowed to ask the visitor for anything"* — with a worked example for each screen in this journey. Findings below are the evidence that produced that amendment.

---

## Method

Every screen was read from its real, currently-deployed source — component code and the literal copy it renders, not a description of intent. Where a claim depends on runtime behaviour (what the AI actually says in the demo, whether the auth-callback fragment path fires in practice), that's stated as what the code does, not assumed from a screenshot. A parallel, independent walkthrough (screenshots reviewed against this same journey) surfaced consistent findings — cited inline where it adds a real, user-visible detail the code alone can't show (e.g. how repetitive the live demo actually reads in a real run).

---

## 1. Landing page

### Current experience

**There isn't one — this is itself the first, most important finding.** `app/page.tsx` is not a marketing page; it's a router: signed out → `/login`, mid-onboarding → `/welcome`, fully set up → `/dashboard`. There is no `public/` static site, no separate marketing route, nothing in this codebase that explains what ReplyFlow is before asking someone to log in or create an account. **`/login` is the de facto landing page today.**

### What the user is thinking

"Did I get the wrong link? What is this?" A visitor arriving with even mild intent (a referral, an ad click, curiosity) has nothing to read, nothing to watch, no reason given before being asked to choose between two form modes.

### Friction points

- Zero information before the first decision point (log in or sign up).
- No way to "just look around" — every path assumes the visitor already wants an account.

### Trust issues

- Nothing here demonstrates anything (Trust Experience document 04's own governing law — "trust has to be demonstrated, not asserted" — currently has no chance to even begin, since there's nothing to demonstrate with yet).
- No social proof, no named trades, no example of what the product actually produces.

### Emotional issues

- Flat. There's no moment of "oh, this is for me" — the exact opposite of the Founder Handbook's own description of ReplyFlow ("the receptionist a sole trader wishes they could afford to hire").

### Information hierarchy problems

- N/A — there's no hierarchy because there's no content.

### Opportunities

- A real landing page is the single highest-ceiling opportunity in this entire review: one real WhatsApp exchange shown live (the same kind of proof Test Conversations already produces internally), the five supported trades named explicitly, and one sentence that states the actual promise ("Never miss another job because you were up a ladder").
- This doesn't have to be a big build. Even a single, static, well-designed page reusing the phone-preview visual language already built for onboarding (`components/shared/phone-preview.tsx`) would close nearly all of this gap.

### Recommended changes, ranked by impact

1. **Build a real landing page** — highest impact of anything in this entire document; everything downstream inherits its absence.
2. Lead with a real (or realistic) WhatsApp exchange, not a feature list — this product already knows how to do this well (see Test Conversations, §9 below).
3. Name the trades explicitly — plumbers, electricians, builders, roofers, painters already trust something built by a stranger more when it's clearly for people like them.

---

## 2. Login

### Current experience

`components/auth/login-form.tsx`, rendered inside `AuthCard` (`components/auth/auth-card.tsx`) — a bare, centered white card: email field, password field, "Forgot password?", a submit button, a link to sign up. The surrounding `AuthLayout` (`app/(auth)/layout.tsx`) adds only a logo top-left and a very subtle background gradient.

### What the user is thinking

"This could be any SaaS login screen." Nothing on this screen is specific to ReplyFlow — swap the logo and it's interchangeable with a hundred other products.

### Friction points

- None, mechanically — the form itself is simple and correct.

### Trust issues

- Because this doubles as the landing page (§1), it's also the *first* thing many visitors see — and it currently carries zero identity, zero proof, zero reason to believe.

### Emotional issues

- Purely functional. No warmth, no personality — a stark contrast to how well the product's own *onboarding* voice is written once someone is actually inside (Welcome's "Good afternoon. Welcome to ReplyFlow." is genuinely good — see §7).

### Information hierarchy problems

- None internally (it's a two-field form) — the real problem is what's *missing* around it, not how it's arranged.

### Opportunities

- Once a real landing page exists (§1), login itself may not need much more than it already has — its job narrows to "get an existing user back in quickly," which it already does well. Don't over-invest here; invest in §1 instead.

### Recommended changes, ranked by impact

1. Nothing structural — this screen is fine *once it's no longer also carrying the landing page's job*.
2. Minor: one line of real identity (a short tagline under the logo) costs almost nothing and stops this screen from reading as completely generic in the meantime.

---

## 3–4. Free trial / Account creation (signup)

These are the same screen (`components/auth/signup-form.tsx`) — reviewed together rather than padded into two sections that would just repeat each other.

### Current experience

Same `AuthCard` shell as login. "Create your account" / "Start your 7-day free trial. No credit card required." / email / password (with a live 3-rule strength checklist — a nice, real touch) / "Continue" / a Terms & Privacy line.

### What the user is thinking

"OK, I'm signing up for... something." The trial framing ("7-day free trial, no credit card required") is the single most commercially important sentence on this screen, and it's rendered identically to every other muted subtitle in the product — same size, same weight, same grey.

### Friction points

- None mechanically — the password-rule checklist is a genuinely good, real-time affordance.

### Trust issues

- The password rules are the most *reassuring* thing on the page ("this product cares about doing this properly") purely by accident — that energy isn't spent anywhere else on the screen.

### Emotional issues

- Same flatness as login. "Continue" is a completely neutral verb for the actual moment — this is the moment someone commits to trying to fix a real, felt problem (missed jobs, a phone that never stops).

### Information hierarchy problems

- The trial terms ("no credit card required") are arguably the second-most persuasive fact on this entire screen, after the product's own name, and they're visually the least emphasized line on it.

### Opportunities

- Reframe "Continue" to name the actual next step in the owner's own language, not the software's ("Start building my receptionist," or similar) — small, cheap, and consistent with the product's own established voice everywhere else (Welcome, Meet Your Receptionist).
- Give "No credit card required" its own visual weight — it's a genuine objection-killer being wasted as fine print.

### Recommended changes, ranked by impact

1. Elevate the trial-terms line — cheap, real conversion impact.
2. Rename the CTA away from generic "Continue."
3. (Depends on §1) Once a real landing page exists, this screen inherits some of its momentum for free — sequencing this after §1 is more efficient than polishing it in isolation.

---

## 5. Email verification

### Current experience

`app/(auth)/verify-email/page.tsx` — a mail icon, "Verify your email," the address it was sent to, "Click the link… you can close this tab," and a resend option (`ResendEmailButton`).

### What the user is thinking

"OK, I need to go check my email now." This is the one screen in the whole journey whose real problem isn't its own content — it's what happens *around* it.

### Friction points — this is the real finding, and it's structural, not cosmetic

The actual path today: **Signup → leave ReplyFlow → open email client → find the email → click → return.** That's inherent to email verification and can't be fully removed, but two real, code-confirmed things make it worse than it needs to be:

1. **The verification email itself is Supabase's own default template**, sent from a Supabase domain, in Supabase's own visual language — the moment a user's trust is most in flux (did this even work?) they're handed off to a sender they've never heard of, reinforcing "wait, whose product is this?" This is confirmed by the code: `signup-form.tsx` calls `supabase.auth.signUp(...)` with no custom email template wired in anywhere in this codebase.
2. **Two different post-click paths exist, and the code has to actively work around the second one.** The intended path is `/auth/callback?code=...` (`app/auth/callback/route.ts`), which exchanges the code server-side and redirects straight into `/welcome` — genuinely well-built, auto-login, no extra step. But `components/auth/login-form.tsx` contains real, load-bearing code (`hasFragmentSession()`, the whole `completingSignIn` branch) specifically because **Supabase's email link sometimes lands on `/login` with the session in a URL fragment instead**, which the server-side callback route can never see. This is a documented, coded-for reality in this codebase, not a hypothetical — meaning some real fraction of users land somewhere other than the intended flow after clicking "confirm," and the product's own comments describe this as the failure mode being defended against, not a one-off.

### Trust issues

- An unbranded confirmation email, arriving after the product has just asked someone to trust it with their business's customer communications, is a small but real credibility gap — see §4 above.

### Emotional issues

- Low stakes here on its own; the emotional cost is really paid one step later, if the fragment path fires and something goes slightly wrong.

### Information hierarchy problems

- None — this screen's copy is honest and clear.

### Opportunities

- A branded confirmation email (Supabase supports custom SMTP/templates) closes the biggest single trust gap in this section, and reinforces "ReplyFlow" at the exact moment someone's about to leave the product entirely.
- Auto-login already exists for the primary path (§6) — worth explicitly verifying in production which path most real signups actually take, since the code strongly implies both are live today.

### Recommended changes, ranked by impact

1. **Replace the default Supabase email with a branded one** — cheap, high-trust-return, no architecture change.
2. Confirm in production which confirmation-link shape actually fires for real users (PKCE code vs. fragment) — if the fragment path is common, it deserves first-class treatment, not a defensive patch inside the login form.

---

## 6. Authentication flow

### Current experience

`app/auth/callback/route.ts` — exchanges the Supabase code for a session, ensures a `businesses` row exists (`ensureBusinessRow`), and redirects to `/welcome`. This is genuinely well engineered: idempotent, defends against a failed insert by retrying later at `/api/onboarding/prepare`, records a `warning`-severity error event on a sustained failure, and — per §5 above — the login form separately handles the fragment-based variant of the same handoff.

### What the user is thinking

Nothing, ideally — and for the primary path, that's exactly what happens: click the email link, land inside onboarding, no second login. That's already the "better experience" this whole journey should be aiming for.

### Friction points

- The one real friction point is §5's dual-path reality: a user who happens to hit the fragment path sees a brief "Signing you in…" spinner on `/login` instead of landing directly via the callback route — same *destination*, marginally different *feel*, and a second code path that has to be kept correct forever.

### Trust issues

- None once the session lands correctly — the mechanism itself never surfaces to the user in the successful case, which is exactly right (Handbook Principle 6, "quiet intelligence").

### Emotional issues

- None on the happy path.

### Information hierarchy problems

- N/A — this is plumbing, correctly invisible.

### Opportunities

- Genuinely, not much to change here experientially — the opportunity is technical (§5's recommendation to confirm which path is actually common) rather than a redesign.

### Recommended changes, ranked by impact

1. See §5 — this section's only real action item lives there.

---

## 7. Business creation (business name, service area & hours)

Covers `components/onboarding/business-name-step.tsx` and `components/onboarding/service-area-step.tsx` — "Business creation" in the requested review order maps to these two real screens plus the trade step (§8).

### Current experience

Business name: one big input, auto-focused, the heading itself reacts to typing ("What's your business called?" → "Nice to meet you, {name}."). Service area & hours: days-open toggles, a time-range picker, and a free-text service-area field inside a deliberately atmospheric "location slot" card (soft glow, faint contour-line texture — a placeholder for a future real map, not a real one yet).

### What the user is thinking

"This feels like a conversation, not a form" — genuinely, for business-name specifically. Service-area is a half-step down (three real inputs stacked, "A little about how you work" as a plain section label rather than a reactive line) but still clearly considered, not a bare settings panel.

### Friction points

- None functionally — both screens validate sensibly and carry state via a persisted local store (`useOnboardingStore`), so a refresh or accidental back-navigation doesn't lose progress.

### Trust issues

- None — if anything, these two screens are where the product is already closest to the Apple-level simplicity this review is asking for everywhere.

### Emotional issues

- Business-name is genuinely warm ("Nice to meet you, {name}."). Service-area is competent but neutral by comparison — a real, if minor, step down in voice between two adjacent screens.

### Information hierarchy problems

- None of real consequence.

### Opportunities

- Bring service-area's framing up to business-name's own bar — even a small reactive line ("Got it — {area} it is.") would keep the emotional register consistent screen to screen, rather than warm → neutral → (per §9) warm again.

### Recommended changes, ranked by impact

1. Low priority, cheap: match service-area's voice to business-name's. This section is already close to the standard the rest of this review is asking the *other* screens to reach.

---

## 8. Trade selection

### Current experience

`components/onboarding/trade-step.tsx` — five icon cards (Plumbing, Electrical, Painting, Building, Roofing) plus a disabled "More soon" placeholder, single-select, animated check on selection.

### What the user is thinking

"Which of these am I?" — quick, low-friction, visually clear.

### Friction points

- None.

### Trust issues / the real question this screen raises

The parallel review's own framing is the right one to test directly: **does selecting a trade actually change anything, or is it just a label?** Checked against the real code — it isn't cosmetic. `lib/receptionist.ts`'s `scenariosForTrade()` genuinely changes the example scenarios shown later during Receptionist teaching; `lib/reply-engine/context/assemble.ts` passes the real `trade` value into the context every live reply is generated from; the "preparing" demo (§9) picks a trade-specific opening problem (`TRADE_ISSUE`) rather than a generic one. **The concern behind the question is answered correctly by the product already — the gap is that the product never tells the owner this.** Nothing on this screen, or anywhere shortly after it, ever says "because you're a plumber, I already know to ask about…" — the payoff is real but invisible, which is close to the same trust cost as if it weren't real at all.

### Emotional issues

- Mild missed opportunity rather than a problem — a confident, specific line here ("Plumbers get asked about emergencies more than anyone else — I'll make sure I never miss one") would turn a label pick into the first proof that this product actually understands the trade, before a single fact has been taught.

### Information hierarchy problems

- None.

### Opportunities

- Say out loud, once, that the choice matters — this is a near-zero-cost copy change with real trust payoff, and it directly serves the "prove it before asking for trust" law the product already applies well elsewhere (Trust Experience document 04).

### Recommended changes, ranked by impact

1. Add one sentence confirming the trade choice has real weight — cheap, high trust return, and true.
2. No structural change needed — five focused trades over many shallow ones is already the right call, already made, already reflected in real code (`lib/trades.ts`).

---

## 9. The "preparing" screen — the live demo conversation

Not explicitly named in the requested list, but it sits directly between trade selection and Meet Your Receptionist, and it's the single most heavily flagged screen in the parallel review — it belongs in this document.

### Current experience

`components/onboarding/preparing-receptionist.tsx` — a real POST creates the business row, then the exact real reply-generation pipeline (`/api/receptionist/live-reply`, the same code production uses) runs four sequential, memory-carrying exchanges live: a trade-specific opening problem, a booking question, a coverage question, a close. Genuinely real, not scripted — later replies depend on earlier ones because actual conversation state is threaded through, not faked.

### What the user is thinking

Ideally: "wait, that's actually how I'd want it handled." In practice, per the parallel walkthrough's own account of a real run: the replies leaned repetitive, circling back to the same kind of clarifying question (postcode/coverage) more than once across four short exchanges.

### Friction points

- None mechanically — this is the demo working exactly as engineered (a real model call, four times, in sequence).

### Trust issues

- This is the highest-stakes trust moment before the emotional payoff of Meet Your Receptionist even arrives, and because it calls a real, non-deterministic model, its quality varies run to run in a way none of the fully-scripted screens around it do. A flat or repetitive real run here costs more than a merely mediocre static screen would, precisely because it's presented as proof, not decoration.

### Emotional issues

- The intent is exactly right (Apple doesn't demo features, it demos outcomes — this screen already knows that, structurally). The risk is entirely in execution quality of what the model actually says, not in the screen's design.

### Information hierarchy problems

- None — the "what I've already learned" facts and the live phone conversation are well separated and well paced (`FACT_GROUP_DWELL_MS`, `BETWEEN_EXCHANGE_PAUSE_MS` are genuinely considered choreography, not arbitrary).

### Opportunities

- This is a case for tightening the *content* the real pipeline produces for this specific, narrow, high-stakes context — not a UI redesign. Worth a focused pass (separate from this review) specifically on what makes a demo reply repetitive across 4 short turns, since the mechanism itself (real memory, real pipeline) is already correct and shouldn't be second-guessed.
- Consider: does the demo's 4-message script itself invite repetition (a coverage question asked at message 3, when the trade-specific opening problem at message 1 might already imply the answer)? Worth checking the actual script (`TRADE_ISSUE`, the four fixed `demoMessages`) against real run transcripts before concluding whether this is a generation-quality issue or a demo-script issue.

### Recommended changes, ranked by impact

1. **Audit real transcripts from this exact demo, across all five trades, before touching anything** — this is a data problem first, not a design problem; redesigning the screen wouldn't fix repetitive model output.
2. Once the actual cause is known (script vs. generation), fix that specifically — likely a very targeted change, not a rebuild.

---

## 10. Meet Your Receptionist

### Current experience

`components/dashboard/receptionist/meet-your-receptionist.tsx` — she opens in her own voice ("Hi. I've finished learning about {businessName}. Here's what I've understood:"), states real facts (`buildHandoverRecap`), states real gaps just as plainly ("And to be honest with you:"), asks "Have I understood your business correctly?", then — once confirmed — states The Promise and offers "Try to break me" straight into Test Conversations.

### What the user is thinking

This is meant to be the emotional high point of the whole first-time journey — and the mechanism for getting there (a real, honest recap in her own voice) is exactly right, already praised correctly by the parallel review as genuinely good writing.

### Friction points

- None mechanically.

### Trust issues / a real, code-confirmed tension worth naming

**"Ready" is satisfied by very little.** Per `lib/receptionist-handover.ts`'s own readiness rule, this screen renders its full "ready" experience — the confirmation, The Promise, "Try to break me" — the moment `service_areas` has anything in it, which is true for essentially every business immediately after onboarding's four short screens (§7–§8), *before* Business or Receptionist teaching has happened at all. Read the real gap list that produces for a brand-new business: no services taught, likely no emergency-callout answer, no house rules, no escalation rules, no FAQs — five or more honest "you haven't told me X yet" lines are a real, common, first-run outcome, not an edge case. The recap's honesty is exactly correct per the product's own non-negotiable rule (never invent a fact) — the tension is sequencing, not honesty: **the flagship trust moment of the entire journey is structurally likely to open with more gaps than understood facts**, for every single new owner, by default.

### Emotional issues

- When it works well (a business with at least a few real facts already taught) this is the best-written moment in the product. When it fires at the bare minimum "ready" bar, the emotional arc inverts — instead of "wow, she gets me," the felt experience is closer to "she doesn't know much about me yet," at the exact moment the product most wants to earn a "wow."

### Information hierarchy problems

- Understood facts and gaps are visually similar in weight (same bubble style, bullet lists) — a business with more gaps than facts reads as a wall of "I don't know" statements with no visual signal that this is expected and temporary.

### Opportunities

- This doesn't require weakening the honesty rule — it requires deciding, deliberately, whether "ready" should mean what it means today, or whether Meet Your Receptionist should wait for a slightly richer minimum (a few real Business/Receptionist facts, not just an area) before this specific, one-time emotional beat fires. That's a real product decision, not a copy fix — flagged here for the founder, not decided.
- Short of that: even keeping today's readiness bar, visually distinguishing "gaps that are expected right now" from "gaps that matter" would soften the wall-of-caveats effect without changing what's said.

### Recommended changes, ranked by impact

1. **Decide, deliberately, what "ready" should require** for this specific screen — the single highest-impact open question in this whole review, because it governs the product's own best-written moment.
2. Regardless of that decision: visually soften the gaps list so it reads as "still learning" rather than "list of shortcomings," when it does appear.

---

## 11. Entry into Front Desk

### Current experience

`app/(dashboard)/dashboard/page.tsx` — for a business still finishing setup, a `SetupJourney` checklist with four steps, literally labelled: **"Meet your receptionist," "Teach your receptionist," "Test your receptionist," "Connect WhatsApp."** Once complete, a warm, real greeting (`GreetingCard`) and the day's actual priority.

### What the user is thinking

At the checklist stage: "OK, what do I do next" — answerable, but flatly. Once past it: genuinely good — a real, specific, non-generic greeting is exactly the right note to land on.

### Friction points

- None mechanically — the checklist correctly gates the full dashboard and correctly reflects real progress.

### Trust issues

- None.

### Emotional issues / the real finding

**Every step's label is internal product vocabulary, not the owner's own language for what's actually happening.** "Teach your receptionist" describes what the *product* calls the action; it doesn't describe what the *owner* is achieving ("make sure she never gets your prices wrong," or similar). The parallel review's framing is exactly right: this reads like engineering shorthand that never got translated for the person actually doing it. Compounding this: per the Owner Journey Review's own earlier finding, this exact checklist is also the one place in the product that still has *no* completion celebration or forward-guidance — Business and Receptionist teaching both already do this well elsewhere; Front Desk's entry point is the one screen that hasn't caught up to a pattern the product has already proven it knows how to do.

### Information hierarchy problems

- The four steps are presented as equal-weight checklist items with no sense of *why this order*, or what finishing one actually unlocks — same finding the Owner Journey Review already made (§7 of that document), reconfirmed here from the aspiration angle: a checklist is the least aspirational UI pattern available for what should be the excited final stretch before going live.

### Opportunities

- Rename the four steps in the owner's own terms, framed by outcome rather than internal action.
- Give this checklist the same celebration/forward-guidance treatment Business and Receptionist teaching already have — not a new pattern, an extension of one that already works.

### Recommended changes, ranked by impact

1. Rewrite the four step labels in outcome language, not product-feature language.
2. Add completion acknowledgement/forward-guidance to this checklist, reusing the pattern already proven elsewhere in the product.

---

## Cross-cutting themes

A few findings recur across multiple screens and are worth naming once, plainly, rather than being buried inside each section:

- **There is no landing page, and login is quietly standing in for one.** This is the single highest-leverage finding in the entire review — everything else here polishes a journey that, today, still starts with an unexplained login form.
- **"Receptionist" as internal vocabulary leaks into owner-facing copy repeatedly** — Front Desk's checklist (§11) is the clearest instance, but it's the same underlying habit as calling a step "Teach your receptionist" instead of naming what the owner actually gets from doing it.
- **The product already knows how to do this well — the gap is consistency, not capability.** Welcome (§7-adjacent, Screen 1 of onboarding proper), business-name (§7), and the confirmed half of Meet Your Receptionist (§10) are all genuinely excellent, warm, specific writing. The unbranded verification email (§5), the flat auth screens (§2–§4), and the internal-vocabulary checklist (§11) sit right next to that same quality bar without clearing it. This is an argument for raising the weaker screens up to the standard already proven elsewhere, not for a wholesale rewrite of the product's voice.
- **Two real, structural, code-level findings surfaced during this review that aren't primarily about visual polish** and deserve engineering attention alongside the design work: the dual auth-callback path (§5–§6) and Meet Your Receptionist's low readiness bar (§10). Both are named here because they were discovered doing this review, not because this document is asking to act on them yet.

---

## What this review does not do

No copy has been rewritten, no component has been redesigned, no code has changed. Per the brief: we redesign one screen at a time, starting from this document, once it's been discussed.
