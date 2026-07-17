import { cn } from "@/lib/utils";

/**
 * The one semantic colour vocabulary for conversation state, used
 * anywhere ReplyFlow needs to say what stage something is in. Colour
 * only ever communicates one of these meanings — never decoration.
 * Reuses the app's existing tokens wherever one already fits
 * (success/primary/destructive/muted); "waiting-owner" reuses the
 * amber already used elsewhere for exactly this idea (Home's Needs
 * You card); "learning" is the one genuinely new hue, reserved for
 * free-form teaching moments.
 */
export type StatusTone = "success" | "active" | "waiting-owner" | "urgent" | "learning" | "waiting";

const TONE_STYLES: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: "bg-success/10 text-success", dot: "bg-success" },
  active: { pill: "bg-primary/10 text-primary", dot: "bg-primary" },
  "waiting-owner": { pill: "bg-amber-500/10 text-amber-600", dot: "bg-amber-500" },
  urgent: { pill: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  learning: { pill: "bg-purple-500/10 text-purple-600", dot: "bg-purple-500" },
  waiting: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
};

export function StatusPill({ label, tone, className }: { label: string; tone: StatusTone; className?: string }) {
  const styles = TONE_STYLES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        styles.pill,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", styles.dot)} />
      {label}
    </span>
  );
}
