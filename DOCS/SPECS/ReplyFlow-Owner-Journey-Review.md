# ReplyFlow Owner Journey Review

**Study only — no implementation.** Companion to `ReplyFlow-Conversation-Excellence-Plan.md`: that document studied what a *customer* experiences on WhatsApp; this one studies what an *owner* experiences setting ReplyFlow up, screen by screen, from a brand-new account. Same discipline — real evidence, not assumptions, and no code changed to produce this.

---

## 1. The governing test

Documents 02 and 03 each have one sentence a decision gets checked against. This journey needs its own: not about voice, not about trust exactly, but about *clarity*.

> **On this exact screen, could a first-time owner say — out loud, in one sentence — what they're doing right now and why it matters?**

If the honest answer is "I'm filling in a field because the page asked me to," the screen has failed this test, however correct its content is. Every finding below is a real, observed moment where that sentence gets hard to say.

---

## 2. Method

A fresh account was created and driven through the real, deployed product exactly as a first-time plumber would encounter it: signup → email confirmation → business name → trade → the "Preparing your receptionist" screen → Front Desk → Business teaching → Receptionist teaching → Availability/Booking Rules → Meet Your Receptionist → WhatsApp connect → Settings — at a real mobile viewport (430×932), the primary real-world device for this audience. Every quote below is real, captured copy from that walkthrough, not recalled from memory or written from the source alone (though the source was checked afterward, to find *why* each moment happens, not just *that* it happens).

---

## 3. Finding: the sequence is suggested, not enforced

This is the structural finding everything else sits on top of, and it's exactly what surfaced as "I was briefly able to reach Front Desk before completing onboarding."

**What's actually true, traced to the code:** `onboarding_completed` — the one flag `app/(dashboard)/layout.tsx` checks before allowing entry to anything under `/dashboard` — flips to `true` the moment the business name and trade are submitted (`/api/onboarding/prepare`). That's two screens. Nothing about Business teaching, Receptionist teaching, Meet Your Receptionist, or Test Conversations is required first.

**Confirmed live:** with the Hiring Experience checklist sitting at 0 of 4 steps, every one of these was directly, fully reachable — not partially, not with a warning: `/dashboard/conversations`, `/dashboard/customers`, `/dashboard/settings`, and — the one that matters most — **`/dashboard/whatsapp`, the real WhatsApp connect screen**, reachable before the owner has taught a single fact, met the receptionist, or run one Test Conversation.

To be precise about what's already good here: **Front Desk itself does the right thing.** It correctly detects the incomplete state and shows a plain setup checklist (`SetupJourney`) instead of the real dashboard. The gap isn't Front Desk — it's that this is the *only* gate. The sidebar (Conversations, Customers, Knowledge, Hours, Settings) sits fully active the entire time, and — most importantly — nothing stops an owner from connecting real WhatsApp on day one, which is in direct tension with the Trust Experience document's own governing law: *"Proof Before Ask — never request a permission... without first showing the specific evidence that justifies it."* Today, nothing structural asks first.

A smaller, related moment: the "Preparing your receptionist" screen itself says *"Learning your business"* as one of its four rotating lines — atmospheric copy, not a lie, but it sets an expectation ("she's already learning me") that Front Desk immediately undercuts a few seconds later with "0 of 4 steps done."

---

## 4. Finding: personality is proven in one place and just asserted in two others

**What works, confirmed live:** the Receptionist page's tone picker is genuinely excellent — "Which of these sounds most like you?" shows three real example replies side by side ("Oh no, sorry to hear that!" / "I'm sorry to hear that." / "Sorry to hear that.") so the owner *sees* the difference before choosing. This is the "prove it" pattern done right, and it's real evidence the product already knows how to do this well.

**What doesn't, confirmed live:** the Business page's "What makes you different" section — real chips (Family business, Same-day service, Fully insured, Free quotes, 20+ years experience, Emergency call-outs) — has no such demonstration anywhere. Neither does the free-text "Describe my personality more specifically" field on the Receptionist page. Both ask the owner to describe something about themselves with no visible link back to how it changes what the receptionist actually says — which is precisely the "I don't understand how that changes the receptionist" reaction. The tone picker proves the product isn't structurally incapable of this; it just wasn't applied consistently to the other two places asking the same kind of question.

---

## 5. Finding: one page, two different experiences

Booking Rules (`/dashboard/availability`) is the clearest single example of "feels like a form" — because it's genuinely half of one.

The top of the real page reads exactly the way the Hiring Experience redesign intended: *"If someone asks 'are you free today?' — We're closed today, but I can find you a slot soon after. I'll just need 2 hours' notice."* — a live, scenario-framed proof line, plus toggle questions phrased as real situations ("Same-day bookings," "Emergency call-outs").

Scroll further on the exact same page and the framing disappears: *"How much notice do I need? / Travel time between jobs / Working radius / Block out a lunch break"* — plain parameter labels with a value picker, no scenario, no "if someone asks..." framing at all. An owner doesn't experience these as two different design eras of the same page — they experience it as one page that starts like a conversation and quietly turns into a settings panel partway down.

