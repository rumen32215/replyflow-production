# ReplyFlow — Application Foundation (Phase 1–4)

Production-ready Next.js SaaS foundation, built per the Founder Handbook
(design system, principles) and the Phase 1–4 brief (architecture,
design system, auth, onboarding). Dashboard, WhatsApp integration, and
AI conversations are intentionally **not** built yet — see "What's not
here" below.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui-style components (hand-authored, see `components/ui`)
- Supabase (auth + Postgres) via `@supabase/ssr`
- React Hook Form + Zod for every form
- Zustand for onboarding wizard state (persisted to localStorage)
- Framer Motion for step transitions (subtle only — fade/slide, no gimmicks)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
```

Run the migration in `supabase/migrations/0001_init.sql` against your
Supabase project (SQL editor, or the Supabase CLI), then:

```bash
npm run dev
```

## Folder structure

```
app/
  (auth)/          Login, Sign Up, Forgot Password, Verify Email, Welcome
  (onboarding)/    5-step onboarding wizard
  layout.tsx       Root layout (Inter font, Toaster)
  page.tsx         Routes the visitor to the right place based on auth/onboarding state
components/
  ui/              Design system primitives (Button, Input, Card, Badge, Toast, Dialog...)
  auth/            Auth-specific components (forms, shared AuthCard shell)
  onboarding/      Onboarding-specific components (5 steps + shared StepShell)
  shared/          App-wide reusable pieces (Logo, EmptyState, loading states)
lib/
  supabase/        Browser + server Supabase clients
  validations/      Zod schemas (one file per domain: auth, onboarding)
  constants.ts      Single source of truth for trades, services, greeting styles, step list
  utils.ts           cn() class-merging helper
hooks/
  use-onboarding-store.ts   Zustand store for the wizard
  use-toast.ts              Toast state (shadcn pattern)
types/
  index.ts          Shared TypeScript types (Business, etc.)
supabase/
  migrations/        SQL migrations, RLS policies included
middleware.ts         Session refresh + route protection
```

## Why this folder structure scales

- **Route groups** — `(auth)` and `(onboarding)` share layouts (topbar,
  background, transitions) without leaking that chrome into routes that
  don't need it (e.g. the future `(dashboard)` group).
- **`components/ui` is the only place brand tokens get consumed directly.**
  Every other component uses Tailwind's `bg-primary`, `text-muted-foreground`,
  etc. — so a rebrand is a CSS-variable change in `app/globals.css`, not a
  find-and-replace across 40 files.
- **One Zod schema per step, merged for the final write.** Each step
  validates independently (so Step 3 doesn't need to know Step 4's rules),
  but `onboardingSchema` in `lib/validations/onboarding.ts` is the single
  shape that actually lands in Supabase.
- **`lib/constants.ts` is why "unlock Electrical" is a one-line change**,
  not a hunt through JSX for hardcoded trade names.

## What's not here (by design)

Per the brief: no dashboard, no real WhatsApp Cloud API integration, no
AI conversation engine. The Connect WhatsApp step *simulates* a
connection (loading → success) so the onboarding experience is complete
and testable end-to-end — swapping the simulation for Meta's Embedded
Signup is a contained change inside `components/onboarding/step-connect-whatsapp.tsx`
and doesn't touch anything else.

## Known deferrals worth tracking

- **Logo upload** currently previews via `URL.createObjectURL` only —
  it isn't persisted to Supabase Storage yet. Fine for finishing
  onboarding; needs a bucket + signed upload before launch.
- **Trade selection** is UI-locked to Plumbing (matches Handbook Page 6).
  The chip component already renders the other trades in a disabled
  state so unlocking one later is a data change, not a redesign.
