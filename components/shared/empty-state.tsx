import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Standard empty state for lists/tables with no data yet — e.g. the
 * dashboard before the first lead comes in. Keep the copy specific
 * to what the user should do next, not just "nothing here."
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
