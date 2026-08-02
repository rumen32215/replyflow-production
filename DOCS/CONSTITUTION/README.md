# ReplyFlow Constitution

This folder is the permanent, current source of truth for what ReplyFlow is and why — not sprint notes, not a changelog. A future engineer or designer should be able to read this folder alone and understand the product without asking anyone anything.

A note on the name: the brief for this sprint suggested `/docs`. This folder is `DOCS/CONSTITUTION` instead of a sibling `/docs`, for one unglamorous but real reason — Windows filesystems are case-insensitive, and this repository already has a `DOCS/` folder (the sprint-by-sprint archive below). A literal `/docs` would silently collide with it on this machine. `CONSTITUTION` says what this folder actually is more precisely than a generic `docs` would have anyway.

## Reading order

| File | Answers |
|---|---|
| [00-Founder-Constitution.md](00-Founder-Constitution.md) | Why does ReplyFlow exist, and what does it refuse to become? The why every other document below answers to. |
| [01-Vision.md](01-Vision.md) | What is ReplyFlow, and why does it exist? |
| [02-Principles.md](02-Principles.md) | What must every future decision obey? |
| [03-Conversation-Philosophy.md](03-Conversation-Philosophy.md) | How does the receptionist think, decide, and speak? |
| [04-Trust-Experience.md](04-Trust-Experience.md) | How does an owner come to trust her? |
| [05-Owner-Experience.md](05-Owner-Experience.md) | What should the owner feel, at every stage of using ReplyFlow? |
| [06-Experience-Architecture.md](06-Experience-Architecture.md) | What are the actual screens, and what does each one answer? |
| [07-Engineering-Principles.md](07-Engineering-Principles.md) | How is this actually built, and where does judgement sit versus code? |
| [08-Implementation-Roadmap.md](08-Implementation-Roadmap.md) | What gets built next, in what order, and why? |
| [09-Receptionist-Intelligence-Architecture.md](09-Receptionist-Intelligence-Architecture.md) | How does she actually reason, turn by turn, right now — and what does that leave still undecided? |
| [10-ReplyFlow-Brain-Architecture.md](10-ReplyFlow-Brain-Architecture.md) | What are the nine Brain Loop stages and four Business Brain memory types, and exactly where does each one live in the code — built, partial, or not yet? |
| [11-ReplyFlow-Trust-Architecture.md](11-ReplyFlow-Trust-Architecture.md) | What does trust actually mean inside ReplyFlow, how is Business Understanding separate from Owner Trust, and how does the Trust Ladder relate to the Brain without becoming a fifth Business Brain memory type? Approved architecture, not yet implemented. |
| [12-ReplyFlow-Learning-Memory-Architecture.md](12-ReplyFlow-Learning-Memory-Architecture.md) | How does a real correction become durable business knowledge — what counts as a learning opportunity, how is a lesson proposed and confirmed, and how does this prepare Brain Loop Stage 9 (Adaptation) without building it? Approved architecture, not yet implemented. |
| [13-ReplyFlow-Adaptation-Architecture.md](13-ReplyFlow-Adaptation-Architecture.md) | What does Adaptation actually mean — how does it differ from Learning, what may it ever change, and why must every proposal include evidence the owner can understand? Completes all nine Brain Loop stages. Approved architecture, not yet implemented. |

## Relationship to `DOCS/SPECS/`

`DOCS/SPECS/` holds living implementation-planning documents — the Work Card object definition, the Trust Track implementation plan, and whatever follows the same pattern: fully defining an object or a technical requirement *before* a screen gets designed around it. Unlike this folder, specs are expected to change as building proceeds. This folder stays stable; `DOCS/SPECS/` moves with implementation.

## Relationship to `DOCS/BUILD/`

`DOCS/BUILD/` is the archive — the real, dated record of every sprint that produced the thinking in this folder (05 Reply Engine Architecture through 12 ReplyFlow Principles, plus the pre-rebuild bootstrap documents 00–04). Nothing there is deleted or invalidated. This folder is what that archive *converges to* — the current, consolidated answer, with the history of how we got here left intact for anyone who wants the full story behind a decision. When the two disagree, this folder wins; `DOCS/BUILD/` explains why the thinking changed.

## How to use this folder going forward

Before scoping a new sprint, check it against [02-Principles.md](02-Principles.md) and locate it in [08-Implementation-Roadmap.md](08-Implementation-Roadmap.md). If it isn't in the roadmap, ask why before building it. If it's in the roadmap out of dependency order, ask why before reordering it. This folder is not read once and filed away — it's the thing every subsequent sprint checks itself against.
