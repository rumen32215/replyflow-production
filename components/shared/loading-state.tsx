import { Skeleton } from "@/components/ui/skeleton";

/** Generic skeleton block for card-shaped content while data loads. */
export function LoadingCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

/** Full-page centered spinner — used while auth/session state resolves. */
export function PageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}
