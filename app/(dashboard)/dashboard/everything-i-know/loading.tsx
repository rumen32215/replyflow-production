import { Skeleton } from "@/components/ui/skeleton";

/** Everything I Know's own loading state — same skeleton-card
 * convention as Mission Control, never a bare spinner. */
function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-3/4" />
    </div>
  );
}

export default function EverythingIKnowLoading() {
  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
        <Skeleton className="mt-5 h-4 w-full" />
      </div>
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
