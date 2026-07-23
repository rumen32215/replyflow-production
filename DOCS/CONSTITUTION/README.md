# ReplyFlow Constitution

This folder is the permanent, current source of truth for what ReplyFlow is and why — not sprint notes, not a changelog. A future engineer or designer should be able to read this folder alone and understand the product without asking anyone anything.

A note on the name: the brief for this sprint suggested `/docs`. This folder is `DOCS/CONSTITUTION` instead of a sibling `/docs`, for one unglamorous but real reason — Windows filesystems are case-insensitive, and this repository already has a `DOCS/` folder (the sprint-by-sprint archive below). A literal `/docs` would silently collide with it on this machine. `CONSTITUTION` says what this folder actually is more precisely than a generic `docs` would have anyway.

## Reading order

| File | Answers |
|---|---|
| [00-Vision.md](00-Vision.md) | What is ReplyFlow, and why does it exist? |
| [01-Principles.md](01-Principles.md) | What must every future decision obey? |
| [02-Conversation-Philosophy.md](02-Conversation-Philosophy.md) | How does the receptionist think, decide, and speak? |
| [03-Trust-Experience.md](03-Trust-Experience.md) | How does an owner come to trust her? |
| [04-Owner-Experience.md](04-Owner-Experience.md) | What should the owner feel, at every stage of using ReplyFlow? |
| [05-Experience-Architecture.md](05-Experience-Architecture.md) | What are the actual screens, and what does each one answer? |
| [06-Engineering-Principles.md](06-Engineering-Principles.md) | How is this actually built, and where does judgement sit versus code? |
| [07-Implementation-Roadmap.md](07-Implementation-Roadmap.md) | What gets built next, in what order, and why? |

## Relationship to `DOCS/SPECS/`

`DOCS/SPECS/` holds living implementation-planning documents — the Work Card object definition, the Trust Track implementation plan, and whatever follows the same pattern: fully defining an object or a technical requirement *before* a screen gets designed around it. Unlike this folder, specs are expected to change as building proceeds. This folder stays stable; `DOCS/SPECS/` moves with implementation.

## Relationship to `DOCS/BUILD/`

`DOCS/BUILD/` is the archive — the real, dated record of every sprint that produced the thinking in this folder (05 Reply Engine Architecture through 12 ReplyFlow Principles, plus the pre-rebuild bootstrap documents 00–04). Nothing there is deleted or invalidated. This folder is what that archive *converges to* — the current, consolidated answer, with the history of how we got here left intact for anyone who wants the full story behind a decision. When the two disagree, this folder wins; `DOCS/BUILD/` explains why the thinking changed.

## How to use this folder going forward

Before scoping a new sprint, check it against [01-Principles.md](01-Principles.md) and locate it in [07-Implementation-Roadmap.md](07-Implementation-Roadmap.md). If it isn't in the roadmap, ask why before building it. If it's in the roadmap out of dependency order, ask why before reordering it. This folder is not read once and filed away — it's the thing every subsequent sprint checks itself against.
