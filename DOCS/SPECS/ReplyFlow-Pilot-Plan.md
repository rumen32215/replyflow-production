# ReplyFlow Pilot Plan

**How we safely put ReplyFlow in front of real businesses, and how we decide whether it's ready for wider release.** ReplyFlow v1 passed its own launch-readiness review (`DOCS/BUILD/` walkthrough record, 2026-07-24) — feature-complete, all three product guarantees verified live in production. This document is what comes after: the product stops being designed and starts being proven. Living plan, expected to change as pilots teach us things — unlike `DOCS/CONSTITUTION/`, which stays stable.

---

## 0. Why this phase exists

`DOCS/CONSTITUTION/01-Vision.md` names the loop the product runs on: **Learn → Work → Escalate → Improve.** Learn, Work, and Escalate are real and shipped. **Improve — corrections and outcomes feeding back into what she knows — is the one stage still substantially unbuilt** (document 01 §3, document 07 §6). Every prior phase of this project was internal: synthetic businesses, adversarial test scripts, one owner (us) pretending to be a first-time tradesperson. None of that can exercise Improve, because Improve needs real corrections from real owners handling real customers. That's what a pilot is for. It is not a marketing exercise and not a chance to add features — it's the first time this product gets to learn from the thing it was actually built to serve.

It also produces the one input `DOCS/CONSTITUTION/08-Implementation-Roadmap.md` says cannot be accelerated by engineering effort: item **C1, widening auto-send beyond its current single category**, which "waits on time and evidence, not code." A pilot is where that evidence gets made.

---

## 1. What counts as a new feature during this phase

Restating the operating law exactly as set, because everything below is built to enforce it, not just describe it. A new feature is approved only if it comes from:

1. **Real customer feedback** — something a pilot owner or their customer actually said.
2. **Real operational pain observed during a pilot** — something that had to be worked around by hand, more than once.
3. **A defect that breaks one of ReplyFlow's three product guarantees.**

Everything else waits. No roadmap grooming, no "while we're in there," no building something because a pilot *might* need it. Section 6 below defines exactly how a piece of feedback gets tested against these three gates before anything gets built.

---

## 2. Who the first pilots are

Small on purpose — evidence needs to be legible per business, not averaged into noise.

- **3–5 businesses to start.** Enough to see whether a problem is one owner's opinion or a real pattern (see §6); few enough that every one of them gets real attention, not a support queue.
- **A trade ReplyFlow already has real scenario depth for** — plumbing, electrical, heating, and the other trades already modelled in `lib/receptionist.ts`'s scenario set. Not because other trades don't matter, but because the first pilots shouldn't also be the first real test of a trade nobody's thought through yet.
- **Real WhatsApp Business number, real inbound customer volume.** A business with two enquiries a month can't produce enough signal to learn from. Look for genuine day-to-day traffic.
- **Willing to talk, often, honestly.** This is a research relationship before it's a sale. An owner who'll say "this annoyed me" in week one is worth more to this phase than one who's silently happy — silence is the one signal ReplyFlow can't act on.
- **Reachable.** Early on, that means a real phone number and a realistic expectation of a same-day response from us, not a ticket queue.

---

## 3. How we onboard them safely

The gate: pilots only start once the launch-readiness review's three guarantees are confirmed live in production — already true as of this document.

- **White-glove, not self-serve, for the first cohort.** Someone from the team is present (in person, on a call, or reachable in real time) through Business teaching, Receptionist teaching, Meet Your Receptionist, and WhatsApp connection — the same journey the launch-readiness walkthrough just ran, now with a real stranger instead of a synthetic account. If the owner hesitates or gets confused anywhere, that's exactly the signal this phase exists to catch.
- **Auto-send stays off, full stop, for every pilot business at first.** This isn't a new policy — it's `DOCS/CONSTITUTION/04-Trust-Experience.md` §5's existing rule for a business's first live customer applied deliberately: *"strictly manual, no exceptions, regardless of any category-level auto-send settings — the first period is a floor, not a default."* Every pilot business starts in **Shadowing** on the Confidence Timeline (§7 of the same document), for every category, no matter what the owner taught. Nothing here is invented for the pilot; it's the product's own designed safety floor, actually being used as intended for the first time.
- **A direct line to a real human.** Not a support form — a channel the owner already has by the time they send their first real customer message, so a broken promise gets caught and fixed the same day, not discovered in a weekly check-in.
- **A clean way out.** Disconnecting WhatsApp and stopping is always available, with no data held hostage and no pressure to justify leaving. A pilot that isn't working is itself a useful, honest result — see §7.

---

## 4. What we watch continuously, not just at review time

