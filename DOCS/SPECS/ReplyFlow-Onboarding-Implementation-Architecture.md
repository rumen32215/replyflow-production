# ReplyFlow Onboarding Implementation Architecture

**The concrete "how" for V21.6 — the locked experience.** Companion to `DOCS/CONSTITUTION/15-ReplyFlow-Onboarding-Experience-Architecture.md` (the "why," which this document translates line by line) and `DOCS/CONSTITUTION/16-ReplyFlow-Employment-Philosophy.md` (frozen, permanent). This is a spec, not permanent — expected to move as building proceeds.

**Status: drafted (2026-08-05), presented for approval before any code is written.** V20's own SPECS document described a generic acknowledgment-stack with a pulsing identity mark; that mechanism is fully retired below in favour of a scripted, per-trade, pacing-driven encounter. Nothing here has been implemented yet.

---

## 1. Sequence

One persistent view, one URL, no route changes between beats — unchanged from V20's own architectural finding. What changes is what happens inside it.

| Beat | Asks / says | Pause before responding | Writes |
|---|---|---|---|
| Meet | *"I don't know anything about you yet — let's fix that."* → asks name | none (nothing to think about yet) | — |
| | On name given | short (~700ms) | `businessName` |
| Learn | Trade, tapped from the existing icon grid | none (recognition) → held (~1200ms) for the vocabulary line | `trade` |
| Understand | Domestic or commercial, asked directly because it changes tone and quoting | short | new field — see §3 |
| | Consequence line stated | short | — |
| Widen | Area — permission-asking guess first, correction still available via the existing chip editor | held (~1400ms) before the guess | `serviceAreas` |
| | Consequence line stated | short | — |
| Prepare | Hours — permission-asking guess first, existing day/time editor as fallback if corrected | held (~1400ms) | `openingTime`, `closingTime`, `openDays` |
| | Consequence line stated (the after-hours baseline) | short | — |
| Discover | The one long pause in the whole encounter, then the trade-specific discovery line (§2) | long (2000–2500ms), never repeated elsewhere | see §2 |
| Close | *"I think I've got a real picture of you now."* → the momentum line | held | — → navigates to `/signup` |

Timing bands, translated from doc 15 §3's taxonomy into real numbers: **none** (<100ms, effectively immediate), **short** (600–900ms), **held** (1200–1600ms), **long** (2000–2500ms, Discover only). These are fixed constants, not random jitter — variation in *feel* comes from which band is used when, not from randomising within a band.

---

## 2. The discovery moment, per trade — the one place accuracy matters most

Doc 15 §4 already established that three trades share a real "most of this can wait, some of it can't" shape, and two don't. Exact content, and what each produces:

| Trade | Vocabulary line (Learn beat) | Discovery line | On "yes," writes |
|---|---|---|---|
| Plumbing | *"...someone says they've got a leak or no hot water, I'll know exactly what that means."* | *"...a burst pipe doesn't know that. Want me to treat anything that sounds genuinely urgent differently, even outside your hours?"* | `business_knowledge.emergencyNotes` — a real sentence, e.g. "Treats burst pipes and no hot water as urgent, even outside normal hours." |
| Electrical | *"...someone says their consumer unit's tripping, I'll know exactly what that means."* | *"...no power at all, or a burning smell, isn't a 'wait till Monday' problem. Want me to flag anything that sounds like that straight away?"* | `business_knowledge.emergencyNotes` |
| Roofing | *"...someone says water's coming through the ceiling, I'll know that's not routine."* | *"...weather doesn't wait for office hours. Want me to flag anything that sounds like an active leak, even outside your hours?"* | `business_knowledge.emergencyNotes` |
| Building | *"...someone mentions an extension or a loft conversion, I'll know that's a proper job, not a quick fix."* | *"Most of what you do is booked weeks out, not same-day. Want me to say that upfront, so nobody's expecting you tomorrow morning for a job that needs planning?"* | `business_knowledge.personality` — appends a chip, e.g. "Books several weeks ahead." |
| Painting & Decorating | *"...someone says their lounge needs doing, I'll know that's a room, not a whole house, unless they say otherwise."* | *"You're usually working inside people's homes — want me to always check about pets or which rooms need to stay clear before confirming?"* | `business_knowledge.personality` — appends a chip, e.g. "Always checks access before booking." |

