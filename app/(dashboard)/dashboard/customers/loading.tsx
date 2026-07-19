import { Skeleton } from "@/components/ui/skeleton";

/**
 * Customer Memory's own loading state — skeleton cards immediately,
 * never a blank screen, matching every other route's loading pattern.
 */
export default function CustomersLoading() {
  return (
    <div className="-mx-4 -mb-24 -mt-6 flex h-[calc(100vh-60px-56px)] overflow-hidden md:-mx-8 md:-mb-8 md:-mt-8 md:h-[calc(100vh-73px)]">
      <div className="hidden w-full shrink-0 border-r border-border bg-card p-4 md:block md:w-[360px]">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-3 h-10 w-full rounded-xl" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}
