import { PageSpinner } from "@/components/shared/loading-state";

/**
 * Route-level fallback for every page inside (dashboard) — fires on
 * any navigation while the next page's server data is still loading.
 * Design System: never a bare spinner or blank screen; say what's
 * happening so the owner is never left wondering.
 */
export default function DashboardLoading() {
  return <PageSpinner message="Getting things ready..." />;
}
