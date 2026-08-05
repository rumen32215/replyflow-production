import Link from "next/link";
import { Logo } from "@/components/shared/logo";

/**
 * Shared chrome for the one continuous pre-account encounter (V20 —
 * business name, trade, and service area now live inside a single
 * route, `components/onboarding/hiring-conversation.tsx`, not three
 * separate pages). Deliberately outside `/onboarding`, `/dashboard`,
 * and `/admin` — the three prefixes `middleware.ts` actually protects
 * — so no change to that file was needed; this route is unauthenticated
 * by the same existing logic that already leaves `/signup` and `/login`
 * open.
 *
 * No progress indicator (doc 16 §3.3), no "Save & exit" (doc 16 §3.8)
 * — the logo linking home is enough, the same minimalism `(auth)/
 * layout.tsx` uses. No per-route page transition here either: there's
 * only one route now, so there's nothing to transition between —
 * `hiring-conversation.tsx` handles its own in-place question
 * transitions internally.
 */
export default function HireLayout({ children }: { children: React.ReactNode }) {
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

      <div className="relative flex items-start justify-center px-5 pb-20 pt-6">
        <div className="w-full max-w-[460px]">{children}</div>
      </div>
    </div>
  );
}
