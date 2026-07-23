# 06 — Engineering Principles

**How this is actually built, and where judgement sits versus code.** Document 02 describes the receptionist in behavioural terms — what she knows, how she decides, how she speaks. This document describes the same system from the other side: the concrete engineering discipline that makes that behaviour reliable rather than merely hoped-for. Like document 02, it consolidates and updates `DOCS/BUILD/05` and `06`, which described the original proposal — a meaningful amount of what's below was built later and never previously written up as its own architecture document.

---

## 1. The one rule

**Retrieval and safety are deterministic code. Only the sentence itself is ever delegated to a model.** The model proposes; code decides. This is Principle 7 (document 01), and every section below is a different concrete expression of it.

A practical test for any new capability: if getting it wrong would be genuinely costly — an invented price, a false "you're booked," a real emergency waved off — it needs a rule that owns the outcome, not a hope that the model's judgement holds. Everywhere else, her judgement is the right tool, because rules can't sound like a person and shouldn't try to.

---

## 2. The pipeline and who's responsible for what

| Layer | Responsible for | Not responsible for |
|---|---|---|
| Webhook | Verify, store, ACK fast | Reasoning, replying |
| Understanding | Classify intent(s), extract entities, decide what context this message needs | Reply content |
| Context Assembly | Gathering bounded facts in full + windowing unbounded ones | Deciding what's true — it only retrieves |
| Conversation State | Carrying stage, goal, slots, open question, and commitments forward turn by turn | Re-deriving any of it from raw history each time |
| Prompt Construction | Deterministic formatting of everything above | Any judgment calls |
| Generation | Understanding meaning, drafting a reply, reporting its own reasoning | Deciding whether to send |
| Safety Layer | The actual send/hold/escalate decision, fact-grounding | Generating text |
| Send Adapter | Delivering the message, recording status | Deciding what to send |

Two signals stay deliberately separate throughout: **understanding confidence** (how sure is the classification?) and **reply confidence** (how sure is the drafted reply, given the context it was handed?). A message can be clearly understood and still produce a low-confidence reply — conflating the two signals would hide real information from the safety layer.

---

## 3. The Safety Layer, as it actually stands

Originally specified as three checks (confidence gate, fact-grounding, escalation category). Real production use and adversarial testing has since added several more, each with a genuine incident behind it — this is the current, complete list, not the original proposal:

- **Confidence gate** — a fixed table maps intent category to the minimum confidence required before anything could ever be automatic. Pricing and emergencies are hard-coded as never-automatic, full stop, regardless of confidence.
- **Fact-grounding** — every fact a draft claims to have used is cross-checked against what was actually sent. A citation to something that was never provided fails the check.
- **Uncited price/instruction check** — a draft stating a price, guarantee, or a specific operational instruction ("please ensure...") with zero facts cited fails grounding. Added after adversarial testing found the model inventing a plausible-sounding pre-visit instruction that no business had ever configured.
- **Reschedule-overclaim check** — a reply confirming a moved date without the booking record itself reflecting that change is blocked and forced to escalate. Two consecutive prompt-only fixes failed to hold this reliably; a deterministic rule was required.
- **Safety-tag / real-intent conflict guard** — a message can never be dismissed as "unsupported" if it was also classified as an emergency or a complaint. Found via adversarial testing: a genuine gas-leak message was tagged both `EMERGENCY` and `unsupported` at once, and the wrong tag would have won.
- **Exact-acknowledgement silence override** — a deterministic list of bare acknowledgements ("ok," "cheers," "thanks so much") forces silence when nothing is genuinely outstanding, regardless of what the model itself decides. Added because the model's own judgement, while usually right, wasn't reliable enough on its own for this one narrow, high-value guarantee.

The pattern across all of these: **a prompt instruction is a request; a safety-layer check is a guarantee.** Where a mistake would be genuinely costly, build the guarantee.

---

## 4. Conversation State

Detailed in document 02. The engineering discipline worth restating here: it is computed by extending the existing, small, cheap Understanding classification call — never a new call, and never re-derived from raw history on every turn. Two fields are corrected *after* generation runs rather than trusted from the pre-generation guess (`open_question`, and which commitments a reply actually resolved), because the classification step genuinely cannot know what the generation step will end up writing. This two-pass correction pattern is the one architectural idea in this document most likely to be needed again for any future stateful field.

---

## 5. The adversarial regression suite

`scripts/reply-engine-tests/` — a permanent, checked-in test harness, not a throwaway script. It drives the real production webhook with real signatures, real database rows, and real model calls, and asserts on actual behaviour, because the bugs worth catching here live in what the model does with a prompt, not in isolated deterministic logic a mock could stand in for.

**The standing rule: every real bug found through adversarial testing becomes a permanent scenario in this suite, never just a one-off fix.** Several scenarios are explicitly named `REGRESSION —` for exactly this reason — they encode bugs that were found, fixed, and must never be allowed to silently reappear. Before any change to the reply engine's prompts, safety layer, or Conversation State logic, this suite should run clean before and after.

---

## 6. What's designed but not built

Being honest about this here is more useful than letting it go unstated:

- **The correction/learning loop.** `reply_outcomes` and `reply_corrections` were designed in detail early in this product's architecture — a real signal every time the owner sends a draft unedited, edits it, or rejects it, feeding suggestions back through the same Recommendations surfaces the owner already trusts. Neither table exists yet; `recordOutcome()` and `recordCorrection()` remain unimplemented. This is the "Improve" stage of the Learn → Work → Escalate → Improve loop (document 00), and it's currently the least mature part of the whole pipeline — several owner-facing ideas in document 05 (visible receptionist improvement over time) are blocked on this existing first.
- **Business Personality as a real data shape.** The current tone setting is a flat enum. A genuine personality system — distinct sentence-length ceilings, greeting frequency, question style per business — needs a richer, structured representation that hasn't been designed at the schema level yet.
- **Semantic deduplication for taught knowledge.** Exact-string dedup exists today; recognising that "do you work Saturdays" and "are you open on weekends" are the same fact in different words does not. Flagged as a real future improvement, not a current requirement.

---

## 7. Non-negotiable data boundaries

Never sent to the model, under any circumstance: any other customer's data, any other business's data, internal identifiers with no customer-facing purpose, anything not explicitly taught as customer-facing, and payment credentials or anything resembling them. Multi-tenant isolation is enforced at the query layer (the same `business_id`/`conversation_id` scoping used everywhere), never assumed safe just because prompt construction is careful — defence in depth, not a single point of failure.

---

## 8. Channel-agnostic by design

Only the ingestion adapter (webhook → normalised message) and the send adapter (reply → channel-specific API call) know anything about WhatsApp specifically. Understanding, Context Assembly, Conversation State, Generation, and the Safety Layer never need to know which channel a message arrived on. Adding SMS, a web chat widget, or voice later means writing one new adapter pair, not touching the reasoning core.
