import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mission Control's own loading state. UI spec: "Skeleton cards.
 * Charts replaced with placeholders... the owner should immediately
 * know the page is working." No bare spinner, never a blank screen.
 */
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-6 shadow-sm ${className ?? ""}`}>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-3/4" />
    </div>
  );
}

export default function MissionControlLoading() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-7">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <Skeleton className="mx-auto h-4 w-4" />
            <Skeleton className="mx-auto mt-3 h-6 w-10" />
            <Skeleton className="mx-auto mt-2 h-3 w-20" />
          </div>
        ))}
      </div>

      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