Both target fields already exist and already do real work — `emergencyNotes` and `personality` are read by the same reasoning pipeline every other real fact goes through (`lib/knowledge.ts`, `lib/intelligence.ts`), the same fields the dashboard's own Business Knowledge editor already writes to. Nothing new is being invented here technically; onboarding is simply the first surface allowed to write to them. One real correction from an earlier draft: `availability.rules.emergency` was initially proposed as the target field, until checking `lib/availability.ts`'s own `defaultAvailability()` showed it's already `true` for every business by default — writing "true" to an already-true field would have been a discovery moment that discovered nothing. Caught before it shipped, not after.

"No" at the discovery moment writes nothing — declining isn't a fact, and nothing should be invented to fill the gap.

---

## 3. Domestic/commercial — resolved, no schema change

Checked against the real schema rather than assumed. `BusinessKnowledge.jobsDeclined` (`lib/knowledge.ts`) already exists, is already read by the live reasoning pipeline (`lib/reply-engine/prompt/facts.ts`, rendered as *"Does not take on: {value}."*), and **"Commercial jobs" is already one of its existing suggested chip values** in the dashboard's own Business Knowledge editor. No new column, no new source of truth:

- Owner answers "domestic only" → onboarding appends `"Commercial jobs"` to `jobsDeclined`, exactly the value the dashboard already suggests for this. A real fact the receptionist will act on.
- Owner answers "both" / "commercial too" → nothing is written. The absence of a declined entry already correctly represents "not declined" — there is no separate flag for this state to occupy.

One consequence for the beat's own copy (doc 15 §0's reciprocal-learning line): the "flag a landlord/site manager mention to double-check" framing overstated what's actually persisted for the "both" branch, where nothing changes operationally. That branch's consequence line should say something true instead — e.g. *"Noted — I'll treat commercial and domestic enquiries the same unless you tell me otherwise."* The "domestic only" branch's line can be stronger, since it corresponds to a real written fact: *"Noted — if it's not domestic work, I'll let them know upfront rather than book something you don't do."*

---

## 4. Content is authored, not generated

Every line above is fixed, reviewed copy, not a live model call — the input space (five trades, a handful of confirm/correct branches) is small and fully enumerable, so there's no reason to accept the inconsistency risk of generating it at runtime. This is the same discipline the trade grid's own labels and the previous hours-presets already used, just extended to cover the vocabulary and discovery lines too. Doc 16's "never invent a fact" rule is satisfied by construction: nothing above claims to know something about *this* business beyond what the owner just said — the trade-specific content is genuine domain knowledge (what a burst pipe is), not a claim about the specific business.

---

## 5. What's retired from the V20 architecture

The identity-mark pulse-and-glow micro-interaction, the visible acknowledgment stack, and the generic "Mind if I guess — electricians round your size tend to..." aggregate-comparison framing are all gone, replaced by the scripted, pacing-driven sequence above. The chip-based service-area editor and the hours day/time editor both survive underneath, demoted from default-visible to correction-only, exactly as doc 15 §4 describes for the guesses that lead into them.

---

## 6. Meet Your Receptionist — continuity only, deliberately small

Doc 15 §5 confirms "no reset" is a requirement: whatever presence carries the Meet/Learn/Understand/Widen/Prepare/Discover/Close sequence has to be the same one the owner meets on `/dashboard/receptionist/meet`, not a new instance sharing only a visual language. Scope is deliberately bounded, by direct instruction: this pass exists to preserve continuity, not to redesign that page. Concretely, that means whatever single presence element carries pacing and behaviour through the onboarding sequence needs to also render on that page in the same form — nothing about that page's existing layout, content, or the real handover it already performs (`lib/receptionist-handover.ts`, untouched) changes beyond making room for it. Any broader improvement to that page is explicitly out of scope for this pass, left for a future one.

---

## 7. Status

Architecture settled. §3's schema question is resolved (no migration needed). §6's Meet Your Receptionist scope is confirmed and bounded. Next: the implementation plan.
