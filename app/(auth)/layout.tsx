import Link from "next/link";
import { Logo } from "@/components/shared/logo";

/**
 * Second founder review (2026-08-03): the landing page and the auth
 * screens read as "two unrelated products" — pressing the Hero's CTA
 * shouldn't feel like leaving one website for another. The aurora
 * ambient background is the same primitive the Hero uses (`app/
 * globals.css`'s `.aurora-layer`), reused here rather than reinvented,
 * so the environment itself carries over instead of resetting to a
 * plain gradient the moment signup opens.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="aurora-layer" aria-hidden="true">
        <div className="aurora-blob aurora-blob-primary" />
        <div className="aurora-blob aurora-blob-success" />
      </div>
      <div className="relative mx-auto flex max-w-5xl items-center justify-between px-8 py-6">
        <Link href="/">
          <Logo />
        </Link>
      </div>
      <div className="relative flex items-start justify-center px-5 pb-20 pt-6">{children}</div>
    </div>
  );
}