---

## 6. Finding: "still feels like a survey" is a real, evidenced tension between two decisions already made

Business teaching (`/dashboard/business`) is not a regression — it's the product of a deliberate, documented choice (Sprint 8.7) to drop the chat-bubble/avatar metaphor after real review found it "psychologically perceived as a questionnaire." What replaced it — a plain, always-visible profile document with progressive disclosure — successfully avoids *looking* like a chatbot interrogation. But it doesn't yet deliver the other half of Principle 2 ("the owner hires a receptionist, not software... everything should feel like training an employee"): reading a label, picking a chip, and watching a group auto-collapse is still, mechanically, filling in a well-organised form with narration layered on top — not a back-and-forth. The forward-guidance acknowledgements ("Perfect. I can now introduce your business. Next, let's cover...") are a real, working attempt to close that gap, and they help — but they're closer to a form confirming itself warmly than to training happening. Both goals (not-a-chatbot, not-a-form) are legitimate and already agreed; this page currently sits closer to the first than the second, and that's a real, nameable tension worth having explicitly, not a bug to silently patch.

---

## 7. Finding: unlocks are rarely stated

Confirmed live, at the exact moment a fresh owner needs it most: Front Desk's setup checklist says *"Let's get your office ready"* then lists Business / Receptionist / Meet your receptionist / Connect WhatsApp with a plain "0 of 4 steps done" — no line anywhere explaining what finishing "Business" actually changes, what finishing "Receptionist" unlocks, or why the order is what it is. The Business page's own "Where things stand" panel has the identical shape: a bullet list of gaps ("the services you offer," "the areas you cover") stated as missing facts, never as "and here's what happens once you've told me this." Nothing here is dishonest — it's simply silent on the one question this whole document is testing for: *why does this matter?*

---

## 8. Finding: progress is celebrated inconsistently, not never

Worth being precise, because this isn't a total gap: Business teaching and Receptionist teaching both already have real celebration and forward-guidance moments (group-completion acknowledgements, "Halfway there," "Next, let's cover..."). The inconsistency is that the very first thing a fresh owner sees — Front Desk's setup checklist — has none of it. A step's checkmark just silently updates; there's no moment, on return to Front Desk after finishing Business teaching, that says anything like "you can now introduce your business properly" the way the teaching pages themselves do. The entry point to the whole journey is the one place still behaving like a plain checklist rather than joining in on a pattern the product has already built and uses well elsewhere.

---

## 9. Finding: the missing "business profile image" is a real capability gap, not a discoverability problem

The Business page's logo upload works, and is honest about its own scope — its own real copy says *"Shown throughout your dashboard."* That's the tell: it was never meant to, and doesn't, become the photo a real customer sees when they open a WhatsApp conversation with the business. Confirmed against `lib/whatsapp/graph.ts`: there is no code anywhere that calls WhatsApp's Business Profile endpoint to set that photo. A customer messaging a ReplyFlow-connected business today sees no photo, or Meta's default — never the logo the owner uploaded — and nothing in the product currently tells the owner this distinction exists. This is very likely exactly what "uploading a business profile image" being perceived as missing actually refers to: not an absent button, but a real, silent gap between what the one existing upload does and what a business owner would reasonably expect a "business photo" feature to do.

---

## 10. What's already working — worth protecting

- The Receptionist tone picker's live example-reply comparison (§4) — the clearest existing proof this product already knows how to answer "what does this change" well.
- Business and Receptionist teaching's forward-guidance acknowledgements and celebration moments (§8) — real, and worth extending to Front Desk, not replacing.
- The top half of Booking Rules (§5) and Meet Your Receptionist's honest "empty" state (*"I haven't learned much about [business] yet... Let's fix that first"*) — both genuinely good, specific, non-generic copy.
- Settings' honest "Coming soon" labelling on unbuilt notification features — plain, not oversold.

---

## 11. The Owner Journey Rubric

The reusable form of the findings above, in the order a fresh owner would actually hit them:

1. **Could this owner explain, right now, why this screen exists before the one after it?**
2. **If this section were fully skipped, would anything downstream visibly, honestly break — or does the product only pretend it would?**
3. **Where a choice is asked for, is its effect ever shown, or only assumed?**
4. **Scroll to the bottom of this page — does it still feel like the same page it started as?**
5. **Does finishing this step say what it unlocks, or only that it's now checked?**
6. **Is there a real moment when progress is worth celebrating here — and does one actually happen?**
7. **Does anything on this screen imply a capability (a photo, a notification, a number) that doesn't actually reach the customer the way it looks like it would?**

---

## 12. Explicitly out of scope here

No proposed copy, no redesigned screens, no new gating logic, no data-model changes. §3 and §6 in particular name real, structural tensions (sequence enforcement vs. flexibility; not-a-chatbot vs. not-a-form) that deserve a deliberate decision once this review is discussed — not a fix quietly folded into what was asked to be a study.
