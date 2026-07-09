import { cn } from "@/lib/utils";

/** Loading-state building block. Compose into skeleton rows/cards per view. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
