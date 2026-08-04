import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/constants";
import { GradientText } from "@/components/shared/gradient-text";

/**
 * The single source of the ReplyFlow logo mark. Used in the topbar,
 * auth cards, and (later) the dashboard sidebar — never re-drawn
 * inline in a page component.
 *
 * The wordmark carries the same gradient the product already reserves
 * for its rare, considered emphasis moments (`GradientText` — a
 * headline's key phrase, never a whole sentence). Applying it here
 * too, permanently, is a deliberate widening of "where the gradient is
 * allowed to live" — the brand's own name is exactly the single,
 * considered moment that rule was written for, not an exception to it.
 */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-success">
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
          <path d="M4 20l1.6-4.8A8 8 0 1112 20a7.96 7.96 0 01-3.9-1L4 20z" fill="white" />
        </svg>
      </span>
      {showWordmark && (
        <span className="text-[19px] font-extrabold tracking-tight">
          <GradientText>{BRAND.name}</GradientText>
        </span>
      )}
    </div>
  );
}
