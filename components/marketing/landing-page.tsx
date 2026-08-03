import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Hero } from "@/components/marketing/hero";

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
        <Link
          href="/login"
          className="text-[14px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Log in
        </Link>
      </header>

      <main>
        <Hero />
        {/* Sections 2–8 (The Invisible Weight, How ReplyFlow Works,
         * Trust & Safety, Product Intelligence, Business Understanding,
         * Social Proof, Call to Action) land here one at a time, per
         * founder direction — not built in this pass. */}
      </main>
    </div>
  );
}
