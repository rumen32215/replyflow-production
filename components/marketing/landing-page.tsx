import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Hero } from "@/components/marketing/hero";
import { InvisibleWeight } from "@/components/marketing/invisible-weight";

/**
 * The ReplyFlow Landing Experience (`DOCS/SPECS/ReplyFlow-Landing-
 * Experience-Design.md`) — Section 1 (Hero) only. `app/page.tsx`
 * renders this directly for a signed-out visitor instead of
 * redirecting to `/login`, per that spec's §10.
 *
 * The header here is page chrome, not a Landing Experience "section"
 * — a signed-in-elsewhere visitor still needs a way to `/login`, the
 * same minimal need `AuthLayout` already serves for the auth screens.
 * Kept deliberately to a logo and one link; no marketing nav.
 */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        {/* Existing customers see this every day — it earns a real,
         * considered shape (a quiet pill, not a bare link floating in
         * space), not the same weight as the primary CTA. */}
        <Link
          href="/login"
          className="rounded-full border border-border px-4 py-1.5 text-[13.5px] font-semibold text-foreground/80 transition-colors hover:border-primary/30 hover:text-foreground"
        >
          Log in
        </Link>
      </header>

      <main>
        <Hero />
        <InvisibleWeight />
        {/* Sections 3–8 (How ReplyFlow Works, Trust & Safety, Product
         * Intelligence, Business Understanding, Social Proof, Call to
         * Action) land here one at a time, per founder direction — not
         * built in this pass. */}
      </main>
    </div>
  );
}
