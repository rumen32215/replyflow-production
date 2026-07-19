import { PageSpinner } from "@/components/shared/loading-state";

/** Route-level fallback for every page inside (auth). */
export default function AuthLoading() {
  return <PageSpinner message="One moment..." />;
}
