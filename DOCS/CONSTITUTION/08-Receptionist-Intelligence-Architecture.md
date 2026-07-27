# 08 — Receptionist Intelligence Architecture

**How she actually thinks, right now, cited against the real code.** Document 02 describes the receptionist in behavioural terms — what she knows, how she decides, how she speaks. Document 06 describes the general engineering discipline that makes any of that reliable. This document sits between them: the definitive, detailed map of her actual reasoning — every mechanism named, every table reproduced in full, every gap stated plainly — written specifically so the next phase of work (building the receptionist experience in earnest, now that onboarding is frozen) starts from an accurate picture instead of a remembered one.

Nothing below is aspirational. Where something is designed but not built, it says so, in its own section, not folded quietly into the rest.

---

## 1. How she thinks — the pipeline, in order

Five stages, each with exactly one job (document 06 §2 names the same pipeline; this section goes one level deeper into what each stage actually decides):

**Understanding** (`lib/reply-engine/understanding/classify.ts`) — one model call does both intent classification *and* conversation-state extraction together, deliberately not two calls. It judges the new message on its own terms, "never biased toward whatever we were already doing" — a pricing question asked mid-booking is classified `PRICING_INQUIRY`, not folded into `BOOKING_REQUEST`, specifically because pricing carries its own never-automatic rule regardless of context. Twelve intents exist:

```
BOOKING_REQUEST · BOOKING_CHANGE · BOOKING_CANCELLATION · BUSINESS_INFORMATION
PRICING_INQUIRY · RETURNING_PROBLEM · EMERGENCY · COMPLAINT · STATUS_CHECK
PAYMENT_QUERY · SOCIAL · UNCLEAR
```

A message can carry secondary intents too — a rambling message with a complaint buried in it must always surface that complaint as a secondary intent, however minor it reads next to everything else in the message. Confidence (`unknown/low/medium/high`) is judged separately from intent, and the instruction is explicit: guess low rather than fake certainty.

**Context Assembly** (`lib/reply-engine/context/assemble.ts`, gated by `lib/reply-engine/understanding/context-needs.ts`) — a fixed, deterministic table maps each intent to which context categories actually get fetched. Nothing is fetched speculatively:

| Intent | Business profile | Receptionist rules | Diary | Customer memory | History | Customer jobs |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| BOOKING_REQUEST | ✓ | ✓ | ✓ | ✓ | ✓ | |
| BOOKING_CHANGE | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| BOOKING_CANCELLATION | ✓ | ✓ | | ✓ | ✓ | ✓ |
| BUSINESS_INFORMATION | ✓ | | ✓ | | ✓ | |
| PRICING_INQUIRY | ✓ | ✓ | | | ✓ | |
| RETURNING_PROBLEM | ✓ | ✓ | | ✓ | ✓ | ✓ |
| EMERGENCY | ✓ | ✓ | ✓ | | ✓ | |
| COMPLAINT | ✓ | ✓ | | ✓ | ✓ | ✓ |
| STATUS_CHECK | | | | ✓ | ✓ | ✓ |
| PAYMENT_QUERY | ✓ | | | | ✓ | ✓ |
| SOCIAL | | | | | ✓ | |
| UNCLEAR | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Rows union across primary *and* every secondary intent — never narrowed. And whenever understanding confidence comes back `low` or `unknown`, the `UNCLEAR` row is unioned in regardless of what was actually classified, so low confidence always widens what gets fetched rather than narrowing it. `currentBooking` sits outside this table entirely — it's fetched unconditionally on every message, because overclaiming a booking's status is a real-money risk on any intent, not just booking-shaped ones.

**Conversation State** carried forward — see §3.

**Generation** (`lib/reply-engine/prompt/build.ts`, `generate.ts`) — a deterministic two-message prompt (one system block, one user block) writes the actual sentence. See §5–§10 for what governs its choices.

**Safety** (`lib/reply-engine/safety/evaluate.ts`) — the send/hold/escalate decision. See §8.

Two confidence signals stay deliberately separate the entire way through: how sure the *classification* was, and how sure the *drafted reply* is. A message can be perfectly understood and still produce a low-confidence reply; conflating the two would hide real information from the safety layer.

---

## 2. What she remembers

`lib/reply-engine/understanding/state.ts` — `ConversationState`, persisted to `conversations.ai_state`, carried forward every turn rather than re-derived from raw history:

```
stage: understand → diagnose → collect → quote_or_book → confirm → waiting → completed → closed
slots: { issue, location, preferredTime, customerName }
openQuestion: string | null
greetingGiven: boolean
lastTopic: string | null
goal: { type, status }
commitments: Commitment[]   // capped at the most recent 20
```