- **The three product guarantees — zero tolerance.** Any real violation (an invented fact, a known fact ignored, a moment the owner had no way to reply) pauses that business's automation, gets fixed, gets verified in production, and — if it's a Reply Engine issue — becomes a permanent scenario in `scripts/reply-engine-tests/scenarios.mjs`, per the existing standing rule in `DOCS/CONSTITUTION/07-Engineering-Principles.md` §5. This is the one thing in this whole plan that is never batched, never waits for a weekly review, and always fixed before that business's pilot continues.
- **Interruption volume.** `DOCS/CONSTITUTION/01-Vision.md`'s North Star names this directly: *"Interruption volume is a product metric to actively minimise, not a queue to keep merely accurate."* Watch both directions — escalating too much (an owner drowning in review) and too little (a real emergency or complaint that should have surfaced but didn't).
- **Connection health.** The launch-readiness walkthrough found a real, live WhatsApp send failure on our own test business during testing. If it happens on our own account, it will happen on a pilot's — catch it fast, since a broken send channel is the one failure mode no amount of good drafting can route around.

---

## 5. What success looks like

**Per business, not just averaged.** The Confidence Timeline is deliberately not a global score (document 03 §7) — neither is pilot success.

**In the owner's own words** (collected per §6, not inferred):
- Would they keep paying for this once the pilot ends?
- Would they recommend it to another tradesperson?
- Does it feel like an employee, or like software they have to supervise?

**From data that already exists — no new instrumentation required to start:**
- Draft outcomes: approved unedited vs. edited vs. rejected (`reply_drafts.status` / `final_text` vs. `draft_text` — already stored on every reply).
- Real bookings created and completed (`work_cards`).
- Response latency: inbound message to draft ready.
- Escalation rate, and — reviewed by a person, not automated — whether each escalation was actually warranted.
- Whether trust is visibly moving up the Confidence Timeline for at least the one category already wired for auto-send (general questions & business info), for at least one pilot business, by the end of the window. That's the first real data point toward roadmap item C1.

**One deliberate non-decision:** `reply_outcomes` / `reply_corrections` — the real data model for the Improve stage, "designed in detail... neither table exists yet" (`DOCS/CONSTITUTION/07-Engineering-Principles.md` §6) — is **not** being built ahead of the pilot. If manually querying the database for the metrics above turns out to be too slow or too blind to actually run this phase, *that* is real operational pain observed during a pilot — gate 2 from §1 — and building it becomes justified on that evidence, not on our own hunch that we'll probably need it. Naming this here deliberately, as the first concrete example of the new discipline actually working.

---

## 6. Collecting and triaging feedback

- **Recurring, human, not a survey tool.** A short check-in — call or written — weekly for the first few weeks per business, tapering to every two weeks once things settle. Nothing to build here; this is a conversation, not a dashboard.
- **Every report triaged into the same four categories the Polish Pass already proved useful** (explicitly reused, not reinvented, because the user asked for exactly this kind of review going forward):
  1. Product bug — contradicts the Constitution or Blueprint.
  2. UX friction — the owner hesitates, gets lost, or has to think.
  3. Behaviour mismatch — she doesn't act like the personality and judgement already defined.
  4. Technical bug — it simply doesn't work.
- **Real conversations become real test cases.** Any genuine gap a pilot business's real customer traffic reveals — anonymised — becomes a permanent scenario in `scripts/reply-engine-tests/scenarios.mjs`, exactly the standing rule already governing that suite. Pilots become the next generation of adversarial testing, sourced from reality instead of imagination.
- **Pattern discipline — this is what actually enforces §1.** One business's one complaint is a data point, not a mandate. Guarantee-breaking defects act immediately, always, no pattern required (§4). Everything else — UX friction, a missing capability, a "it would be nice if" — waits until the *same* pain shows up independently across more than one pilot business before it's built. This is the concrete mechanism that stops the new operating law from being relitigated every time one owner asks for something.

---

## 7. Deciding whether ReplyFlow is ready for wider release

Non-negotiable gate:
- **Zero unresolved guarantee violations across the entire pilot.** Not "rare" — zero, or it isn't ready.

Evidence-based gates (starting numbers below; genuine targets get set from what weeks 1–2 actually show, not invented in advance):
- At least **3–5 pilot businesses**, running at least **4–6 weeks** each with genuine customer volume — extended per business individually if that's what the evidence calls for, matching the Confidence Timeline's own rule that sitting in an earlier stage longer, correctly, is not a failure (document 03 §7).
- Every real bug found during the pilot fixed, verified live, and — where it touches the Reply Engine — permanently regression-tested.
- Direct, largely unprompted owner testimony of trust, not just an absence of complaints.
- Real evidence that at least one category, for at least one business, has genuinely earned its way toward **Observed** or **Trusted** on the Confidence Timeline — not asserted, shown.

**What "ready" does not mean:** feature-complete, or that no edge case will ever surface again. It means the same bar this launch-readiness review already cleared, now proven against real strangers' real customers and real money, not synthetic tests and one internal reviewer.

---

## 8. Standing discipline for this phase

Everything above exists to make one thing operational, not just aspirational: **for as long as this plan is active, a feature earns its place by being asked for, by being genuinely painful, or by breaking a promise — never by being a good idea on its own.** Every change that does clear one of those three gates still goes through the same discipline as everything shipped so far: checked against `DOCS/CONSTITUTION/02-Principles.md` before a line of code is written, tested against real production data, reported plainly — no developer report, a launch-readiness-style account of whether it actually worked.
