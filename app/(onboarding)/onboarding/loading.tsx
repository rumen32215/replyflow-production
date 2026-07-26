/**
 * Route-level fallback for every step inside /onboarding — shown only
 * for the brief moment a step's server component is fetched. Matches
 * the same card chrome every step already renders (so nothing jumps
 * when the real content mounts) and the same quiet brand mark used on
 * Welcome and the Preparing screen — no spinner, no "loading" copy.
 * A generic spinner-and-message here would undercut the premium,
 * brand-led feel the rest of onboarding was just built around.
 */
export default function OnboardingLoading() {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-border bg-card p-9 shadow-elevated sm:p-10">
      <div className="h-14 w-14 animate-pulse rounded-3xl bg-gradient-to-br from-primary to-success opacity-60" />
    </div>
  );
}