**Stage** never advances to `quote_or_book` or `confirm` while `slots.issue` is still null, and never moves backwards — except when the customer clearly starts a brand-new, unrelated request in the same thread, which restarts from `understand` deliberately, rather than trying to force one stage machine to track two overlapping topics at once.

**Goal** is the thing that's genuinely stable across a thread (`book_appointment`, `get_pricing`, `make_complaint`, …) — `general_chat` is not a real default, it's a placeholder meaning no real goal has been set yet, and the instruction is to classify the actual goal the moment the customer describes any real need, even on message one. A side-question mid-booking (the call-out fee) does not change the goal; "actually, cancel my Tuesday booking instead" does — and when the goal genuinely changes, stage resets but the commitments ledger is not cleared, because facts already established don't stop being true just because the topic did.

**The commitments ledger** is append-and-update, never delete: a `customer_fact` resolves the instant it's stated (nothing to wait on), while a `customer_question` or `receptionist_question` stays `outstanding` until something in the thread actually answers it. This is the mechanism that makes "never ask twice for something already said" enforceable rather than just a style guideline.

**`greetingGiven`** is a one-way ratchet — true the moment any greeting has happened anywhere in the thread, never reset.

**A two-pass correction, worth understanding precisely**: the Understanding step's `openQuestion` is only a provisional guess at what will still be outstanding *after* this turn — it genuinely cannot know the exact wording Generation will land on. The orchestrator (`generate-reply.ts`) overwrites `openQuestion` with Generation's own `asksQuestion` output once the real reply exists. This same two-pass shape (classify-time guess, generation-time correction) is the one pattern in this pipeline most likely worth reusing for any future stateful field.

**On failure**: if classification itself errors or the model returns something unparseable, the pipeline degrades to `primaryIntent: "UNCLEAR"` — and critically, `conversationState` is carried forward *unchanged* rather than reset to empty, because a transient failure genuinely doesn't mean the conversation's history stopped being real.

---

## 3. What she should never forget

The three Product Guarantees, as they're actually numbered and enforced in code (not a Constitution-numbered list — cited here from their real source):

- **Guarantee 1** (`lib/reply-engine/context/types.ts`, `lib/receptionist-handover.ts`) — an unconfirmed business fact (`null`) is never presented as known. It's disclosed as a gap, never guessed at, never defaulted to a plausible-sounding answer.
- **Guarantee 2** (`lib/reply-engine/safety/evaluate.ts`) — a payment question is always answered using the real taught payment methods when they exist, or forced to escalate rather than dodge the question. Covered by a dedicated grounding check (§8).
- **Guarantee 3** (`components/dashboard/conversations/conversation-story.tsx`, `app/api/conversations/[id]/send/route.ts`) — the owner always has a manual way to reach their own customer, even on the rare occasion the AI produces no draft at all. The product never becomes the only channel to a real customer.

Underneath all three sits the same mechanism: the commitments ledger and `slots` never silently drop something the customer already said. If it's real, it's tracked until it's resolved — the alternative (re-deriving everything from raw history every turn, the thing this whole state machine was built to replace) is exactly what produced re-greeting, re-asking, and fact drift in earlier production testing (document 02).

---

## 4. How she decides what to ask next

The governing rule, verbatim from the Voice document (`DOCS/BUILD/07` §2, baked directly into the generation prompt): **every question must serve exactly one of five outcomes — Diagnose, Quote, Book, Escalate, Close.** If a question doesn't move toward one of these, it doesn't get asked. This explicitly rules out reflexive filler ("Is there anything else I can help with?" as a habitual sign-off) — closing on silence is a valid, correct choice, not a missed opportunity.

