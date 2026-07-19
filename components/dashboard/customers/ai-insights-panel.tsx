import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { SettleCard, Reveal } from "@/components/shared/motion";
import type { RelationshipStrength, SuggestedAction } from "@/lib/customer-memory-signals";
import type { ConfidenceLevel } from "@/lib/brain";
import { cn } from "@/lib/utils";

/**
 * Right panel — relationship strength, profile confidence, and
 * suggested next actions (Feature 12 UI). "Confidence" and
 * "Relationship Strength" are both qualitative labels, never raw
 * percentages, matching the Shared Brain's own rule for what owners
 * ever see (Shared Brain Architecture doc: "Confidence is not a
 * percentage shown to users").
 */
const CONFIDENCE_STYLE: Record<ConfidenceLevel, string> = {
  Learning: "bg-muted text-muted-foreground",
  Growing: "bg-learning/10 text-learning",
  Complete: "bg-success/10 text-success",
};

const STRENGTH_STYLE: Record<RelationshipStrength, string> = {
  "New Customer": "bg-muted text-muted-foreground",
  "Growing Relationship": "bg-learning/10 text-learning",
  "Regular Customer": "bg-primary/10 text-primary",
  "Trusted Customer": "bg-success/10 text-success",
  "VIP Customer": "bg-attention/10 text-attention",
};

export function AIInsightsPanel({
  strength,
  confidenceLabel,
  businessContextNote,
  suggestedActions,
}: {
  strength: RelationshipStrength;
  confidenceLabel: ConfidenceLevel;
  /** A real, currently-unaddressed gap from the business's own Shared
   * Brain (getBrainContext()) — shown only when genuinely relevant to
   * serving this customer, never forced onto every page. */
  businessContextNote: string | null;
  suggestedActions: readonly SuggestedAction[];
}) {
  return (
    <div className="space-y-4">
      <SettleCard className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Relationship strength</p>
        <span className={cn("inline-flex rounded-full px-3 py-1 text-[13px] font-semibold", STRENGTH_STYLE[strength])}>
          {strength}
        </span>
      </SettleCard>

      <SettleCard delay={0.04} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          How well I know them
        </p>
        <span className={cn("inline-flex rounded-full px-3 py-1 text-[13px] font-semibold", CONFIDENCE_STYLE[confidenceLabel])}>
          {confidenceLabel}
        </span>
      </SettleCard>

      {businessContextNote && (
        <SettleCard delay={0.07} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-learning" />
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">{businessContextNote}</p>
          </div>
        </SettleCard>
      )}

      {suggestedActions.length > 0 && (
        <SettleCard delay={0.1} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Suggested next actions</p>
          <div className="space-y-3">
            {suggestedActions.map((action, i) => (
              <Reveal key={action.id} index={i}>
                <div className="rounded-xl bg-muted/30 p-3.5">
                  <p className="text-[13px] leading-relaxed">{action.text}</p>
                  <Link
                    href={action.actionHref}
                    className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"
                  >
                    {action.actionLabel}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </SettleCard>
      )}
    </div>
  );
}
