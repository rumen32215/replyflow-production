import { cn } from "@/lib/utils";

/**
 * The one gradient-text treatment, shared wherever a single word or
 * name deserves the extra weight — the typed business name on Welcome
 * (originally introduced there), and now the outcome words RC4 calls
 * out on Welcome and Business name. One visual language, not a
 * per-screen reinvention of the same three Tailwind classes.
 */
export function GradientText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("bg-gradient-to-r from-primary to-success bg-clip-text text-transparent", className)}>
      {children}
    </span>
  );
}