At most one meaningful question per message. `stage` supplies the guidance string that shapes *which* of the five outcomes is live right now (`facts.ts`'s `STAGE_GUIDANCE`) — diagnostic questions while `understand`/`diagnose`, moving to an actual offer once in `quote_or_book`, confirming plainly (not re-collecting) once in `confirm`. These strings shape phrasing only; nothing about stage triggers code to act on its own (see §6 on why booking is never automatic).

---

## 5. How she qualifies a customer naturally

Two mechanisms working together, not one:

1. **The slot gate** — `stage` cannot reach `quote_or_book` while `slots.issue` is still unset. This is what stops the model from jumping straight to "when works for you?" before it has actually understood the job.
2. **Reflected understanding before the next question** — the generation prompt explicitly instructs a short diagnostic reflection ("Sounds like trapped air") before the follow-up question, not as filler on every message, but as a real acknowledgement that the previous answer landed. This is one of document 02's identified gaps closed since: it's a live instruction now, not just a Voice-document aspiration.

Combined with §2's commitments ledger (never ask for something already given) and §4's five-outcome rule (never ask something that doesn't serve the conversation), qualification here is not a fixed intake form — it's "ask the next thing that's actually still missing, and only if asking earns its place."

---

## 6. When she books

**She doesn't. There is no code path anywhere in the reply engine that creates or confirms a booking.** This is worth stating unambiguously, because `stage: "quote_or_book"` / `"confirm"` read like they might trigger something — they don't. They're prompt guidance strings that shape *phrasing* only.

The real flow: the owner sees the conversation in the dashboard and clicks "Create a Work Card." `lib/work-card.ts`'s `buildWorkCardDraft()` — a deterministic, non-model function — pre-fills the form from `ConversationState.slots` and resolved `customer_fact` commitments, purely to save retyping. It cannot invent a fact about the job; the owner reviews and can edit every field before anything is created. The row is inserted client-side with `status: "draft"`. Only `app/api/work-cards/[id]/approve/route.ts` — an owner-authenticated route — flips it to `"booked"` and sends the real confirmation to the customer. A drafted Work Card is never auto-submitted, and the reply engine never touches the `work_cards` table at all beyond reading it for context.

---

## 7. When she asks for photos

**She never does — this doesn't exist yet, anywhere in the pipeline.** Worth being precise about exactly what "doesn't exist" means here, since the surrounding architecture already half-expects it:

- Inbound WhatsApp messages that aren't `type: "text"` are stored with a placeholder body (`"[image message]"`) and the reply engine is never invoked on them at all (`app/api/webhooks/whatsapp/route.ts`) — no draft, no reasoning, nothing. The only thing built on top of this today is a dumb count (`photoCount`) shown to the owner in the conversation timeline.
- `DOCS/BUILD/06` §8 already designed a normalised media envelope (`media: [{ type, url, extracted_text_or_caption }]`, a caption generated upstream by a vision model) for exactly this — genuinely designed, never built.
- `DOCS/SPECS/Work-Card-Object.md` already treats Photos as a first-class, automatically-populated field once a Work Card exists.

So the gap is specific: there's a designed destination (the media envelope, the Work Card's photo field) and no path connecting an inbound photo to either of them, and no instruction anywhere that would make the receptionist *ask* for one in the first place (no slot, no fact, no prompt instruction covers this). Before the next phase of receptionist work reasonably builds on top of this, it needs an actual decision: does she ask for a photo as part of diagnosis (i.e., does "photo of the leak" become a sixth thing a question can serve, alongside Diagnose/Quote/Book/Escalate/Close), and does the vision-captioning step happen inline in Understanding or as a separate pre-pass? Neither is decided anywhere in this repo today.

---

## 8. When she escalates

The full, current list — compiled directly from `safety/evaluate.ts` and `safety/decision-categories.ts`:

| # | Trigger | Condition |
|---|---|---|
| 1 | Category always escalates (primary) | `COMPLAINT` or `EMERGENCY` as the primary intent |
| 2 | Category always escalates (secondary) | Any *secondary* intent is `COMPLAINT` or `EMERGENCY`, even if the primary intent wasn't |
| 3 | Safety tag set | Understanding tagged the message `spam / abuse / scam / medical / legal / unsupported` |
| 4 | Generation's own judgement | The drafting model set `requires_escalation: true` itself |
| 5 | Unconfirmed reschedule claim | A change-booking reply reads as confirming a new date without the booking record itself reflecting that change |
| 6 | Uncited payment answer | A payment question, real taught payment methods exist, and the draft cites none of them (Guarantee 2) |

Triggers 5 and 6 are the two checks that force `groundingFailed` and `requiresEscalation` together — every other grounding failure (an uncited price or operational instruction) blocks auto-send without forcing a full escalation, leaving a normal pending-approval draft with the reason attached for the owner to see.

**The confidence gate**, layered underneath all of this — a fixed table, never a live judgement call:

| Intent | Category | Never automatic | Always escalates | Minimum confidence |
|---|---|:-:|:-:|---|
| SOCIAL / BUSINESS_INFORMATION / STATUS_CHECK | general | | | medium |
| BOOKING_REQUEST / BOOKING_CHANGE / RETURNING_PROBLEM / PAYMENT_QUERY | booking-adjacent | | | high |
| BOOKING_CANCELLATION | cancellation | | | verified |
| PRICING_INQUIRY | pricing | **yes** | | verified |
| COMPLAINT | complaint | **yes** | **yes** | verified |
| EMERGENCY | emergency | **yes** | **yes** | verified |
| UNCLEAR | general | **yes** | | verified |

A message tagged `unsupported` can never suppress a genuine `EMERGENCY`/`COMPLAINT` classification — found via adversarial testing, where a real gas-leak message was tagged both at once and the safety tag would otherwise have won.

**A discrepancy worth fixing, not just noting**: `safety/evaluate.ts`'s own header comment currently claims *"the orchestrator always creates a draft requiring approval regardless of the outcome — auto-send is not implemented until a later sprint."* This is stale. `generate-reply.ts` (`canAutoSend`, lines ~292–295) does auto-send today, narrowly: only when the owner has explicitly opted in (`auto_reply_general_enabled`), only when `safety.category === "general"` (which — per the table above — can only ever be `SOCIAL`, `BUSINESS_INFORMATION`, or `STATUS_CHECK`; nothing booking-, pricing-, payment-, or complaint-shaped can ever reach `"general"`), and only when the safety layer's own `wouldAutoSend` clears. Outside that narrow, opt-in lane, the comment is accurate — everything else always lands as a pending draft. The comment should be corrected to say so precisely; leaving it as-is risks a future engineer trusting a claim the code has already outgrown.

---

## 9. How she avoids sounding repetitive

Two layers, one deterministic and one stylistic:

- **The deterministic check** — `prompt/facts.ts`'s `detectUsedStockPhrases()` scans every outbound message already in the thread for a fixed list of nine stock phrases ("let me know if you need anything else," "have a great day," "thank you for confirming," …) and, if any appear, injects an explicit fact telling Generation never to repeat them. Known limitation, stated plainly: substring matching only — it catches the exact phrase, not a paraphrase of it ("just shout if you need anything" slips through). Flagged as worth watching, not urgent (`DOCS/SPECS/Conversation-Experience-Review.md`).
- **The stylistic default** — one short sentence by default, two only for a real reason, three or more only for genuine complexity or an emergency. Most replies carry no emoji at all. The instruction is explicit that this reads as "a real member of staff answering WhatsApp while juggling the phone, customers, and engineers" — brevity itself is most of what keeps the same idea from being said the same way twice.

---

## 10. How she recovers from misunderstanding

Intent is re-evaluated fresh on every single message — nothing is locked in from a prior turn. A few concrete mechanisms make recovery actually reliable rather than just theoretically possible:

- **Topic restart, not topic confusion**: stage only ever moves backward when the customer clearly opens a new, unrelated request — at which point the state machine deliberately restarts from `understand` rather than trying to force the new topic into wherever the old one had gotten to.
- **Honest uncertainty over confident guessing**: understanding confidence is instructed to go low the moment a message is ambiguous or off-topic, "never guess to appear confident" — and low confidence widens context fetching (§1) rather than narrowing the model's options.
- **A real failure never disappears silently**: a parse or generation failure defaults to `requiresEscalation: true` with an honest reason ("The reply could not be generated — please handle this one yourself"), never a swallowed error and no reply at all.
- **The tag-vs-intent conflict guard** (§8, trigger 3): the one deterministic backstop specifically built because the model's own judgement, while usually right, once let a genuine emergency get quietly reclassified as merely unsupported.

---

## 11. How she stays consistently human across every trade

Trade-specific facts (services offered, typical jobs, opening hours, service areas) live entirely in `BusinessProfileContext` — real, taught data, gathered the same way regardless of trade. Voice — sentence length, question discipline, repetition-avoidance, the five-outcome question rule — is written once, trade-agnostic by design, and applied identically whether the business is a plumber or a painter and decorator. Consistency across trades is a direct consequence of *not* hardcoding trade-flavoured phrasing anywhere in the prompt.

What's genuinely still flat, honestly: **Business Personality is a three-value tone enum today**, not the richer, structured system document 07 §4 envisions (distinct sentence-length ceilings, greeting frequency, and question style per business, five named presets from "Quick & direct" to "Premium concierge"). This is already tracked as unbuilt in document 06 §6 — repeated here only because it's the direct answer to "how consistently human, across every trade *and* every business's own character" — today, the honest answer is: consistent in voice discipline, not yet expressive in personality.

---

## 12. What this document doesn't resolve

Deliberately left open rather than quietly decided while writing this:

- **Photos** (§7) — whether/how she asks for one, and where captioning happens in the pipeline.
- **Proactive follow-up** — document 08 (Judgement) names this as a real, not-yet-built capability: ReplyFlow only ever responds today, it never initiates. Worth deciding whether this belongs in the next phase of work or stays explicitly out of scope for longer.
- **Business Personality as real data** (§11, document 06 §6) — the schema-level design work hasn't started.
- **The correction/learning loop** (document 06 §6) — `reply_outcomes`/`reply_corrections` remain undesigned at the table level beyond the original proposal; this is the entire "Improve" stage of Learn → Work → Escalate → Improve (document 00), still the least mature part of the whole system.

None of these are silently assumed solved anywhere above. Building the next phase of the receptionist experience on top of this document means picking these up deliberately, not discovering them mid-build.
