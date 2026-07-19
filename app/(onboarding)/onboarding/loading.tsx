import { PageSpinner } from "@/components/shared/loading-state";

/** Route-level fallback for every step inside /onboarding. */
export default function OnboardingLoading() {
  return <PageSpinner message="Setting things up..." />;
}
